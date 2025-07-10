# 🚀 Platform-Specific Guides

Platform-specific implementation guides for Android and iOS.

## Table of Contents

- [Android Implementation Guide](#android-implementation-guide)
- [iOS Implementation Guide](#ios-implementation-guide)
- [Cross-Platform Considerations](#cross-platform-considerations)
- [Permissions Setup](#permissions-setup)
- [Troubleshooting](#troubleshooting)

---

## Android Implementation Guide

### 🤖 Android Setup

#### 1. Permissions Configuration

Add required permissions to your `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Location permissions -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />

<!-- Activity recognition -->
<uses-permission android:name="com.google.android.gms.permission.ACTIVITY_RECOGNITION" />

<!-- Network and system -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

<!-- Battery optimization -->
<uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />

<!-- Notifications -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

#### 2. Gradle Dependencies

The package automatically includes necessary Google Play Services dependencies:

```gradle
// Automatically included by expo-geofencing
implementation 'com.google.android.gms:play-services-location:21.0.1'
implementation 'com.google.android.gms:play-services-maps:18.1.0'
implementation 'androidx.work:work-runtime-ktx:2.8.1'
```

#### 3. Background Processing

Android requires careful handling of background processing:

```typescript
import ExpoGeofencing from 'expo-geofencing';

// Request permissions including background location
const requestPermissions = async () => {
  const { status } = await ExpoGeofencing.requestPermissions();
  
  if (status !== 'granted') {
    throw new Error('Location permissions required');
  }
  
  // Check battery optimization status
  const batteryStatus = await ExpoGeofencing.checkBatteryOptimization();
  
  if (batteryStatus.isBatteryOptimized) {
    // Guide user to disable battery optimization
    await ExpoGeofencing.requestBatteryOptimizationDisable();
  }
};
```

#### 4. Battery Optimization Handling

Android's battery optimization can interfere with geofencing. The package provides automatic detection and guidance:

```typescript
// Check battery optimization for major manufacturers
const checkDeviceOptimization = async () => {
  const status = await ExpoGeofencing.checkBatteryOptimization();
  
  console.log('Device:', status.deviceInstructions.manufacturer);
  console.log('Is optimized:', status.isBatteryOptimized);
  console.log('Instructions:', status.deviceInstructions.instructions);
  
  // Manufacturer-specific instructions included for:
  // - Xiaomi (MIUI)
  // - Huawei (EMUI)
  // - Samsung (One UI)
  // - OnePlus (OxygenOS)
  // - Oppo (ColorOS)
  // - Vivo (FunTouch OS)
  // - Realme (Realme UI)
};
```

#### 5. Health Monitoring Setup

Android implementation includes comprehensive health monitoring:

```typescript
// Set up 5-minute health checks
await ExpoGeofencing.setHealthCheckInterval(5 * 60 * 1000);

// Listen for health alerts
const unsubscribe = ExpoGeofencing.addHealthAlertListener((alert) => {
  switch (alert.type) {
    case 'location_services_disabled':
      // Prompt user to enable location services
      ExpoGeofencing.openLocationSettings();
      break;
    case 'battery_optimized':
      // Guide user to battery settings
      ExpoGeofencing.requestBatteryOptimizationDisable();
      break;
    case 'permissions_revoked':
      // Re-request permissions
      ExpoGeofencing.requestPermissions();
      break;
  }
});
```

#### 6. Notification Channels

For Android 8.0+, notification channels are automatically created:

```kotlin
// Automatically handled by the package
private fun createNotificationChannels() {
    val geofenceChannel = NotificationChannel(
        GEOFENCE_CHANNEL_ID,
        "Geofence Notifications",
        NotificationManager.IMPORTANCE_DEFAULT
    )
    
    val healthChannel = NotificationChannel(
        HEALTH_CHANNEL_ID,
        "Health Monitoring",
        NotificationManager.IMPORTANCE_HIGH
    )
}
```

### Android-Specific Features

#### Doze Mode and App Standby

The package automatically handles Android's power management:

- **Doze Mode**: Uses high-priority GCM messages for critical alerts
- **App Standby**: Implements foreground service for continuous monitoring
- **Background App Limits**: Optimized to work within Android's restrictions

#### FusedLocationProvider Integration

Utilizes Google's FusedLocationProvider for optimal battery efficiency:

```kotlin
private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

private val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
    .setWaitForAccurateLocation(false)
    .setMinUpdateIntervalMillis(2000)
    .setMaxUpdateDelayMillis(10000)
    .build()
```

---

## iOS Implementation Guide

### 🍎 iOS Setup

#### 1. Info.plist Configuration

Add required usage descriptions to your `ios/YourApp/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app uses location to provide geofencing notifications when you enter or exit specific areas.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app uses location in the background to monitor geofences and provide location-based notifications.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>This app uses location in the background to monitor geofences and provide location-based notifications.</string>

<key>NSMotionUsageDescription</key>
<string>This app uses motion data to detect your activity type (walking, driving, etc.) for better location services.</string>

<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>background-processing</string>
    <string>background-fetch</string>
</array>
```

#### 2. Core Location Setup

iOS implementation uses Core Location and Core Motion:

```swift
import CoreLocation
import CoreMotion

class ExpoGeofencingModule: NSObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private let motionManager = CMMotionActivityManager()
    
    override init() {
        super.init()
        setupLocationManager()
    }
    
    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
    }
}
```

#### 3. Permission Handling

iOS requires careful permission escalation:

```typescript
import ExpoGeofencing from 'expo-geofencing';

const requestIOSPermissions = async () => {
  // First request when-in-use permission
  let { status } = await ExpoGeofencing.requestPermissions();
  
  if (status === 'granted') {
    // Then request always permission for background geofencing
    status = await ExpoGeofencing.requestAlwaysPermission();
  }
  
  if (status !== 'granted') {
    throw new Error('Always location permission required for geofencing');
  }
};
```

#### 4. Background Task Management

iOS background processing is handled automatically:

```swift
private func scheduleBackgroundTask() {
    let request = BGProcessingTaskRequest(identifier: "com.yourapp.geofence-check")
    request.requiresNetworkConnectivity = true
    request.requiresExternalPower = false
    
    try? BGTaskScheduler.shared.submit(request)
}

func handleBackgroundTask(task: BGProcessingTask) {
    // Perform health check and sync offline events
    task.expirationHandler = {
        task.setTaskCompleted(success: false)
    }
    
    performHealthCheck { success in
        task.setTaskCompleted(success: success)
        self.scheduleBackgroundTask() // Schedule next check
    }
}
```

#### 5. Significant Location Changes

For battery optimization, the package uses significant location changes:

```swift
private func startSignificantLocationChanges() {
    if CLLocationManager.significantLocationChangeMonitoringAvailable() {
        locationManager.startMonitoringSignificantLocationChanges()
    }
}
```

### iOS-Specific Features

#### Region Monitoring Limits

iOS has a limit of 20 monitored regions. The package handles this automatically:

```typescript
// Automatic region management
const addGeofenceWithLimit = async (region: GeofenceRegion) => {
  const activeGeofences = await ExpoGeofencing.getActiveGeofences();
  
  if (activeGeofences.length >= 20) {
    // Automatically removes oldest/least important geofence
    await ExpoGeofencing.removeGeofence(activeGeofences[0].id);
  }
  
  await ExpoGeofencing.addGeofence(region);
};
```

#### Activity Recognition

Uses Core Motion for activity detection:

```swift
private func startActivityRecognition() {
    guard CMMotionActivityManager.isActivityAvailable() else { return }
    
    motionActivityManager.startActivityUpdates(to: OperationQueue.main) { activity in
        guard let activity = activity else { return }
        
        let activityType = self.mapActivityType(activity)
        let confidence = self.calculateConfidence(activity)
        
        self.sendActivityUpdate(activityType, confidence)
    }
}
```

---

## Cross-Platform Considerations

### 🔄 Unified API

The package provides a unified API that handles platform differences automatically:

```typescript
// Works identically on both platforms
await ExpoGeofencing.addGeofence({
  id: 'location',
  latitude: 37.7749,
  longitude: -122.4194,
  radius: 100,
  notifyOnEntry: true,
  notifyOnExit: true
});
```

### Platform Detection

```typescript
import { Platform } from 'react-native';

const platformSpecificSetup = async () => {
  if (Platform.OS === 'android') {
    // Android-specific setup
    const batteryStatus = await ExpoGeofencing.checkBatteryOptimization();
    if (batteryStatus.isBatteryOptimized) {
      await ExpoGeofencing.requestBatteryOptimizationDisable();
    }
  } else if (Platform.OS === 'ios') {
    // iOS-specific setup
    const systemStatus = await ExpoGeofencing.checkSystemStatus();
    if (!systemStatus.locationServicesEnabled) {
      await ExpoGeofencing.openLocationSettings();
    }
  }
};
```

### Feature Parity

| Feature | Android | iOS | Notes |
|---------|---------|-----|-------|
| Circular Geofences | ✅ | ✅ | Full support |
| Polygon Geofences | ✅ | ✅ | Custom implementation |
| Activity Recognition | ✅ | ✅ | Google Play Services / Core Motion |
| Background Monitoring | ✅ | ✅ | Platform-specific optimizations |
| Battery Optimization | ✅ | ⚠️ | Android-specific feature |
| Significant Location | ⚠️ | ✅ | iOS-specific feature |
| Health Monitoring | ✅ | ✅ | Cross-platform implementation |

---

## Permissions Setup

### 🔐 Permission Flow

#### Initial Setup

```typescript
import ExpoGeofencing from 'expo-geofencing';
import { Platform } from 'react-native';

const setupPermissions = async () => {
  try {
    // Check current permission status
    const { status } = await ExpoGeofencing.getPermissions();
    
    if (status === 'undetermined') {
      // Request initial permissions
      const result = await ExpoGeofencing.requestPermissions();
      
      if (result.status !== 'granted') {
        throw new Error('Location permissions denied');
      }
    }
    
    // Platform-specific additional setup
    if (Platform.OS === 'android') {
      await setupAndroidPermissions();
    } else {
      await setupIOSPermissions();
    }
    
    return true;
  } catch (error) {
    console.error('Permission setup failed:', error);
    return false;
  }
};

const setupAndroidPermissions = async () => {
  // Check activity recognition permission (Android 10+)
  const activityPermission = await ExpoGeofencing.getActivityRecognitionPermission();
  if (activityPermission !== 'granted') {
    await ExpoGeofencing.requestActivityRecognitionPermission();
  }
  
  // Check battery optimization
  const batteryStatus = await ExpoGeofencing.checkBatteryOptimization();
  if (batteryStatus.isBatteryOptimized) {
    // Show user instructions
    showBatteryOptimizationDialog(batteryStatus.deviceInstructions);
  }
};

const setupIOSPermissions = async () => {
  // Request always permission for background geofencing
  const alwaysPermission = await ExpoGeofencing.requestAlwaysPermission();
  if (alwaysPermission !== 'granted') {
    // Show user instructions for enabling always permission
    showIOSPermissionDialog();
  }
};
```

#### Permission Monitoring

```typescript
// Monitor permission changes
const permissionSubscription = ExpoGeofencing.addPermissionListener((status) => {
  switch (status.type) {
    case 'location_permission_revoked':
      // Handle location permission revocation
      showPermissionRevokedAlert();
      break;
    case 'background_permission_denied':
      // Handle background permission denial
      showBackgroundPermissionAlert();
      break;
    case 'activity_permission_denied':
      // Handle activity recognition permission denial
      disableActivityRecognition();
      break;
  }
});
```

---

## Troubleshooting

### 🔧 Common Issues

#### Android Issues

**1. Geofences not triggering**
```typescript
// Debug steps
const debugGeofences = async () => {
  // Check if location services are enabled
  const status = await ExpoGeofencing.getServiceStatus();
  console.log('Location services enabled:', status.locationServicesEnabled);
  
  // Check active geofences
  const geofences = await ExpoGeofencing.getActiveGeofences();
  console.log('Active geofences:', geofences.length);
  
  // Force location check
  const location = await ExpoGeofencing.forceLocationCheck();
  console.log('Current location:', location);
  
  // Check battery optimization
  const battery = await ExpoGeofencing.checkBatteryOptimization();
  console.log('Battery optimized:', battery.isBatteryOptimized);
};
```

**2. App killed by system**
- Ensure battery optimization is disabled
- Add app to auto-start list (manufacturer-specific)
- Use foreground service notification

**3. Location accuracy issues**
- Check GPS/Location settings
- Verify location permissions
- Test in open area away from buildings

#### iOS Issues

**1. Background location not working**
```typescript
// Check iOS-specific status
const checkIOSStatus = async () => {
  const status = await ExpoGeofencing.checkSystemStatus();
  console.log('Background app refresh:', status.backgroundAppRefreshEnabled);
  console.log('Location services:', status.locationServicesEnabled);
  console.log('Always permission:', status.alwaysLocationPermission);
};
```

**2. Region limit exceeded**
- iOS limits to 20 monitored regions
- Package automatically manages this limit
- Use region priority system

**3. Activity recognition not accurate**
- Check motion permission
- Test with actual movement
- Verify Core Motion availability

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
// Enable debug mode
ExpoGeofencing.setDebugMode(true);

// Monitor debug events
ExpoGeofencing.addDebugListener((event) => {
  console.log('Debug:', event.type, event.data);
});
```

### Health Monitoring

Set up comprehensive health monitoring:

```typescript
// Monitor system health
const setupHealthMonitoring = async () => {
  // Set 5-minute health check interval
  await ExpoGeofencing.setHealthCheckInterval(5 * 60 * 1000);
  
  // Listen for health alerts
  ExpoGeofencing.addHealthAlertListener((alert) => {
    console.warn('Health Alert:', alert.type, alert.message);
    
    // Handle different alert types
    switch (alert.type) {
      case 'location_services_disabled':
        // Prompt user to enable location services
        break;
      case 'battery_optimized':
        // Guide to battery settings
        break;
      case 'permissions_revoked':
        // Re-request permissions
        break;
      case 'service_crashed':
        // Restart services
        break;
    }
  });
};
```

### Performance Optimization

```typescript
// Optimize for battery life
const optimizeForBattery = async () => {
  await ExpoGeofencing.startLocationUpdates({
    accuracy: 'balanced', // Not 'highest'
    interval: 30000, // 30 seconds instead of 5
    distanceFilter: 50 // Only update every 50 meters
  });
};

// Optimize for accuracy
const optimizeForAccuracy = async () => {
  await ExpoGeofencing.startLocationUpdates({
    accuracy: 'highest',
    interval: 5000, // 5 seconds
    distanceFilter: 5 // Update every 5 meters
  });
};
```

---

For more detailed platform documentation, refer to:
- [Android Developer Docs - Location](https://developer.android.com/guide/topics/location)
- [iOS Developer Docs - Core Location](https://developer.apple.com/documentation/corelocation)
- [Expo Location Documentation](https://docs.expo.dev/versions/latest/sdk/location/)