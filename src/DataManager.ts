import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

export interface GeofenceEvent {
  id: string;
  regionId: string;
  eventType: 'enter' | 'exit';
  timestamp: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ActivityEvent {
  id: string;
  activity: string;
  confidence: number;
  timestamp: number;
  latitude?: number;
  longitude?: number;
  userId?: string;
}

export interface SystemHealthEvent {
  id: string;
  type: 'health_alert' | 'status_change' | 'error';
  title: string;
  message: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface AnalyticsData {
  events: GeofenceEvent[];
  activities: ActivityEvent[];
  healthEvents: SystemHealthEvent[];
  summary: {
    totalEvents: number;
    totalActivities: number;
    totalHealthEvents: number;
    dateRange: { start: number; end: number };
    mostActiveRegions: { regionId: string; count: number }[];
    mostCommonActivities: { activity: string; count: number }[];
  };
}

export interface DataManagerConfig {
  encryptData: boolean;
  encryptionKey?: string;
  maxEvents: number;
  maxActivities: number;
  maxHealthEvents: number;
  retentionDays: number;
  exportFormats: ('json' | 'csv')[];
  anonymizeData: boolean;
  autoCleanup: boolean;
}

export class DataManager {
  private config: DataManagerConfig;
  private encryptionKey: string;
  
  private static readonly STORAGE_KEYS = {
    GEOFENCE_EVENTS: 'expo_geofencing_events',
    ACTIVITY_EVENTS: 'expo_geofencing_activities',
    HEALTH_EVENTS: 'expo_geofencing_health',
    CONFIG: 'expo_geofencing_config',
    SYNC_QUEUE: 'expo_geofencing_sync_queue',
    USER_CONSENT: 'expo_geofencing_consent',
    ANALYTICS_CACHE: 'expo_geofencing_analytics'
  };

  constructor(config: Partial<DataManagerConfig> = {}) {
    this.config = {
      encryptData: true,
      maxEvents: 10000,
      maxActivities: 5000,
      maxHealthEvents: 1000,
      retentionDays: 30,
      exportFormats: ['json', 'csv'],
      anonymizeData: false,
      autoCleanup: true,
      ...config
    };
    
    this.encryptionKey = config.encryptionKey || this.generateEncryptionKey();
    
    if (this.config.autoCleanup) {
      this.setupAutoCleanup();
    }
  }

  // Event Storage Methods
  async storeGeofenceEvent(event: Omit<GeofenceEvent, 'id'>): Promise<string> {
    const eventWithId: GeofenceEvent = {
      ...event,
      id: this.generateId(),
      timestamp: event.timestamp || Date.now()
    };

    if (this.config.anonymizeData) {
      eventWithId.latitude = this.anonymizeCoordinate(eventWithId.latitude);
      eventWithId.longitude = this.anonymizeCoordinate(eventWithId.longitude);
    }

    const events = await this.getGeofenceEvents();
    events.push(eventWithId);
    
    // Keep only the most recent events
    const trimmedEvents = events.slice(-this.config.maxEvents);
    
    await this.saveData(DataManager.STORAGE_KEYS.GEOFENCE_EVENTS, trimmedEvents);
    
    // Queue for sync if needed
    await this.queueForSync('geofence_event', eventWithId);
    
    return eventWithId.id;
  }

  async storeActivityEvent(event: Omit<ActivityEvent, 'id'>): Promise<string> {
    const eventWithId: ActivityEvent = {
      ...event,
      id: this.generateId(),
      timestamp: event.timestamp || Date.now()
    };

    const activities = await this.getActivityEvents();
    activities.push(eventWithId);
    
    const trimmedActivities = activities.slice(-this.config.maxActivities);
    await this.saveData(DataManager.STORAGE_KEYS.ACTIVITY_EVENTS, trimmedActivities);
    
    await this.queueForSync('activity_event', eventWithId);
    
    return eventWithId.id;
  }

  async storeHealthEvent(event: Omit<SystemHealthEvent, 'id'>): Promise<string> {
    const eventWithId: SystemHealthEvent = {
      ...event,
      id: this.generateId(),
      timestamp: event.timestamp || Date.now()
    };

    const healthEvents = await this.getHealthEvents();
    healthEvents.push(eventWithId);
    
    const trimmedHealthEvents = healthEvents.slice(-this.config.maxHealthEvents);
    await this.saveData(DataManager.STORAGE_KEYS.HEALTH_EVENTS, trimmedHealthEvents);
    
    await this.queueForSync('health_event', eventWithId);
    
    return eventWithId.id;
  }

