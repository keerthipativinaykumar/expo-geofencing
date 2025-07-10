# 🧭 Expo Geofencing

[![npm version](https://badge.fury.io/js/expo-geofencing.svg)](https://badge.fury.io/js/expo-geofencing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

**Production-ready geofencing and activity recognition for Expo React Native** with enterprise-grade features including offline support, security, health monitoring, and comprehensive analytics.

## ✨ Features

### 🧭 **Advanced Geofencing**
- **Circular & Polygon Geofences**: Support for complex shaped regions
- **Time-Based Activation**: Geofences active only during specific hours/days
- **Conditional Rules**: Weather, traffic, or custom condition-based triggers
- **Hierarchical Geofences**: Parent-child relationships with inheritance
- **Spatial Indexing**: Optimized for thousands of geofences

### 🏃 **Activity Recognition**
- **Motion Detection**: Still, walking, running, driving, cycling
- **Confidence Levels**: High-accuracy activity classification
- **Configurable Intervals**: Customizable detection frequency

### ⚡ **Power-Efficient Location**
- **FusedLocationProvider**: Battery-optimized on Android
- **Adaptive Accuracy**: Dynamic GPS precision based on context
- **Background Optimization**: Minimal battery impact

### 🔋 **Production-Ready Reliability**
- **Battery Optimization Handling**: Device-specific power management
- **Health Monitoring**: Continuous service monitoring with alerts
- **App Persistence**: Anti-kill mechanisms and automatic recovery
- **Silent Notifications**: Background health checks every 5 minutes

### 🌐 **Offline & Network Recovery**
- **Offline Geofence Evaluation**: Works without internet connectivity
- **Event Queuing**: Automatic sync when network returns
- **Intelligent Batching**: Bandwidth optimization
- **Retry Logic**: Exponential backoff with failure recovery

### 🔒 **Security & Privacy**
- **End-to-End Encryption**: AES encryption for sensitive data
- **Privacy Zones**: Automatic exclusion of hospitals, government buildings
- **Data Anonymization**: Differential privacy and precision reduction
- **Audit Logging**: Immutable trail with integrity verification

### 📊 **Enterprise Features**
- **Real-time Webhooks**: Instant notifications to external systems
- **Analytics & Reporting**: Comprehensive insights and data export
- **Compliance Ready**: GDPR/CCPA compliant with consent management
- **Performance Monitoring**: System health and delivery statistics

## 🚀 Quick Start

### Installation

```bash
npm install expo-geofencing
```

### Plugin Configuration

Add the plugin to your `app.json` or `app.config.js`:

```json
{
  \"expo\": {
    \"plugins\": [\"expo-geofencing/plugin\"]
  }
}
```

### Basic Usage

```typescript
import ExpoGeofencing from 'expo-geofencing';
import * as Location from 'expo-location';

// Request permissions
await Location.requestForegroundPermissionsAsync();
await Location.requestBackgroundPermissionsAsync();

// Add a geofence
await ExpoGeofencing.addGeofence({
  id: 'home',
  latitude: 37.7749,
  longitude: -122.4194,
  radius: 100,
  notifyOnEntry: true,
  notifyOnExit: true,
});

// Listen for events
const unsubscribe = ExpoGeofencing.addGeofenceListener((event) => {
  console.log(`${event.eventType} region: ${event.regionId}`);
});

// Start monitoring with health checks
await ExpoGeofencing.setHealthCheckInterval(5 * 60 * 1000); // 5 minutes
```

## 📱 Advanced Features

### 🔋 Battery Optimization (Android)

```typescript
// Check if battery optimization is enabled
const status = await ExpoGeofencing.checkBatteryOptimization();
if (status.isBatteryOptimized) {
  // Show device-specific instructions
  console.log(status.deviceInstructions);
  
  // Request to disable optimization
  await ExpoGeofencing.requestBatteryOptimizationDisable();
}
```

### 🏥 Health Monitoring

```typescript
// Listen for health alerts
ExpoGeofencing.addHealthAlertListener((alert) => {
  console.log(`Health Alert: ${alert.title}`);
  if (alert.title.includes('Permission Denied')) {
    // Handle permission issues
  }
});

// Force location check for testing
const location = await ExpoGeofencing.forceLocationCheck();
```

### 🗺️ Polygon Geofences

```typescript
import { PolygonGeofenceManager } from 'expo-geofencing';

const polygonManager = new PolygonGeofenceManager();

// Add complex shaped geofence
polygonManager.addGeofence({
  id: 'shopping-center',
  type: 'polygon',
  vertices: [
    { latitude: 37.7749, longitude: -122.4194 },
    { latitude: 37.7759, longitude: -122.4184 },
    { latitude: 37.7739, longitude: -122.4174 }
  ],
  notifyOnEntry: true,
  notifyOnExit: true,
  timeRules: [{
    id: 'business-hours',
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday
    isActive: true
  }]
});
```

### 🌐 Offline Support

```typescript
import { OfflineManager } from 'expo-geofencing';

const offlineManager = new OfflineManager();

// Add geofences for offline evaluation
offlineManager.addGeofence(geofenceRegion);

// Evaluate location even when offline
const events = offlineManager.evaluateLocation({
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10,
  timestamp: Date.now()
});

// Sync when network returns
await offlineManager.syncPendingEvents();
```

### 🔗 Webhooks Integration

```typescript
import { WebhookManager } from 'expo-geofencing';

const webhookManager = new WebhookManager();

// Add webhook for real-time notifications
webhookManager.addWebhook({
  name: 'Geofence Alerts',
  url: 'https://api.example.com/webhooks/geofence',
  method: 'POST',
  events: ['geofence.enter', 'geofence.exit'],
  authConfig: {
    type: 'bearer',
    credentials: { token: 'your-api-token' }
  },
  retryConfig: {
    maxRetries: 3,
    backoffStrategy: 'exponential'
  }
});
```

### 📊 Analytics & Data Management

```typescript
import { DataManager } from 'expo-geofencing';

const dataManager = new DataManager({
  encryptData: true,
  retentionDays: 30,
  anonymizeData: true
});

// Generate analytics
const analytics = await dataManager.generateAnalytics();
console.log('Total events:', analytics.summary.totalEvents);

// Export data for compliance
const csvData = await dataManager.exportData('csv', {
  start: Date.now() - 30 * 24 * 60 * 60 * 1000, // Last 30 days
  end: Date.now()
});
```

### 🔒 Security & Privacy

```typescript
import { SecurityManager } from 'expo-geofencing';

const securityManager = new SecurityManager({
  encryptionEnabled: true,
  privacyZonesEnabled: true,
  dataAnonymization: true
});

// Add privacy zone around hospital
securityManager.addPrivacyZone({
  name: 'Hospital Privacy Zone',
  type: 'hospital',
  center: { latitude: 37.7749, longitude: -122.4194 },
  radius: 200,
  bufferZone: 50
});

// Process location with privacy protection
const result = securityManager.processLocation({
  latitude: 37.7749,
  longitude: -122.4194,
  accuracy: 10
});
```

## 🛠️ API Reference

### Core Methods

```typescript
// Geofence Management
addGeofence(region: GeofenceRegion): Promise<void>
removeGeofence(regionId: string): Promise<void>
removeAllGeofences(): Promise<void>

// Activity Recognition
startActivityRecognition(intervalMs: number): Promise<void>
stopActivityRecognition(): Promise<void>

// Location Updates
startLocationUpdates(options: LocationUpdateOptions): Promise<void>
stopLocationUpdates(): Promise<void>

// Event Listeners
addGeofenceListener(callback: (event: GeofenceEvent) => void): () => void
addActivityListener(callback: (result: ActivityRecognitionResult) => void): () => void
addHealthAlertListener(callback: (alert: HealthAlert) => void): () => void

// Health & Monitoring
setHealthCheckInterval(intervalMs: number): Promise<void>
forceLocationCheck(): Promise<LocationData>
getServiceStatus(): Promise<SystemStatus>

// Android-specific
checkBatteryOptimization(): Promise<BatteryOptimizationStatus>
requestBatteryOptimizationDisable(): Promise<boolean>
openLocationSettings(): Promise<void>

// iOS-specific
checkSystemStatus(): Promise<SystemStatus>
requestPermissions(): Promise<boolean>
```

### TypeScript Interfaces

```typescript
interface GeofenceRegion {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEntry: boolean;
  notifyOnExit: boolean;
}

interface ActivityRecognitionResult {
  activity: 'still' | 'walking' | 'running' | 'driving' | 'cycling' | 'unknown';
  confidence: number;
  timestamp: number;
}

interface GeofenceEvent {
  regionId: string;
  eventType: 'enter' | 'exit';
  timestamp: number;
  latitude: number;
  longitude: number;
}

interface HealthAlert {
  type: string;
  title: string;
  message: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

## 📋 Requirements

- **Expo SDK**: 49.0.0+
- **React Native**: 0.72.0+
- **Node.js**: 16.0.0+
- **Android**: API level 21+ (Android 5.0+)
- **iOS**: iOS 13.0+

## 🔑 Permissions

### Android
- `ACCESS_FINE_LOCATION`: Location-based features
- `ACCESS_BACKGROUND_LOCATION`: Background geofencing
- `ACTIVITY_RECOGNITION`: Activity detection
- `WAKE_LOCK`: Background processing
- `FOREGROUND_SERVICE`: Persistent monitoring

### iOS
- `NSLocationWhenInUseUsageDescription`: Location access
- `NSLocationAlwaysAndWhenInUseUsageDescription`: Background location
- `NSMotionUsageDescription`: Activity recognition
- Background mode: `location` for background geofencing

## 🏗️ Platform Support

- ✅ **Android**: Full support using Google Play Services
- ✅ **iOS**: Full support using Core Location and Core Motion
- ❌ **Web**: Not supported (native services required)

## 📚 Documentation

- [Advanced Features Guide](./ADVANCED_FEATURES.md)
- [Production Features Overview](./PRODUCTION_FEATURES.md)
- [API Reference](./docs/api.md)
- [Platform-Specific Guides](./docs/platform-guides.md)

## 🎯 Use Cases

### Healthcare
- HIPAA-compliant patient tracking
- Hospital privacy zones
- Emergency response geofencing

### Retail & Marketing
- Store entry/exit tracking
- Promotional campaign triggers
- Customer analytics

### Logistics & Fleet
- Vehicle tracking with offline capability
- Route optimization
- Delivery confirmation

### Smart Cities
- Public transportation alerts
- Environmental monitoring
- Emergency services coordination

### Security & Compliance
- Restricted area monitoring
- Audit trail generation
- Regulatory compliance reporting

## 🔧 Troubleshooting

### Android Issues

1. **Geofencing not working**
   - Ensure Google Play Services is installed
   - Check battery optimization settings
   - Verify location permissions

2. **App getting killed**
   - Disable battery optimization for your app
   - Check device-specific power management settings
   - Enable \"Don't optimize\" in battery settings

### iOS Issues

1. **Background location not working**
   - Ensure \"Always\" location permission
   - Enable background app refresh
   - Check iOS location privacy settings

2. **Activity recognition failing**
   - Verify motion permissions granted
   - Check device compatibility
   - Ensure iOS 13.0+ for background tasks

### General Issues

1. **Poor location accuracy**
   - Check GPS signal strength
   - Adjust location update options
   - Monitor health alerts for accuracy warnings

2. **High battery usage**
   - Increase health check intervals
   - Use lower accuracy for non-critical features
   - Monitor battery usage analytics

## 🏢 Enterprise Support

For enterprise deployments requiring:
- Custom integrations
- Extended support
- Professional services
- Volume licensing

Contact: support@expo-geofencing.dev

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Expo Modules API](https://docs.expo.dev/modules/)
- Powered by [Google Play Services](https://developers.google.com/android/guides/setup) on Android
- Uses [Core Location](https://developer.apple.com/documentation/corelocation) on iOS
- Inspired by the React Native community

## 📊 Comparison with Alternatives

| Feature | expo-geofencing | expo-location | Other Libraries |
|---------|-----------------|---------------|-----------------|
| Circular Geofences | ✅ | ❌ | ⚠️ |
| Polygon Geofences | ✅ | ❌ | ❌ |
| Activity Recognition | ✅ | ❌ | ❌ |
| Offline Support | ✅ | ❌ | ❌ |
| Health Monitoring | ✅ | ❌ | ❌ |
| Battery Optimization | ✅ | ❌ | ❌ |
| Security Features | ✅ | ❌ | ❌ |
| Enterprise Ready | ✅ | ❌ | ⚠️ |
| Webhook Integration | ✅ | ❌ | ❌ |
| Analytics & Reporting | ✅ | ❌ | ❌ |

---

**Made with ❤️ for the Expo and React Native community**