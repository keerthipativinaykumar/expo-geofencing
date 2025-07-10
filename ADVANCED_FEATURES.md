# Advanced Features & Production Readiness

This document covers the advanced features that make expo-geofencing production-ready for reliable, continuous geofencing and activity monitoring.

## 🔋 Battery Optimization & Power Management

### Android Battery Optimization Detection

The package automatically detects and handles battery optimization settings that can kill location tracking:

```typescript
// Check if app is battery optimized
const status = await ExpoGeofencing.checkBatteryOptimization();
console.log('Battery optimized:', status.isBatteryOptimized);
console.log('Device-specific instructions:', status.deviceInstructions);

// Request user to disable battery optimization
await ExpoGeofencing.requestBatteryOptimizationDisable();
```

### Device-Specific Battery Optimization

Supports manufacturer-specific battery optimization handling:

- **Xiaomi**: MIUI optimization, auto-start management
- **Huawei**: Protected apps, startup manager
- **Samsung**: Sleeping apps, never sleeping apps
- **OnePlus**: Auto-launch management
- **OPPO/Vivo**: Background activity manager
- **Generic Android**: Standard battery optimization

## 🏥 Health Monitoring & Self-Healing

### Continuous Location Health Checks

The package includes a sophisticated health monitoring system that runs every 5 minutes (configurable):

```typescript
// Configure health check interval
await ExpoGeofencing.setHealthCheckInterval(5 * 60 * 1000); // 5 minutes

// Listen for health alerts
ExpoGeofencing.addHealthAlertListener((alert) => {
  console.log(`Health Alert: ${alert.title} - ${alert.message}`);
  
  // Handle critical issues
  if (alert.title.includes('Permission Denied')) {
    // Navigate user to permission settings
  }
});
```

### Health Check Features

1. **Location Service Status**: Monitors if location services are enabled
2. **Permission Monitoring**: Detects if permissions are revoked
3. **Location Timeout Detection**: Alerts if no location updates for 10+ minutes
4. **Accuracy Monitoring**: Warns if GPS accuracy is poor for 30+ minutes
5. **Background Refresh Status** (iOS): Monitors background app refresh
6. **Battery Optimization Status** (Android): Continuous monitoring

### Silent Background Notifications

- **Android**: Foreground service with periodic health checks
- **iOS**: Background app refresh with silent notifications
- Automatic recovery attempts when issues are detected

## 🛡️ App Persistence & Anti-Kill Mechanisms

### Android Persistence Features

1. **Foreground Service**: Keeps the app alive with persistent notification
2. **WakeLock Management**: Prevents device from sleeping during critical operations
3. **Service Restart**: Automatically restarts if killed by the system
4. **AlarmManager Integration**: Schedules restarts using system alarms

```kotlin
// Automatic service restart when app is killed
override fun onTaskRemoved(rootIntent: Intent?) {
    // Schedule restart using AlarmManager
    scheduleServiceRestart()
}
```

### iOS Persistence Features

1. **Background Location**: Continuous location updates in background
2. **Background App Refresh**: Scheduled background tasks for health checks
3. **Silent Notifications**: Periodic wake-ups for status verification
4. **Location-Based Wake-ups**: iOS wakes app for geofence events

## 📊 System Status & Monitoring

### Comprehensive Status Monitoring

```typescript
const status = await ExpoGeofencing.checkSystemStatus(); // iOS
// or
const status = await ExpoGeofencing.getServiceStatus(); // Android

console.log('System Status:', {
  isMonitoringActive: status.isMonitoringActive,
  activeGeofences: status.activeGeofences,
  locationServicesEnabled: status.locationServicesEnabled,
  hasLocationPermission: status.hasLocationPermission,
  hasBackgroundLocationPermission: status.hasBackgroundLocationPermission,
  isBatteryOptimized: status.isBatteryOptimized
});
```

### Real-time Service Status Updates

```typescript
ExpoGeofencing.addServiceStatusListener((status) => {
  // Real-time updates when monitoring status changes
  updateUI(status);
});
```

## 🔧 Error Handling & Validation

### Input Validation

All inputs are validated before processing:

```typescript
// Automatic validation for geofence regions
await ExpoGeofencing.addGeofence({
  id: 'test',
  latitude: 37.7749,   // ✅ Valid: -90 to 90
  longitude: -122.4194, // ✅ Valid: -180 to 180
  radius: 100,         // ✅ Valid: 0 to 10000 meters
  notifyOnEntry: true,
  notifyOnExit: true
});

// Throws error for invalid data
await ExpoGeofencing.addGeofence({
  latitude: 91,  // ❌ Invalid: outside valid range
  radius: -10    // ❌ Invalid: negative radius
});
```

