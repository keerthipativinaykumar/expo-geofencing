import { GeofenceRegion } from './index';

export interface OfflineGeofence extends GeofenceRegion {
  isActive: boolean;
  lastEvaluated: number;
  metadata?: Record<string, any>;
}

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

export interface OfflineEvent {
  id: string;
  type: 'enter' | 'exit';
  regionId: string;
  location: LocationPoint;
  timestamp: number;
  synced: boolean;
}

export interface NetworkStatus {
  isConnected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none';
  isExpensive: boolean;
  lastConnected: number;
}

export class OfflineManager {
  private geofences: Map<string, OfflineGeofence> = new Map();
  private pendingEvents: OfflineEvent[] = [];
  private networkStatus: NetworkStatus = {
    isConnected: false,
    connectionType: 'none',
    isExpensive: false,
    lastConnected: 0
  };
  private syncCallbacks: Array<(events: OfflineEvent[]) => Promise<void>> = [];
  private syncInProgress = false;
  private retryTimeouts: Set<any> = new Set();

  constructor() {
    this.setupNetworkMonitoring();
    this.setupPeriodicSync();
  }

  // Geofence Management
  addGeofence(geofence: GeofenceRegion): void {
    const offlineGeofence: OfflineGeofence = {
      ...geofence,
      isActive: true,
      lastEvaluated: Date.now()
    };
    
    this.geofences.set(geofence.id, offlineGeofence);
  }

  removeGeofence(regionId: string): void {
    this.geofences.delete(regionId);
  }

  updateGeofence(regionId: string, updates: Partial<OfflineGeofence>): void {
    const existing = this.geofences.get(regionId);
    if (existing) {
      this.geofences.set(regionId, { ...existing, ...updates });
    }
  }

  getGeofences(): OfflineGeofence[] {
    return Array.from(this.geofences.values());
  }

  getActiveGeofences(): OfflineGeofence[] {
    return this.getGeofences().filter(g => g.isActive);
  }

  // Offline Geofence Evaluation
  evaluateLocation(location: LocationPoint): OfflineEvent[] {
    const events: OfflineEvent[] = [];
    const activeGeofences = this.getActiveGeofences();

    for (const geofence of activeGeofences) {
      const distance = this.calculateDistance(
        location.latitude,
        location.longitude,
        geofence.latitude,
        geofence.longitude
      );

      const isInside = distance <= geofence.radius;
      const wasInside = geofence.metadata?.wasInside || false;

      // Update evaluation timestamp
      geofence.lastEvaluated = location.timestamp;

      if (isInside && !wasInside && geofence.notifyOnEntry) {
        // Entry event
        const event: OfflineEvent = {
          id: this.generateEventId(),
          type: 'enter',
          regionId: geofence.id,
          location,
          timestamp: location.timestamp,
          synced: false
        };
        
        events.push(event);
        this.pendingEvents.push(event);
        
        // Update state
        geofence.metadata = { ...geofence.metadata, wasInside: true };
      } else if (!isInside && wasInside && geofence.notifyOnExit) {
        // Exit event
        const event: OfflineEvent = {
          id: this.generateEventId(),
          type: 'exit',
          regionId: geofence.id,
          location,
          timestamp: location.timestamp,
          synced: false
        };
        
        events.push(event);
        this.pendingEvents.push(event);
        
        // Update state
        geofence.metadata = { ...geofence.metadata, wasInside: false };
      }
    }

    // Trigger sync if we have network and events
    if (events.length > 0 && this.networkStatus.isConnected) {
      this.scheduleSyncAttempt();
    }

    return events;
  }

  // Network Management
  updateNetworkStatus(status: Partial<NetworkStatus>): void {
    const wasConnected = this.networkStatus.isConnected;
    this.networkStatus = { ...this.networkStatus, ...status };

    if (!wasConnected && this.networkStatus.isConnected) {
      // Network became available
      this.networkStatus.lastConnected = Date.now();
      this.scheduleSyncAttempt();
    }
  }

  getNetworkStatus(): NetworkStatus {
    return { ...this.networkStatus };
  }

  // Sync Management
  addSyncCallback(callback: (events: OfflineEvent[]) => Promise<void>): void {
    this.syncCallbacks.push(callback);
  }

  removeSyncCallback(callback: (events: OfflineEvent[]) => Promise<void>): void {
    const index = this.syncCallbacks.indexOf(callback);
    if (index > -1) {
      this.syncCallbacks.splice(index, 1);
    }
  }

  async syncPendingEvents(): Promise<{ success: boolean; synced: number; failed: number }> {
    if (this.syncInProgress || !this.networkStatus.isConnected) {
      return { success: false, synced: 0, failed: 0 };
    }

    this.syncInProgress = true;

    try {
      const unsyncedEvents = this.pendingEvents.filter(e => !e.synced);
      if (unsyncedEvents.length === 0) {
        return { success: true, synced: 0, failed: 0 };
      }

      let syncedCount = 0;
      let failedCount = 0;

      // Batch events for efficient sync
      const batches = this.batchEvents(unsyncedEvents);

      for (const batch of batches) {
        try {
          // Call all sync callbacks
          await Promise.all(
            this.syncCallbacks.map(callback => callback(batch))
          );

          // Mark events as synced
          batch.forEach(event => {
            event.synced = true;
            syncedCount++;
          });
        } catch (error) {
          console.error('Batch sync failed:', error);
          failedCount += batch.length;
        }
      }

      // Remove synced events from pending list
      this.pendingEvents = this.pendingEvents.filter(e => !e.synced);

      return { success: syncedCount > 0, synced: syncedCount, failed: failedCount };
    } finally {
      this.syncInProgress = false;
    }
  }