  // Data Retrieval Methods
  async getGeofenceEvents(filter?: {
    regionId?: string;
    eventType?: 'enter' | 'exit';
    startTime?: number;
    endTime?: number;
    userId?: string;
  }): Promise<GeofenceEvent[]> {
    const events = await this.loadData<GeofenceEvent[]>(DataManager.STORAGE_KEYS.GEOFENCE_EVENTS, []);
    
    if (!filter) return events;
    
    return events.filter(event => {
      if (filter.regionId && event.regionId !== filter.regionId) return false;
      if (filter.eventType && event.eventType !== filter.eventType) return false;
      if (filter.startTime && event.timestamp < filter.startTime) return false;
      if (filter.endTime && event.timestamp > filter.endTime) return false;
      if (filter.userId && event.userId !== filter.userId) return false;
      return true;
    });
  }

  async getActivityEvents(filter?: {
    activity?: string;
    startTime?: number;
    endTime?: number;
    userId?: string;
  }): Promise<ActivityEvent[]> {
    const activities = await this.loadData<ActivityEvent[]>(DataManager.STORAGE_KEYS.ACTIVITY_EVENTS, []);
    
    if (!filter) return activities;
    
    return activities.filter(activity => {
      if (filter.activity && activity.activity !== filter.activity) return false;
      if (filter.startTime && activity.timestamp < filter.startTime) return false;
      if (filter.endTime && activity.timestamp > filter.endTime) return false;
      if (filter.userId && activity.userId !== filter.userId) return false;
      return true;
    });
  }

  async getHealthEvents(filter?: {
    type?: string;
    severity?: string;
    startTime?: number;
    endTime?: number;
  }): Promise<SystemHealthEvent[]> {
    const events = await this.loadData<SystemHealthEvent[]>(DataManager.STORAGE_KEYS.HEALTH_EVENTS, []);
    
    if (!filter) return events;
    
    return events.filter(event => {
      if (filter.type && event.type !== filter.type) return false;
      if (filter.severity && event.severity !== filter.severity) return false;
      if (filter.startTime && event.timestamp < filter.startTime) return false;
      if (filter.endTime && event.timestamp > filter.endTime) return false;
      return true;
    });
  }

