export interface GeofenceRegion {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
}

export interface ActivityRecognitionResult {
  activity: 'still' | 'walking' | 'running' | 'driving' | 'cycling' | 'unknown';
  confidence: number;
  timestamp: number;
}

export interface GeofenceEvent {
  regionId: string;
  eventType: 'enter' | 'exit';
  timestamp: number;
  latitude: number;
  longitude: number;
}

export interface LocationUpdateOptions {
  interval: number;
  fastestInterval: number;
  smallestDisplacement: number;
  priority: 'high_accuracy' | 'balanced' | 'low_power' | 'no_power';
}

export interface SystemStatus {
  locationPermission?: string;
  backgroundRefreshStatus?: string;
  locationServicesEnabled: boolean;
  isMonitoringActive: boolean;
  activeGeofences: number;
  activityRecognitionAvailable?: boolean;
  healthCheckInterval: number;
  isBatteryOptimized?: boolean;
  hasLocationPermission?: boolean;
  hasBackgroundLocationPermission?: boolean;
  hasActivityRecognitionPermission?: boolean;
}

export interface HealthAlert {
  type: string;
  title: string;
  message: string;
  timestamp: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ServiceStatus {
  isMonitoringActive: boolean;
  activeGeofences: number;
  timestamp: number;
}

export interface DeviceInstructions {
  manufacturer: string;
  instructions: string;
  additionalSettings: string;
}

export interface BatteryOptimizationStatus {
  isBatteryOptimized: boolean;
  isLocationEnabled: boolean;
  deviceInstructions: DeviceInstructions;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  isHealthCheck?: boolean;
}

export interface ExpoGeofencingModule {
  // Core geofencing functions
  addGeofence(region: GeofenceRegion): Promise<void>;
  removeGeofence(regionId: string): Promise<void>;
  removeAllGeofences(): Promise<void>;
  getActiveGeofences(): Promise<GeofenceRegion[]>;
  
  // Activity recognition functions
  startActivityRecognition(intervalMs: number): Promise<void>;
  stopActivityRecognition(): Promise<void>;
  
  // Location update functions
  startLocationUpdates(options: LocationUpdateOptions): Promise<void>;
  stopLocationUpdates(): Promise<void>;
  
  // Event listeners
  addGeofenceListener(callback: (event: GeofenceEvent) => void): () => void;
  addActivityListener(callback: (result: ActivityRecognitionResult) => void): () => void;
  addLocationUpdateListener(callback: (location: LocationData) => void): () => void;
  addHealthAlertListener(callback: (alert: HealthAlert) => void): () => void;
  addServiceStatusListener(callback: (status: ServiceStatus) => void): () => void;
  
  // Advanced feature methods
  getDataManager?(): any; // Returns DataManager instance
  getOfflineManager?(): any; // Returns OfflineManager instance
  getSecurityManager?(): any; // Returns SecurityManager instance
  getPolygonManager?(): any; // Returns PolygonGeofenceManager instance
  getWebhookManager?(): any; // Returns WebhookManager instance
  
  // System and health monitoring functions
  checkBatteryOptimization?(): Promise<BatteryOptimizationStatus>;
  requestBatteryOptimizationDisable?(): Promise<boolean>;
  openLocationSettings?(): Promise<void>;
  checkSystemStatus?(): Promise<SystemStatus>;
  requestPermissions?(): Promise<boolean>;
  
  // Health monitoring functions
  setHealthCheckInterval(intervalMs: number): Promise<void>;
  forceLocationCheck(): Promise<LocationData | void>;
  getServiceStatus?(): Promise<SystemStatus>;
}

export { default } from './ExpoGeofencing';

// Export additional managers and utilities
export { DataManager } from './DataManager';
export { OfflineManager } from './OfflineManager';
export { SecurityManager } from './SecurityManager';
export { PolygonGeofenceManager } from './PolygonGeofence';
export { WebhookManager } from './WebhookManager';

// Export types from additional modules
export type {
  GeofenceEvent as StoredGeofenceEvent,
  ActivityEvent,
  SystemHealthEvent,
  AnalyticsData,
  DataManagerConfig
} from './DataManager';

export type {
  OfflineGeofence,
  LocationPoint,
  OfflineEvent,
  NetworkStatus
} from './OfflineManager';

export type {
  PrivacyZone,
  SecurityConfig,
  AuditLogEntry,
  LocationProcessingResult
} from './SecurityManager';

export type {
  Point,
  PolygonGeofenceRegion,
  AdvancedGeofenceRegion,
  TimeBasedRule,
  ConditionalRule
} from './PolygonGeofence';

export type {
  WebhookConfig,
  WebhookEventType,
  WebhookPayload,
  WebhookDeliveryAttempt,
  WebhookStats
} from './WebhookManager';

// Utility functions for validation
export const validateGeofenceRegion = (region: GeofenceRegion): boolean => {
  return (
    region.id.length > 0 &&
    region.latitude >= -90.0 && region.latitude <= 90.0 &&
    region.longitude >= -180.0 && region.longitude <= 180.0 &&
    region.radius > 0 && region.radius <= 10000 // Max 10km radius
  );
};

export const validateLocationUpdateOptions = (options: LocationUpdateOptions): boolean => {
  return (
    options.interval >= 1000 && // Min 1 second
    options.fastestInterval >= 500 && // Min 500ms
    options.smallestDisplacement >= 0 &&
    ['high_accuracy', 'balanced', 'low_power', 'no_power'].includes(options.priority)
  );
};

// Constants
export const HEALTH_CHECK_MIN_INTERVAL = 60000; // 1 minute
export const LOCATION_TIMEOUT_WARNING = 10 * 60 * 1000; // 10 minutes
export const ACCURATE_LOCATION_TIMEOUT_WARNING = 30 * 60 * 1000; // 30 minutes
export const MIN_ACCURACY_METERS = 50;
export const MAX_GEOFENCE_RADIUS = 10000; // 10km

// Additional constants for advanced features
export const DEFAULT_BATCH_SIZE = 50;
export const MAX_RETRY_ATTEMPTS = 3;
export const DEFAULT_ENCRYPTION_KEY_LENGTH = 32;
export const SPATIAL_INDEX_GRID_SIZE = 0.01; // ~1.11 km
export const WEBHOOK_DEFAULT_TIMEOUT = 30000; // 30 seconds
export const DATA_RETENTION_DAYS = 30;