  getPendingEvents(): OfflineEvent[] {
    return [...this.pendingEvents];
  }

  getPendingEventsCount(): number {
    return this.pendingEvents.filter(e => !e.synced).length;
  }

  clearSyncedEvents(): void {
    this.pendingEvents = this.pendingEvents.filter(e => !e.synced);
  }

  // Force immediate sync attempt
  async forceSyncAttempt(): Promise<{ success: boolean; synced: number; failed: number }> {
    return this.syncPendingEvents();
  }

  // Batch Management
  private batchEvents(events: OfflineEvent[], batchSize: number = 50): OfflineEvent[][] {
    const batches: OfflineEvent[][] = [];
    
    for (let i = 0; i < events.length; i += batchSize) {
      batches.push(events.slice(i, i + batchSize));
    }
    
    return batches;
  }

  // Retry Logic
  private scheduleSyncAttempt(delay: number = 1000): void {
    if (this.syncInProgress) return;

    const timeout: any = setTimeout(async () => {
      this.retryTimeouts.delete(timeout);
      
      try {
        const result = await this.syncPendingEvents();
        
        // If sync failed and we still have pending events, schedule retry with backoff
        if (!result.success && this.getPendingEventsCount() > 0) {
          const nextDelay = Math.min(delay * 2, 60000); // Max 1 minute
          this.scheduleSyncAttempt(nextDelay);
        }
      } catch (error) {
        console.error('Sync attempt failed:', error);
        
        // Schedule retry with exponential backoff
        const nextDelay = Math.min(delay * 2, 60000);
        this.scheduleSyncAttempt(nextDelay);
      }
    }, delay);

    this.retryTimeouts.add(timeout);
  }

  // Utility Methods
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private generateEventId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Network Monitoring Setup
  private setupNetworkMonitoring(): void {
    // This would integrate with React Native's NetInfo
    // For now, we'll simulate network status updates
    if (typeof globalThis !== 'undefined' && (globalThis as any).navigator) {
      const nav = (globalThis as any).navigator;
      if (typeof (globalThis as any).addEventListener === 'function') {
        (globalThis as any).addEventListener('online', () => {
          this.updateNetworkStatus({
            isConnected: true,
            connectionType: 'wifi' // Simplified assumption
          });
        });

        (globalThis as any).addEventListener('offline', () => {
          this.updateNetworkStatus({
            isConnected: false,
            connectionType: 'none'
          });
        });
      }

      // Initial status
      this.updateNetworkStatus({
        isConnected: nav.onLine || true,
        connectionType: nav.onLine ? 'wifi' : 'none'
      });
    }
  }

  // Periodic Sync Setup
  private setupPeriodicSync(): void {
    // Attempt sync every 30 seconds if we have pending events
    setInterval(() => {
      if (this.getPendingEventsCount() > 0 && this.networkStatus.isConnected) {
        this.scheduleSyncAttempt();
      }
    }, 30000);
  }

  // Advanced Features

  // Intelligent Batching Based on Network Quality
  getBatchSizeForNetwork(): number {
    if (!this.networkStatus.isConnected) return 0;
    
    if (this.networkStatus.connectionType === 'wifi') {
      return 100; // Larger batches on WiFi
    } else if (this.networkStatus.isExpensive) {
      return 10; // Smaller batches on expensive connections
    } else {
      return 50; // Default for cellular
    }
  }

  // Priority-based Event Queuing
  prioritizeEvents(): OfflineEvent[] {
    const events = this.pendingEvents.filter(e => !e.synced);
    
    // Sort by timestamp (oldest first) and then by event type (entries before exits)
    return events.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }
      // Prioritize entry events
      if (a.type === 'enter' && b.type === 'exit') return -1;
      if (a.type === 'exit' && b.type === 'enter') return 1;
      return 0;
    });
  }

  // Data Compression for Bandwidth Optimization
  compressEvents(events: OfflineEvent[]): string {
    // Simple compression by removing redundant data
    const compressed = events.map(event => ({
      i: event.id,
      t: event.type === 'enter' ? 1 : 0,
      r: event.regionId,
      lat: Math.round(event.location.latitude * 1000000) / 1000000,
      lng: Math.round(event.location.longitude * 1000000) / 1000000,
      ts: event.timestamp
    }));
    
    return JSON.stringify(compressed);
  }

  decompressEvents(compressed: string): OfflineEvent[] {
    const data = JSON.parse(compressed);
    
    return data.map((item: any) => ({
      id: item.i,
      type: item.t === 1 ? 'enter' : 'exit',
      regionId: item.r,
      location: {
        latitude: item.lat,
        longitude: item.lng,
        timestamp: item.ts
      },
      timestamp: item.ts,
      synced: false
    }));
  }

  // Statistics and Monitoring
  getStatistics(): {
    totalGeofences: number;
    activeGeofences: number;
    pendingEvents: number;
    syncedEvents: number;
    lastSyncAttempt: number;
    networkStatus: NetworkStatus;
  } {
    const syncedEvents = this.pendingEvents.filter(e => e.synced).length;
    
    return {
      totalGeofences: this.geofences.size,
      activeGeofences: this.getActiveGeofences().length,
      pendingEvents: this.getPendingEventsCount(),
      syncedEvents,
      lastSyncAttempt: this.networkStatus.lastConnected,
      networkStatus: this.networkStatus
    };
  }

  // Cleanup and Resource Management
  cleanup(): void {
    // Clear all retry timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    
    // Clear callbacks
    this.syncCallbacks.length = 0;
    
    // Clear data
    this.geofences.clear();
    this.pendingEvents.length = 0;
  }
}