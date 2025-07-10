# 🚀 Basic Examples

Simple implementation examples to get you started with expo-geofencing.

## Table of Contents

- [Quick Start](#quick-start)
- [Basic Geofencing](#basic-geofencing)
- [Activity Recognition](#activity-recognition)
- [Location Updates](#location-updates)
- [Event Handling](#event-handling)
- [Permission Management](#permission-management)

---

## Quick Start

### 🏃‍♂️ Minimal Setup

```typescript
import React, { useEffect } from 'react';
import ExpoGeofencing from 'expo-geofencing';

export default function App() {
  useEffect(() => {
    setupGeofencing();
  }, []);

  const setupGeofencing = async () => {
    try {
      // Request permissions
      const { status } = await ExpoGeofencing.requestPermissions();
      if (status !== 'granted') {
        console.error('Location permissions not granted');
        return;
      }

      // Add a simple geofence
      await ExpoGeofencing.addGeofence({
        id: 'home',
        latitude: 37.7749,
        longitude: -122.4194,
        radius: 100,
        notifyOnEntry: true,
        notifyOnExit: true
      });

      // Listen for geofence events
      ExpoGeofencing.addGeofenceListener((event) => {
        console.log(`${event.eventType} geofence: ${event.regionId}`);
      });

      console.log('Geofencing setup complete!');
    } catch (error) {
      console.error('Setup failed:', error);
    }
  };

  return (
    // Your app UI here
    <div>Geofencing Active</div>
  );
}
```

---

## Basic Geofencing

### 📍 Single Geofence

```typescript
import ExpoGeofencing, { GeofenceRegion } from 'expo-geofencing';

const addHomeGeofence = async () => {
  const homeGeofence: GeofenceRegion = {
    id: 'home',
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 100, // 100 meters
    notifyOnEntry: true,
    notifyOnExit: true,
    metadata: {
      name: 'Home',
      description: 'My house location'
    }
  };

  try {
    await ExpoGeofencing.addGeofence(homeGeofence);
    console.log('Home geofence added successfully');
  } catch (error) {
    console.error('Failed to add geofence:', error);
  }
};
```

### 🏢 Multiple Geofences

```typescript
const addMultipleGeofences = async () => {
  const locations = [
    {
      id: 'home',
      name: 'Home',
      latitude: 37.7749,
      longitude: -122.4194,
      radius: 100
    },
    {
      id: 'work',
      name: 'Office',
      latitude: 37.7849,
      longitude: -122.4094,
      radius: 150
    },
    {
      id: 'gym',
      name: 'Gym',
      latitude: 37.7649,
      longitude: -122.4294,
      radius: 75
    }
  ];

  for (const location of locations) {
    try {
      await ExpoGeofencing.addGeofence({
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
        radius: location.radius,
        notifyOnEntry: true,
        notifyOnExit: true,
        metadata: { name: location.name }
      });
      
      console.log(`Added geofence: ${location.name}`);
    } catch (error) {
      console.error(`Failed to add ${location.name}:`, error);
    }
  }
};
```

### 🔄 Managing Geofences

```typescript
// List all active geofences
const listGeofences = async () => {
  try {
    const geofences = await ExpoGeofencing.getActiveGeofences();
    console.log('Active geofences:', geofences.length);
    
    geofences.forEach(geofence => {
      console.log(`- ${geofence.id}: ${geofence.metadata?.name || 'Unnamed'}`);
    });
  } catch (error) {
    console.error('Failed to list geofences:', error);
  }
};

// Remove a specific geofence
const removeGeofence = async (regionId: string) => {
  try {
    await ExpoGeofencing.removeGeofence(regionId);
    console.log(`Removed geofence: ${regionId}`);
  } catch (error) {
    console.error(`Failed to remove geofence ${regionId}:`, error);
  }
};

// Remove all geofences
const clearAllGeofences = async () => {
  try {
    await ExpoGeofencing.removeAllGeofences();
    console.log('All geofences removed');
  } catch (error) {
    console.error('Failed to remove all geofences:', error);
  }
};
```

---

## Activity Recognition

### 🏃 Basic Activity Monitoring

```typescript
import { ActivityRecognitionResult } from 'expo-geofencing';

const startActivityMonitoring = async () => {
  try {
    // Start activity recognition (update every 10 seconds)
    await ExpoGeofencing.startActivityRecognition(10000);
    
    // Listen for activity changes
    const unsubscribe = ExpoGeofencing.addActivityListener((result: ActivityRecognitionResult) => {
      console.log(`Activity: ${result.activity}`);
      console.log(`Confidence: ${result.confidence}%`);
      console.log(`Timestamp: ${new Date(result.timestamp).toLocaleString()}`);
      
      // Handle different activities
      handleActivityChange(result);
    });
    
    console.log('Activity recognition started');
    return unsubscribe;
  } catch (error) {
    console.error('Failed to start activity recognition:', error);
  }
};

const handleActivityChange = (result: ActivityRecognitionResult) => {
  switch (result.activity) {
    case 'still':
      console.log('User is stationary');
      break;
    case 'walking':
      console.log('User is walking');
      break;
    case 'running':
      console.log('User is running');
      break;
    case 'driving':
      console.log('User is driving');
      break;
    case 'cycling':
      console.log('User is cycling');
      break;
    default:
      console.log('Unknown activity detected');
  }
};

// Stop activity recognition
const stopActivityMonitoring = async () => {
  try {
    await ExpoGeofencing.stopActivityRecognition();
    console.log('Activity recognition stopped');
  } catch (error) {
    console.error('Failed to stop activity recognition:', error);
  }
};
```

### 📊 Activity-Based Geofencing

```typescript
let currentActivity: string = 'unknown';

const setupActivityBasedGeofencing = async () => {
  // Monitor activity first
  ExpoGeofencing.addActivityListener((result) => {
    currentActivity = result.activity;
    
    // Adjust geofence behavior based on activity
    if (result.activity === 'driving' && result.confidence > 75) {
      // Increase radius for driving (less precise)
      updateGeofenceForDriving();
    } else if (result.activity === 'walking' && result.confidence > 75) {
      // Decrease radius for walking (more precise)
      updateGeofenceForWalking();
    }
  });
};

const updateGeofenceForDriving = async () => {
  // Larger radius for driving
  await ExpoGeofencing.addGeofence({
    id: 'home_driving',
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 200, // Larger radius
    notifyOnEntry: true,
    notifyOnExit: true
  });
};

const updateGeofenceForWalking = async () => {
  // Smaller radius for walking
  await ExpoGeofencing.addGeofence({
    id: 'home_walking',
    latitude: 37.7749,
    longitude: -122.4194,
    radius: 50, // Smaller radius
    notifyOnEntry: true,
    notifyOnExit: true
  });
};
```

---

## Location Updates

### 📍 Basic Location Monitoring

```typescript
import { LocationUpdateOptions, LocationData } from 'expo-geofencing';

const startLocationUpdates = async () => {
  const options: LocationUpdateOptions = {
    accuracy: 'high',
    interval: 5000, // Update every 5 seconds
    fastestInterval: 2000, // Fastest update rate
    distanceFilter: 10, // Only update if moved 10+ meters
    enableBackgroundMode: true
  };

  try {
    await ExpoGeofencing.startLocationUpdates(options);
    
    const unsubscribe = ExpoGeofencing.addLocationUpdateListener((location: LocationData) => {
      console.log(`Location: ${location.latitude}, ${location.longitude}`);
      console.log(`Accuracy: ${location.accuracy}m`);
      console.log(`Speed: ${location.speed || 0} m/s`);
      
      // Process location update
      handleLocationUpdate(location);
    });
    
    console.log('Location updates started');
    return unsubscribe;
  } catch (error) {
    console.error('Failed to start location updates:', error);
  }
};

const handleLocationUpdate = (location: LocationData) => {
  // Store location for analytics
  storeLocationPoint(location);
  
  // Check if user is near any point of interest
  checkNearbyPOIs(location);
};

// Stop location updates
const stopLocationUpdates = async () => {
  try {
    await ExpoGeofencing.stopLocationUpdates();
    console.log('Location updates stopped');
  } catch (error) {
    console.error('Failed to stop location updates:', error);
  }
};
```

### ⚙️ Adaptive Location Settings

```typescript
const setupAdaptiveLocationUpdates = async () => {
  // Start with balanced settings
  let currentOptions: LocationUpdateOptions = {
    accuracy: 'balanced',
    interval: 15000, // 15 seconds
    distanceFilter: 25 // 25 meters
  };

  await ExpoGeofencing.startLocationUpdates(currentOptions);

  // Adjust based on activity
  ExpoGeofencing.addActivityListener((result) => {
    if (result.confidence > 70) {
      switch (result.activity) {
        case 'still':
          // Reduce frequency when stationary
          updateLocationSettings({
            accuracy: 'low',
            interval: 60000, // 1 minute
            distanceFilter: 100 // 100 meters
          });
          break;
          
        case 'driving':
          // Increase frequency when driving
          updateLocationSettings({
            accuracy: 'high',
            interval: 5000, // 5 seconds
            distanceFilter: 50 // 50 meters
          });
          break;
          
        case 'walking':
          // Moderate settings for walking
          updateLocationSettings({
            accuracy: 'balanced',
            interval: 10000, // 10 seconds
            distanceFilter: 15 // 15 meters
          });
          break;
      }
    }
  });
};

const updateLocationSettings = async (newOptions: Partial<LocationUpdateOptions>) => {
  try {
    await ExpoGeofencing.stopLocationUpdates();
    await ExpoGeofencing.startLocationUpdates({
      accuracy: 'balanced',
      interval: 15000,
      distanceFilter: 25,
      ...newOptions
    });
  } catch (error) {
    console.error('Failed to update location settings:', error);
  }
};
```

---

## Event Handling

### 🎯 Comprehensive Event Listener

```typescript
import { GeofenceEvent, ActivityRecognitionResult, LocationData, HealthAlert } from 'expo-geofencing';

const setupEventListeners = () => {
  // Geofence events
  const geofenceUnsubscribe = ExpoGeofencing.addGeofenceListener((event: GeofenceEvent) => {
    console.log(`🔔 Geofence Event: ${event.eventType} - ${event.regionId}`);
    
    // Handle different geofence events
    if (event.eventType === 'enter') {
      handleGeofenceEntry(event);
    } else {
      handleGeofenceExit(event);
    }
  });

  // Activity recognition events
  const activityUnsubscribe = ExpoGeofencing.addActivityListener((result: ActivityRecognitionResult) => {
    console.log(`🏃 Activity: ${result.activity} (${result.confidence}%)`);
    handleActivityChange(result);
  });

  // Location update events
  const locationUnsubscribe = ExpoGeofencing.addLocationUpdateListener((location: LocationData) => {
    console.log(`📍 Location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
    handleLocationUpdate(location);
  });

  // Health monitoring events
  const healthUnsubscribe = ExpoGeofencing.addHealthAlertListener((alert: HealthAlert) => {
    console.log(`⚠️ Health Alert: ${alert.type} - ${alert.message}`);
    handleHealthAlert(alert);
  });

  // Return cleanup function
  return () => {
    geofenceUnsubscribe();
    activityUnsubscribe();
    locationUnsubscribe();
    healthUnsubscribe();
  };
};

const handleGeofenceEntry = (event: GeofenceEvent) => {
  const regionName = event.metadata?.name || event.regionId;
  
  // Show notification
  showNotification(`Arrived at ${regionName}`, 'Welcome!');
  
  // Log entry time
  logEvent('geofence_entry', {
    regionId: event.regionId,
    regionName,
    timestamp: event.timestamp
  });
};

const handleGeofenceExit = (event: GeofenceEvent) => {
  const regionName = event.metadata?.name || event.regionId;
  
  // Show notification
  showNotification(`Left ${regionName}`, 'Goodbye!');
  
  // Log exit time
  logEvent('geofence_exit', {
    regionId: event.regionId,
    regionName,
    timestamp: event.timestamp
  });
};
```

### 📱 React Hook for Geofencing

```typescript
import { useEffect, useState, useCallback } from 'react';
import ExpoGeofencing, { GeofenceEvent, ActivityRecognitionResult } from 'expo-geofencing';

export const useGeofencing = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string>('unknown');
  const [recentEvents, setRecentEvents] = useState<GeofenceEvent[]>([]);

  const addEvent = useCallback((event: GeofenceEvent) => {
    setRecentEvents(prev => [event, ...prev.slice(0, 9)]); // Keep last 10 events
  }, []);

  const startGeofencing = useCallback(async () => {
    try {
      // Request permissions
      const { status } = await ExpoGeofencing.requestPermissions();
      if (status !== 'granted') {
        throw new Error('Location permissions not granted');
      }

      // Set up event listeners
      const geofenceUnsubscribe = ExpoGeofencing.addGeofenceListener(addEvent);
      
      const activityUnsubscribe = ExpoGeofencing.addActivityListener((result: ActivityRecognitionResult) => {
        setCurrentActivity(result.activity);
      });

      // Start activity recognition
      await ExpoGeofencing.startActivityRecognition(10000);
      
      setIsActive(true);
      
      // Return cleanup function
      return () => {
        geofenceUnsubscribe();
        activityUnsubscribe();
        ExpoGeofencing.stopActivityRecognition();
        setIsActive(false);
      };
    } catch (error) {
      console.error('Failed to start geofencing:', error);
      throw error;
    }
  }, [addEvent]);

  const addGeofence = useCallback(async (region: Omit<GeofenceEvent, 'id' | 'timestamp' | 'eventType'>) => {
    try {
      await ExpoGeofencing.addGeofence({
        id: region.regionId,
        latitude: region.location.latitude,
        longitude: region.location.longitude,
        radius: 100,
        notifyOnEntry: true,
        notifyOnExit: true,
        ...region
      });
    } catch (error) {
      console.error('Failed to add geofence:', error);
      throw error;
    }
  }, []);

  return {
    isActive,
    currentActivity,
    recentEvents,
    startGeofencing,
    addGeofence
  };
};

// Usage in component
const GeofencingComponent = () => {
  const { isActive, currentActivity, recentEvents, startGeofencing, addGeofence } = useGeofencing();

  useEffect(() => {
    const cleanup = startGeofencing();
    return () => cleanup?.then(fn => fn?.());
  }, [startGeofencing]);

  return (
    <div>
      <p>Status: {isActive ? 'Active' : 'Inactive'}</p>
      <p>Current Activity: {currentActivity}</p>
      <div>
        <h3>Recent Events:</h3>
        {recentEvents.map(event => (
          <div key={event.id}>
            {event.eventType} - {event.regionId} - {new Date(event.timestamp).toLocaleString()}
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## Permission Management

### 🔐 Basic Permission Handling

```typescript
const requestBasicPermissions = async () => {
  try {
    // Check current permission status
    const { status } = await ExpoGeofencing.getPermissions();
    console.log('Current permission status:', status);

    if (status === 'undetermined') {
      // Request permissions for the first time
      const result = await ExpoGeofencing.requestPermissions();
      
      if (result.status === 'granted') {
        console.log('✅ Permissions granted');
        return true;
      } else {
        console.log('❌ Permissions denied');
        return false;
      }
    } else if (status === 'granted') {
      console.log('✅ Permissions already granted');
      return true;
    } else {
      console.log('❌ Permissions were previously denied');
      // Guide user to settings
      showPermissionDeniedAlert();
      return false;
    }
  } catch (error) {
    console.error('Permission request failed:', error);
    return false;
  }
};

const showPermissionDeniedAlert = () => {
  // Platform-specific guidance
  if (Platform.OS === 'ios') {
    Alert.alert(
      'Location Permission Required',
      'Please enable location permissions in Settings > Privacy & Security > Location Services',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => ExpoGeofencing.openLocationSettings() }
      ]
    );
  } else {
    Alert.alert(
      'Location Permission Required',
      'Please enable location permissions in Settings > Apps > Permissions',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => ExpoGeofencing.openLocationSettings() }
      ]
    );
  }
};
```

### 🔄 Advanced Permission Management

```typescript
import { Platform } from 'react-native';

const setupAdvancedPermissions = async () => {
  try {
    // Step 1: Basic location permissions
    const basicPermissions = await requestBasicPermissions();
    if (!basicPermissions) {
      throw new Error('Basic location permissions required');
    }

    // Step 2: Platform-specific setup
    if (Platform.OS === 'android') {
      await setupAndroidPermissions();
    } else if (Platform.OS === 'ios') {
      await setupIOSPermissions();
    }

    // Step 3: Verify all permissions are granted
    const finalCheck = await verifyAllPermissions();
    if (!finalCheck) {
      throw new Error('Not all required permissions granted');
    }

    console.log('✅ All permissions successfully configured');
    return true;
  } catch (error) {
    console.error('Advanced permission setup failed:', error);
    return false;
  }
};

const setupAndroidPermissions = async () => {
  // Check activity recognition permission (Android 10+)
  const activityPermission = await ExpoGeofencing.getActivityRecognitionPermission();
  if (activityPermission !== 'granted') {
    await ExpoGeofencing.requestActivityRecognitionPermission();
  }

  // Check background location permission (Android 10+)
  const backgroundPermission = await ExpoGeofencing.getBackgroundLocationPermission();
  if (backgroundPermission !== 'granted') {
    await ExpoGeofencing.requestBackgroundLocationPermission();
  }

  // Check battery optimization
  const batteryStatus = await ExpoGeofencing.checkBatteryOptimization();
  if (batteryStatus.isBatteryOptimized) {
    // Show guidance to user
    showBatteryOptimizationAlert(batteryStatus);
  }
};

const setupIOSPermissions = async () => {
  // Request always location permission for background geofencing
  const alwaysPermission = await ExpoGeofencing.requestAlwaysLocationPermission();
  if (alwaysPermission !== 'granted') {
    showIOSAlwaysPermissionAlert();
  }

  // Check motion permission for activity recognition
  const motionPermission = await ExpoGeofencing.getMotionPermission();
  if (motionPermission !== 'granted') {
    await ExpoGeofencing.requestMotionPermission();
  }
};

const verifyAllPermissions = async (): Promise<boolean> => {
  const permissions = await ExpoGeofencing.getAllPermissions();
  
  const required = ['location', 'locationAlways'];
  if (Platform.OS === 'android') {
    required.push('activityRecognition');
  } else if (Platform.OS === 'ios') {
    required.push('motion');
  }

  const missing = required.filter(perm => permissions[perm] !== 'granted');
  
  if (missing.length > 0) {
    console.warn('Missing permissions:', missing);
    return false;
  }

  return true;
};
```

### 📱 Permission Status Monitoring

```typescript
const monitorPermissionChanges = () => {
  // Set up permission status monitoring
  const unsubscribe = ExpoGeofencing.addPermissionStatusListener((status) => {
    console.log('Permission status changed:', status);
    
    switch (status.type) {
      case 'location_permission_revoked':
        handleLocationPermissionRevoked();
        break;
      case 'background_permission_denied':
        handleBackgroundPermissionDenied();
        break;
      case 'activity_permission_denied':
        handleActivityPermissionDenied();
        break;
    }
  });

  return unsubscribe;
};

const handleLocationPermissionRevoked = () => {
  // Stop all location-based services
  ExpoGeofencing.stopLocationUpdates();
  ExpoGeofencing.removeAllGeofences();
  
  // Show alert to user
  Alert.alert(
    'Location Permission Revoked',
    'Geofencing has been disabled. Please re-enable location permissions to continue.',
    [
      { text: 'Later', style: 'cancel' },
      { text: 'Settings', onPress: () => ExpoGeofencing.openLocationSettings() }
    ]
  );
};

const handleBackgroundPermissionDenied = () => {
  // Adjust functionality for foreground-only operation
  console.warn('Background location denied - geofencing limited to foreground');
  
  // Optionally notify user about limited functionality
  showLimitedFunctionalityAlert();
};

const handleActivityPermissionDenied = () => {
  // Disable activity recognition features
  ExpoGeofencing.stopActivityRecognition();
  console.warn('Activity recognition disabled due to missing permission');
};
```

---

## Helper Functions

### 🛠️ Utility Functions

```typescript
// Validate geofence region
const isValidGeofenceRegion = (region: any): boolean => {
  return (
    typeof region.id === 'string' &&
    typeof region.latitude === 'number' &&
    typeof region.longitude === 'number' &&
    typeof region.radius === 'number' &&
    region.latitude >= -90 && region.latitude <= 90 &&
    region.longitude >= -180 && region.longitude <= 180 &&
    region.radius > 0 && region.radius <= 10000 // Max 10km radius
  );
};

// Calculate distance between two points
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
};

// Format location for display
const formatLocation = (location: LocationData): string => {
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} (±${location.accuracy}m)`;
};

// Simple notification helper
const showNotification = (title: string, body: string) => {
  if (Platform.OS === 'web') {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } else {
    Alert.alert(title, body);
  }
};

// Simple logging helper
const logEvent = (eventType: string, data: any) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${eventType}:`, data);
  
  // In production, send to analytics service
  // analytics.track(eventType, { ...data, timestamp });
};
```

---

These basic examples provide a solid foundation for implementing geofencing in your app. For more advanced features, see:

- [Advanced Examples](./ADVANCED_EXAMPLES.md)
- [API Reference](../API_REFERENCE.md)
- [Platform-Specific Guides](../PLATFORM_GUIDES.md)