### Comprehensive Error Reporting

```typescript
try {
  await ExpoGeofencing.startLocationUpdates(options);
} catch (error) {
  if (error.code === 'PERMISSION_DENIED') {
    // Handle permission issues
    await requestLocationPermissions();
  } else if (error.code === 'BATTERY_OPTIMIZATION_ERROR') {
    // Handle battery optimization
    await showBatteryOptimizationDialog();
  }
}
```

## 🎯 Force Location Checks

Manual location verification for testing and troubleshooting:

```typescript
// Force immediate location check
const location = await ExpoGeofencing.forceLocationCheck();
console.log('Current location:', location);
```

## 📱 Platform-Specific Features

### Android Features

- **FusedLocationProvider**: Battery-efficient location updates
- **Geofencing API**: Native Android geofencing
- **Activity Recognition**: Google Play Services activity detection
- **Battery optimization detection**: Manufacturer-specific handling
- **Doze mode compatibility**: Works in Android's doze mode

### iOS Features

- **Core Location**: Native iOS location services
- **Core Motion**: Activity and motion detection
- **Background processing**: BGTaskScheduler integration
- **Silent notifications**: Background app refresh
- **Location-based background execution**: Automatic wake-ups

## 🚀 Best Practices for Production

### 1. Initialize with Health Monitoring

```typescript
// Start monitoring with health checks enabled
await ExpoGeofencing.addGeofence(region);
await ExpoGeofencing.setHealthCheckInterval(5 * 60 * 1000); // 5 minutes
```

### 2. Handle Battery Optimization (Android)

```typescript
if (Platform.OS === 'android') {
  const status = await ExpoGeofencing.checkBatteryOptimization();
  if (status.isBatteryOptimized) {
    // Show user-friendly dialog with device-specific instructions
    showBatteryOptimizationDialog(status.deviceInstructions);
  }
}
```

### 3. Monitor Health Alerts

```typescript
ExpoGeofencing.addHealthAlertListener((alert) => {
  // Log for analytics
  analytics.track('GeofencingHealthAlert', {
    title: alert.title,
    message: alert.message,
    timestamp: alert.timestamp
  });
  
  // Show user notifications for critical issues
  if (alert.title.includes('Permission') || alert.title.includes('Disabled')) {
    showCriticalAlert(alert);
  }
});
```

### 4. Implement Graceful Degradation

```typescript
try {
  // Try to start full monitoring
  await ExpoGeofencing.startLocationUpdates(highAccuracyOptions);
} catch (error) {
  // Fallback to lower accuracy if high accuracy fails
  await ExpoGeofencing.startLocationUpdates(lowPowerOptions);
}
```

### 5. Regular Status Checks

```typescript
// Check system status periodically
setInterval(async () => {
  const status = await ExpoGeofencing.getServiceStatus();
  if (!status.isMonitoringActive && shouldBeMonitoring) {
    // Restart monitoring if it stopped unexpectedly
    await restartMonitoring();
  }
}, 30 * 60 * 1000); // Every 30 minutes
```

## 📈 Performance & Reliability

### Battery Life Optimization

- **Adaptive intervals**: Automatically adjusts based on device state
- **Smart health checks**: Only check when necessary
- **Efficient wake-ups**: Minimal battery impact
- **Geofence batching**: Optimized for multiple regions

### Reliability Features

- **Automatic recovery**: Self-healing when issues are detected
- **Redundant monitoring**: Multiple layers of location tracking
- **Graceful degradation**: Continues working even with restrictions
- **Comprehensive logging**: Detailed diagnostics for troubleshooting

## 🔍 Troubleshooting

### Common Issues

1. **Geofencing stops working**
   - Check battery optimization status
   - Verify location permissions
   - Monitor health alerts

2. **Inaccurate location updates**
   - Check GPS accuracy in health alerts
   - Force location check to verify current accuracy
   - Consider adjusting location update options

3. **App killed by system**
   - Enable battery optimization whitelist
   - Check device-specific power management settings
   - Monitor service restart events

### Debug Information

```typescript
// Get comprehensive debug information
const debugInfo = {
  systemStatus: await ExpoGeofencing.getServiceStatus(),
  batteryStatus: await ExpoGeofencing.checkBatteryOptimization(),
  currentLocation: await ExpoGeofencing.forceLocationCheck()
};

console.log('Debug Info:', debugInfo);
```

This advanced feature set ensures that expo-geofencing works reliably in production environments, handling the complex challenges of background location tracking on mobile devices.