  // Analytics Methods
  async generateAnalytics(timeRange?: { start: number; end: number }): Promise<AnalyticsData> {
    const eventFilter = timeRange ? { startTime: timeRange.start, endTime: timeRange.end } : undefined;
    const events = await this.getGeofenceEvents(eventFilter);
    const activities = await this.getActivityEvents(eventFilter);
    const healthEvents = await this.getHealthEvents(eventFilter);

    // Calculate summary statistics
    const regionCounts = events.reduce((acc, event) => {
      acc[event.regionId] = (acc[event.regionId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const activityCounts = activities.reduce((acc, activity) => {
      acc[activity.activity] = (acc[activity.activity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostActiveRegions = Object.entries(regionCounts)
      .map(([regionId, count]) => ({ regionId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const mostCommonActivities = Object.entries(activityCounts)
      .map(([activity, count]) => ({ activity, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const allTimestamps = [
      ...events.map(e => e.timestamp),
      ...activities.map(a => a.timestamp),
      ...healthEvents.map(h => h.timestamp)
    ];

    const dateRange = allTimestamps.length > 0 ? {
      start: Math.min(...allTimestamps),
      end: Math.max(...allTimestamps)
    } : { start: 0, end: 0 };

    return {
      events,
      activities,
      healthEvents,
      summary: {
        totalEvents: events.length,
        totalActivities: activities.length,
        totalHealthEvents: healthEvents.length,
        dateRange,
        mostActiveRegions,
        mostCommonActivities
      }
    };
  }

  // Export Methods
  async exportData(format: 'json' | 'csv', timeRange?: { start: number; end: number }): Promise<string> {
    const analytics = await this.generateAnalytics(timeRange);
    
    if (format === 'json') {
      return JSON.stringify(analytics, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(analytics);
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }

  // Data Management Methods
  async clearAllData(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(DataManager.STORAGE_KEYS.GEOFENCE_EVENTS),
      AsyncStorage.removeItem(DataManager.STORAGE_KEYS.ACTIVITY_EVENTS),
      AsyncStorage.removeItem(DataManager.STORAGE_KEYS.HEALTH_EVENTS),
      AsyncStorage.removeItem(DataManager.STORAGE_KEYS.SYNC_QUEUE),
      AsyncStorage.removeItem(DataManager.STORAGE_KEYS.ANALYTICS_CACHE)
    ]);
  }

  async clearExpiredData(): Promise<void> {
    const cutoffTime = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    
    const events = await this.getGeofenceEvents();
    const activities = await this.getActivityEvents();
    const healthEvents = await this.getHealthEvents();
    
    const filteredEvents = events.filter(e => e.timestamp > cutoffTime);
    const filteredActivities = activities.filter(a => a.timestamp > cutoffTime);
    const filteredHealthEvents = healthEvents.filter(h => h.timestamp > cutoffTime);
    
    await Promise.all([
      this.saveData(DataManager.STORAGE_KEYS.GEOFENCE_EVENTS, filteredEvents),
      this.saveData(DataManager.STORAGE_KEYS.ACTIVITY_EVENTS, filteredActivities),
      this.saveData(DataManager.STORAGE_KEYS.HEALTH_EVENTS, filteredHealthEvents)
    ]);
  }

  // Sync Queue Methods
  async queueForSync(type: string, data: any): Promise<void> {
    const queue = await this.loadData<any[]>(DataManager.STORAGE_KEYS.SYNC_QUEUE, []);
    queue.push({
      id: this.generateId(),
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0
    });
    
    await this.saveData(DataManager.STORAGE_KEYS.SYNC_QUEUE, queue);
  }

  async getSyncQueue(): Promise<any[]> {
    return this.loadData<any[]>(DataManager.STORAGE_KEYS.SYNC_QUEUE, []);
  }

  async clearSyncQueue(): Promise<void> {
    await AsyncStorage.removeItem(DataManager.STORAGE_KEYS.SYNC_QUEUE);
  }

  // Consent Management
  async setUserConsent(consent: {
    location: boolean;
    analytics: boolean;
    storage: boolean;
    timestamp: number;
    version: string;
  }): Promise<void> {
    await this.saveData(DataManager.STORAGE_KEYS.USER_CONSENT, consent);
  }

  async getUserConsent(): Promise<any> {
    return this.loadData(DataManager.STORAGE_KEYS.USER_CONSENT, null);
  }

  // Private Helper Methods
  private async saveData<T>(key: string, data: T): Promise<void> {
    try {
      let dataToStore = JSON.stringify(data);
      
      if (this.config.encryptData) {
        dataToStore = CryptoJS.AES.encrypt(dataToStore, this.encryptionKey).toString();
      }
      
      await AsyncStorage.setItem(key, dataToStore);
    } catch (error) {
      console.error('Failed to save data:', error);
      throw new Error(`Failed to save data: ${error}`);
    }
  }

  private async loadData<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const storedData = await AsyncStorage.getItem(key);
      
      if (!storedData) {
        return defaultValue;
      }
      
      let dataToLoad = storedData;
      
      if (this.config.encryptData) {
        const bytes = CryptoJS.AES.decrypt(storedData, this.encryptionKey);
        dataToLoad = bytes.toString(CryptoJS.enc.Utf8);
      }
      
      return JSON.parse(dataToLoad);
    } catch (error) {
      console.error('Failed to load data:', error);
      return defaultValue;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateEncryptionKey(): string {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  private anonymizeCoordinate(coordinate: number): number {
    // Reduce precision to ~111 meters accuracy
    return Math.round(coordinate * 1000) / 1000;
  }

  private convertToCSV(analytics: AnalyticsData): string {
    const headers = ['Type', 'ID', 'RegionID/Activity', 'EventType', 'Timestamp', 'Latitude', 'Longitude', 'Accuracy', 'Confidence'];
    const rows: string[][] = [headers];

    // Add geofence events
    analytics.events.forEach(event => {
      rows.push([
        'Geofence',
        event.id,
        event.regionId,
        event.eventType,
        new Date(event.timestamp).toISOString(),
        event.latitude.toString(),
        event.longitude.toString(),
        (event.accuracy || '').toString(),
        ''
      ]);
    });

    // Add activity events
    analytics.activities.forEach(activity => {
      rows.push([
        'Activity',
        activity.id,
        activity.activity,
        '',
        new Date(activity.timestamp).toISOString(),
        (activity.latitude || '').toString(),
        (activity.longitude || '').toString(),
        '',
        activity.confidence.toString()
      ]);
    });

    return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }

  private setupAutoCleanup(): void {
    // Run cleanup every 24 hours
    setInterval(() => {
      this.clearExpiredData().catch(error => {
        console.error('Auto cleanup failed:', error);
      });
    }, 24 * 60 * 60 * 1000);
  }
}