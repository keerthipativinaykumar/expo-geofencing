# 📚 API Reference

Complete API documentation for expo-geofencing package.

## Table of Contents

- [Core Module](#core-module)
- [Geofencing](#geofencing)
- [Activity Recognition](#activity-recognition)
- [Location Updates](#location-updates)
- [Health Monitoring](#health-monitoring)
- [Data Management](#data-management)
- [Security Manager](#security-manager)
- [Webhook Manager](#webhook-manager)
- [Offline Manager](#offline-manager)
- [Polygon Geofence](#polygon-geofence)
- [Types and Interfaces](#types-and-interfaces)

---

## Core Module

### `ExpoGeofencing`

Main module for geofencing and activity recognition.

#### Methods

##### `addGeofence(region: GeofenceRegion): Promise<void>`

Adds a new geofence region for monitoring.

```typescript
import ExpoGeofencing from 'expo-geofencing';

await ExpoGeofencing.addGeofence({
  id: 'home',
  latitude: 37.7749,
  longitude: -122.4194,
  radius: 100,
  notifyOnEntry: true,
  notifyOnExit: true
});
```

**Parameters:**
- `region`: GeofenceRegion object containing geofence configuration

**Returns:** Promise<void>

**Throws:** Error if region parameters are invalid

---

##### `removeGeofence(regionId: string): Promise<void>`

Removes a geofence by ID.

```typescript
await ExpoGeofencing.removeGeofence('home');
```

**Parameters:**
- `regionId`: Unique identifier of the geofence to remove

**Returns:** Promise<void>

---

##### `removeAllGeofences(): Promise<void>`

Removes all active geofences.

```typescript
await ExpoGeofencing.removeAllGeofences();
```

**Returns:** Promise<void>

---

##### `getActiveGeofences(): Promise<GeofenceRegion[]>`

Retrieves all currently active geofences.

```typescript
const activeGeofences = await ExpoGeofencing.getActiveGeofences();
console.log(`Active geofences: ${activeGeofences.length}`);
```

**Returns:** Promise<GeofenceRegion[]>

---

##### `startActivityRecognition(intervalMs: number): Promise<void>`

Starts activity recognition monitoring.

```typescript
await ExpoGeofencing.startActivityRecognition(10000); // 10 seconds
```

**Parameters:**
- `intervalMs`: Update interval in milliseconds (minimum 5000)

**Returns:** Promise<void>

---

##### `stopActivityRecognition(): Promise<void>`

Stops activity recognition monitoring.

```typescript
await ExpoGeofencing.stopActivityRecognition();
```

**Returns:** Promise<void>

---

##### `startLocationUpdates(options: LocationUpdateOptions): Promise<void>`

Starts location updates with specified options.

```typescript
await ExpoGeofencing.startLocationUpdates({
  accuracy: 'high',
  interval: 5000,
  fastestInterval: 2000,
  distanceFilter: 10
});
```

**Parameters:**
- `options`: LocationUpdateOptions configuration

**Returns:** Promise<void>

---

##### `stopLocationUpdates(): Promise<void>`

Stops location updates.

```typescript
await ExpoGeofencing.stopLocationUpdates();
```

**Returns:** Promise<void>

---

#### Event Listeners

##### `addGeofenceListener(callback: (event: GeofenceEvent) => void): () => void`

Listens for geofence entry/exit events.

```typescript
const unsubscribe = ExpoGeofencing.addGeofenceListener((event) => {
  console.log(`Geofence ${event.eventType}: ${event.regionId}`);
});

// Later, unsubscribe
unsubscribe();
```

**Parameters:**
- `callback`: Function to handle geofence events

**Returns:** Function to unsubscribe from events

---

##### `addActivityListener(callback: (result: ActivityRecognitionResult) => void): () => void`

Listens for activity recognition updates.

```typescript
const unsubscribe = ExpoGeofencing.addActivityListener((result) => {
  console.log(`Activity: ${result.activity} (${result.confidence}%)`);
});
```

**Parameters:**
- `callback`: Function to handle activity recognition results

**Returns:** Function to unsubscribe from events

---

##### `addLocationUpdateListener(callback: (location: LocationData) => void): () => void`

Listens for location updates.

```typescript
const unsubscribe = ExpoGeofencing.addLocationUpdateListener((location) => {
  console.log(`Location: ${location.latitude}, ${location.longitude}`);
});
```

**Parameters:**
- `callback`: Function to handle location updates

**Returns:** Function to unsubscribe from events

---

##### `addHealthAlertListener(callback: (alert: HealthAlert) => void): () => void`

Listens for health monitoring alerts.

```typescript
const unsubscribe = ExpoGeofencing.addHealthAlertListener((alert) => {
  console.log(`Health Alert: ${alert.type} - ${alert.message}`);
});
```

**Parameters:**
- `callback`: Function to handle health alerts

**Returns:** Function to unsubscribe from events

---

## Data Management

### `DataManager`

Handles data storage, encryption, and analytics.

#### Constructor

```typescript
const dataManager = new DataManager({
  encryptionEnabled: true,
  maxStorageSize: 10 * 1024 * 1024, // 10MB
  retentionDays: 30
});
```

#### Methods

##### `storeGeofenceEvent(event: Omit<GeofenceEvent, 'id'>): Promise<string>`

Stores a geofence event and returns its ID.

```typescript
const eventId = await dataManager.storeGeofenceEvent({
  regionId: 'home',
  eventType: 'enter',
  timestamp: Date.now(),
  location: { latitude: 37.7749, longitude: -122.4194 }
});
```

---

##### `getGeofenceEvents(filter?: EventFilter): Promise<GeofenceEvent[]>`

Retrieves geofence events with optional filtering.

```typescript
const events = await dataManager.getGeofenceEvents({
  regionId: 'home',
  eventType: 'enter',
  startTime: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
  limit: 100
});
```

---

##### `generateAnalyticsReport(options: AnalyticsOptions): Promise<AnalyticsReport>`

Generates analytics report for geofence events.

```typescript
const report = await dataManager.generateAnalyticsReport({
  timeRange: { start: Date.now() - 7 * 24 * 60 * 60 * 1000, end: Date.now() },
  regionIds: ['home', 'work'],
  includeHeatmap: true
});
```

---

## Security Manager

### `SecurityManager`

Handles security, privacy, and data protection.

#### Constructor

```typescript
const securityManager = new SecurityManager({
  encryptionEnabled: true,
  dataAnonymization: true,
  privacyZonesEnabled: true,
  minAccuracy: 50,
  auditLogging: true
});
```

#### Methods

##### `addPrivacyZone(zone: Omit<PrivacyZone, 'id'>): string`

Adds a privacy zone to protect sensitive locations.

```typescript
const zoneId = securityManager.addPrivacyZone({
  name: 'Hospital Privacy Zone',
  type: 'hospital',
  center: { latitude: 37.7749, longitude: -122.4194 },
  radius: 200,
  bufferZone: 50
});
```

---

##### `processLocation(location: LocationInput): LocationProcessingResult`

Processes location data through security and privacy filters.

```typescript
const result = securityManager.processLocation({
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10,
  userId: 'user123'
});

if (result.allowed) {
  // Use processed location
  const safeLocation = result.processedLocation;
}
```

---

##### `encryptData(data: any): string`

Encrypts sensitive data using AES encryption.

```typescript
const encrypted = securityManager.encryptData({
  userId: 'user123',
  location: { latitude: 37.7749, longitude: -122.4194 }
});
```

---

##### `decryptData<T>(encryptedData: string): T`

Decrypts previously encrypted data.

```typescript
const decrypted = securityManager.decryptData<LocationData>(encrypted);
```

---

## Webhook Manager

### `WebhookManager`

Manages webhook notifications for real-time event delivery.

#### Constructor

```typescript
const webhookManager = new WebhookManager('your-secret-key');
```

#### Methods

##### `addWebhook(config: Omit<WebhookConfig, 'id'>): string`

Adds a new webhook configuration.

```typescript
const webhookId = webhookManager.addWebhook({
  name: 'Geofence Alerts',
  url: 'https://your-server.com/webhook',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  events: ['geofence.enter', 'geofence.exit'],
  retryConfig: {
    maxRetries: 3,
    backoffStrategy: 'exponential',
    baseDelay: 1000,
    maxDelay: 60000
  },
  authConfig: {
    type: 'bearer',
    credentials: { token: 'your-auth-token' }
  }
});
```

---

##### `triggerGeofenceEvent(event: GeofenceEvent): Promise<void>`

Triggers webhook notifications for a geofence event.

```typescript
await webhookManager.triggerGeofenceEvent({
  id: 'event123',
  regionId: 'home',
  eventType: 'enter',
  timestamp: Date.now(),
  location: { latitude: 37.7749, longitude: -122.4194 }
});
```

---

##### `getWebhookStats(webhookId: string): WebhookStats | undefined`

Retrieves statistics for a specific webhook.

```typescript
const stats = webhookManager.getWebhookStats(webhookId);
console.log(`Success rate: ${((stats.successfulDeliveries / stats.totalAttempts) * 100).toFixed(1)}%`);
```

---

## Offline Manager

### `OfflineManager`

Handles offline geofence evaluation and event synchronization.

#### Constructor

```typescript
const offlineManager = new OfflineManager();
```

#### Methods

##### `addGeofence(geofence: GeofenceRegion): void`

Adds a geofence for offline monitoring.

```typescript
offlineManager.addGeofence({
  id: 'home',
  latitude: 37.7749,
  longitude: -122.4194,
  radius: 100,
  notifyOnEntry: true,
  notifyOnExit: true
});
```

---

##### `evaluateLocation(location: LocationPoint): OfflineEvent[]`

Evaluates location against offline geofences.

```typescript
const events = offlineManager.evaluateLocation({
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10,
  timestamp: Date.now()
});

events.forEach(event => {
  console.log(`Offline event: ${event.type} for ${event.regionId}`);
});
```

---

##### `addSyncCallback(callback: (events: OfflineEvent[]) => Promise<void>): void`

Adds a callback for synchronizing offline events.

```typescript
offlineManager.addSyncCallback(async (events) => {
  // Sync events to server
  await sendEventsToServer(events);
});
```

---

## Polygon Geofence

### `PolygonGeofenceManager`

Manages complex polygon-based geofences.

#### Constructor

```typescript
const polygonManager = new PolygonGeofenceManager({
  spatialIndexEnabled: true,
  maxPolygonVertices: 100
});
```

#### Methods

##### `addPolygonGeofence(geofence: Omit<PolygonGeofence, 'id'>): string`

Adds a polygon geofence.

```typescript
const polygonId = polygonManager.addPolygonGeofence({
  name: 'Campus Area',
  vertices: [
    { latitude: 37.7749, longitude: -122.4194 },
    { latitude: 37.7750, longitude: -122.4190 },
    { latitude: 37.7745, longitude: -122.4185 },
    { latitude: 37.7744, longitude: -122.4195 }
  ],
  notifyOnEntry: true,
  notifyOnExit: true
});
```

---

##### `isPointInPolygon(point: Point, polygonId: string): boolean`

Checks if a point is inside a polygon geofence.

```typescript
const isInside = polygonManager.isPointInPolygon(
  { latitude: 37.7748, longitude: -122.4192 },
  polygonId
);
```

---

## Types and Interfaces

### Core Types

#### `GeofenceRegion`

```typescript
interface GeofenceRegion {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
  metadata?: Record<string, any>;
}
```

#### `GeofenceEvent`

```typescript
interface GeofenceEvent {
  id: string;
  regionId: string;
  eventType: 'enter' | 'exit';
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  metadata?: Record<string, any>;
}
```

#### `ActivityRecognitionResult`

```typescript
interface ActivityRecognitionResult {
  activity: 'still' | 'walking' | 'running' | 'driving' | 'cycling' | 'unknown';
  confidence: number;
  timestamp: number;
  metadata?: Record<string, any>;
}
```

#### `LocationUpdateOptions`

```typescript
interface LocationUpdateOptions {
  accuracy: 'low' | 'balanced' | 'high' | 'highest';
  interval: number;
  fastestInterval?: number;
  distanceFilter?: number;
  enableBackgroundMode?: boolean;
}
```

#### `HealthAlert`

```typescript
interface HealthAlert {
  id: string;
  type: 'location_services_disabled' | 'battery_optimized' | 'permissions_revoked' | 'service_crashed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
}
```

### Security Types

#### `PrivacyZone`

```typescript
interface PrivacyZone {
  id: string;
  name: string;
  type: 'hospital' | 'government' | 'school' | 'religious' | 'residential' | 'custom';
  center: { latitude: number; longitude: number };
  radius: number;
  bufferZone?: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}
```

#### `SecurityConfig`

```typescript
interface SecurityConfig {
  encryptionEnabled: boolean;
  encryptionKey?: string;
  dataAnonymization: boolean;
  privacyZonesEnabled: boolean;
  minAccuracy: number;
  locationPrecisionReduction: number;
  auditLogging: boolean;
  sensitiveDataMasking: boolean;
  certificatePinning?: {
    domains: string[];
    certificates: string[];
  };
}
```

### Webhook Types

#### `WebhookConfig`

```typescript
interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  events: WebhookEventType[];
  isActive: boolean;
  retryConfig: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    baseDelay: number;
    maxDelay: number;
  };
  filterConfig?: {
    regions?: string[];
    activities?: string[];
    severities?: string[];
    conditions?: Record<string, any>;
  };
  authConfig?: {
    type: 'none' | 'bearer' | 'api_key' | 'basic' | 'custom';
    credentials: Record<string, string>;
  };
  timeout: number;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}
```

### Data Management Types

#### `DataManagerConfig`

```typescript
interface DataManagerConfig {
  encryptionEnabled: boolean;
  maxStorageSize: number;
  retentionDays: number;
  compressionEnabled: boolean;
  backupEnabled: boolean;
  exportFormats: ('json' | 'csv' | 'kml')[];
}
```

#### `AnalyticsReport`

```typescript
interface AnalyticsReport {
  summary: {
    totalEvents: number;
    uniqueRegions: number;
    timeRange: { start: number; end: number };
    avgDwellTime: number;
    mostActiveRegion: string;
  };
  regionStats: Array<{
    regionId: string;
    enters: number;
    exits: number;
    avgDwellTime: number;
    lastActivity: number;
  }>;
  timeSeriesData: Array<{
    timestamp: number;
    enters: number;
    exits: number;
  }>;
  heatmapData?: Array<{
    latitude: number;
    longitude: number;
    weight: number;
  }>;
}
```

## Error Handling

All async methods may throw errors. Use try-catch blocks:

```typescript
try {
  await ExpoGeofencing.addGeofence(region);
} catch (error) {
  console.error('Failed to add geofence:', error.message);
}
```

Common error types:
- `ValidationError`: Invalid parameters
- `PermissionError`: Missing permissions
- `ServiceError`: Platform service issues
- `NetworkError`: Network connectivity issues

## Best Practices

1. **Always validate geofence regions** before adding them
2. **Handle permissions properly** on both platforms
3. **Use appropriate update intervals** to balance accuracy and battery life
4. **Implement proper error handling** for all async operations
5. **Monitor health alerts** to detect service issues
6. **Use offline manager** for reliable event delivery
7. **Configure security settings** for production use
8. **Set up webhooks** for real-time notifications

---

For more examples and guides, see:
- [Platform-Specific Guides](./PLATFORM_GUIDES.md)
- [Advanced Features](../ADVANCED_FEATURES.md)
- [Production Features](../PRODUCTION_FEATURES.md)