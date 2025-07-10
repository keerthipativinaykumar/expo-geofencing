import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, ScrollView, Switch, Platform } from 'react-native';
import ExpoGeofencing, { SystemStatus, HealthAlert, ServiceStatus } from 'expo-geofencing';
import * as Location from 'expo-location';

export default function App() {
  const [location, setLocation] = useState<any>(null);
  const [geofenceEvents, setGeofenceEvents] = useState<string[]>([]);
  const [activityData, setActivityData] = useState<string[]>([]);
  const [healthAlerts, setHealthAlerts] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [batteryOptimized, setBatteryOptimized] = useState<boolean | null>(null);
  const [healthCheckEnabled, setHealthCheckEnabled] = useState(true);
  const [healthCheckInterval, setHealthCheckInterval] = useState(5); // minutes

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    await requestPermissions();
    await checkSystemStatus();
    await checkBatteryOptimization();
    setupEventListeners();
  };

  const setupEventListeners = () => {
    // Health alert listener
    const healthUnsubscribe = ExpoGeofencing.addHealthAlertListener((alert: HealthAlert) => {
      const message = `${alert.title}: ${alert.message} at ${new Date(alert.timestamp).toLocaleTimeString()}`;
      setHealthAlerts(prev => [...prev.slice(-4), message]); // Keep last 5 alerts
      
      // Show alert for critical issues
      if (alert.title.includes('Permission') || alert.title.includes('Disabled')) {
        Alert.alert(alert.title, alert.message);
      }
    });

    // Service status listener
    const statusUnsubscribe = ExpoGeofencing.addServiceStatusListener((status: ServiceStatus) => {
      console.log('Service status update:', status);
      setIsMonitoring(status.isMonitoringActive);
    });

    return () => {
      healthUnsubscribe();
      statusUnsubscribe();
    };
  };

  const checkSystemStatus = async () => {
    try {
      let status: SystemStatus;
      if (Platform.OS === 'ios' && ExpoGeofencing.checkSystemStatus) {
        status = await ExpoGeofencing.checkSystemStatus();
      } else if (Platform.OS === 'android' && ExpoGeofencing.getServiceStatus) {
        status = await ExpoGeofencing.getServiceStatus();
      } else {
        return;
      }
      setSystemStatus(status);
    } catch (error) {
      console.log('System status check not available');
    }
  };

  const checkBatteryOptimization = async () => {
    try {
      if (Platform.OS === 'android' && ExpoGeofencing.checkBatteryOptimization) {
        const batteryStatus = await ExpoGeofencing.checkBatteryOptimization();
        setBatteryOptimized(batteryStatus.isBatteryOptimized);
      }
    } catch (error) {
      console.log('Battery optimization check not available');
    }
  };

  const requestPermissions = async () => {
    try {
      // Try Expo's built-in permission request first
      if (ExpoGeofencing.requestPermissions) {
        await ExpoGeofencing.requestPermissions();
      }
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for geofencing');
        return;
      }

      const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus.status !== 'granted') {
        Alert.alert(
          'Background permission required', 
          'Background location permission is needed for reliable geofencing',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openLocationSettings }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', `Failed to request permissions: ${error}`);
    }
  };

  const openLocationSettings = async () => {
    try {
      if (ExpoGeofencing.openLocationSettings) {
        await ExpoGeofencing.openLocationSettings();
      }
    } catch (error) {
      Alert.alert('Error', 'Cannot open location settings');
    }
  };

  const handleBatteryOptimization = async () => {
    try {
      if (Platform.OS === 'android' && ExpoGeofencing.requestBatteryOptimizationDisable) {
        await ExpoGeofencing.requestBatteryOptimizationDisable();
        // Check status again after user interaction
        setTimeout(checkBatteryOptimization, 2000);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to request battery optimization disable: ${error}`);
    }
  };

  const addSampleGeofence = async () => {
    try {
      const currentLocation = await Location.getCurrentPositionAsync({});
      
      await ExpoGeofencing.addGeofence({
        id: 'sample-geofence',
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        radius: 100, // 100 meters
        notifyOnEntry: true,
        notifyOnExit: true,
      });

      Alert.alert('Success', 'Geofence added successfully');
    } catch (error) {
      Alert.alert('Error', `Failed to add geofence: ${error}`);
    }
  };

  const startMonitoring = async () => {
    try {
      // Start geofence monitoring
      const geofenceUnsubscribe = ExpoGeofencing.addGeofenceListener((event) => {
        const message = `${event.eventType.toUpperCase()} region: ${event.regionId} at ${new Date(event.timestamp).toLocaleTimeString()}`;
        setGeofenceEvents(prev => [...prev.slice(-9), message]); // Keep last 10 events
      });

      // Start activity recognition
      await ExpoGeofencing.startActivityRecognition(5000); // 5 second intervals
      
      const activityUnsubscribe = ExpoGeofencing.addActivityListener((result) => {
        const message = `Activity: ${result.activity} (${result.confidence}% confidence) at ${new Date(result.timestamp).toLocaleTimeString()}`;
        setActivityData(prev => [...prev.slice(-9), message]); // Keep last 10 events
      });

      // Start location updates
      await ExpoGeofencing.startLocationUpdates({
        interval: 10000, // 10 seconds
        fastestInterval: 5000, // 5 seconds
        smallestDisplacement: 10, // 10 meters
        priority: 'high_accuracy',
      });

      // Configure health check interval if enabled
      if (healthCheckEnabled) {
        await ExpoGeofencing.setHealthCheckInterval(healthCheckInterval * 60 * 1000);
      }

      setIsMonitoring(true);
      Alert.alert('Started', 'Geofencing and activity monitoring started with health checks');

      // Store unsubscribe functions for cleanup
      return () => {
        geofenceUnsubscribe();
        activityUnsubscribe();
      };
    } catch (error) {
      Alert.alert('Error', `Failed to start monitoring: ${error}`);
    }
  };

  const stopMonitoring = async () => {
    try {
      await ExpoGeofencing.stopActivityRecognition();
      await ExpoGeofencing.stopLocationUpdates();
      await ExpoGeofencing.removeAllGeofences();
      
      setIsMonitoring(false);
      Alert.alert('Stopped', 'All monitoring stopped');
    } catch (error) {
      Alert.alert('Error', `Failed to stop monitoring: ${error}`);
    }
  };

  const clearLogs = () => {
    setGeofenceEvents([]);
    setActivityData([]);
    setHealthAlerts([]);
  };

  const forceLocationCheck = async () => {
    try {
      const location = await ExpoGeofencing.forceLocationCheck();
      if (location && typeof location === 'object' && 'latitude' in location) {
        Alert.alert(
          'Current Location', 
          `Lat: ${location.latitude.toFixed(6)}\nLng: ${location.longitude.toFixed(6)}\nAccuracy: ${location.accuracy}m`
        );
      } else {
        Alert.alert('Success', 'Location check requested');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to get location: ${error}`);
    }
  };

  const updateHealthCheckInterval = async () => {
    try {
      await ExpoGeofencing.setHealthCheckInterval(healthCheckInterval * 60 * 1000);
      Alert.alert('Success', `Health check interval updated to ${healthCheckInterval} minutes`);
    } catch (error) {
      Alert.alert('Error', `Failed to update interval: ${error}`);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Expo Geofencing Demo</Text>
      
      {/* System Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Status</Text>
        {systemStatus && (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              Monitoring: {systemStatus.isMonitoringActive ? '✅ Active' : '❌ Inactive'}
            </Text>
            <Text style={styles.statusText}>
              Active Geofences: {systemStatus.activeGeofences}
            </Text>
            <Text style={styles.statusText}>
              Location Services: {systemStatus.locationServicesEnabled ? '✅ Enabled' : '❌ Disabled'}
            </Text>
            {Platform.OS === 'android' && batteryOptimized !== null && (
              <Text style={[styles.statusText, { color: batteryOptimized ? 'red' : 'green' }]}>
                Battery Optimization: {batteryOptimized ? '⚠️ Enabled' : '✅ Disabled'}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Battery Optimization Warning */}
      {Platform.OS === 'android' && batteryOptimized && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>⚠️ Battery optimization is enabled. This may affect geofencing reliability.</Text>
          <Button title="Disable Battery Optimization" onPress={handleBatteryOptimization} color="orange" />
        </View>
      )}

      {/* Health Check Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Monitoring</Text>
        <View style={styles.settingRow}>
          <Text>Enable Health Checks</Text>
          <Switch value={healthCheckEnabled} onValueChange={setHealthCheckEnabled} />
        </View>
        <View style={styles.settingRow}>
          <Text>Check Interval: {healthCheckInterval} minutes</Text>
          <Button title="Update" onPress={updateHealthCheckInterval} />
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        <Button title="Add Sample Geofence" onPress={addSampleGeofence} />
        <Button 
          title={isMonitoring ? "Stop Monitoring" : "Start Monitoring"} 
          onPress={isMonitoring ? stopMonitoring : startMonitoring}
          color={isMonitoring ? "red" : "green"}
        />
        <Button title="Force Location Check" onPress={forceLocationCheck} />
        <Button title="Refresh System Status" onPress={checkSystemStatus} />
        <Button title="Clear Logs" onPress={clearLogs} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Geofence Events</Text>
        {geofenceEvents.length === 0 ? (
          <Text style={styles.noData}>No geofence events yet</Text>
        ) : (
          geofenceEvents.map((event, index) => (
            <Text key={index} style={styles.eventText}>{event}</Text>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Recognition</Text>
        {activityData.length === 0 ? (
          <Text style={styles.noData}>No activity data yet</Text>
        ) : (
          activityData.slice(-5).map((activity, index) => (
            <Text key={index} style={styles.eventText}>{activity}</Text>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Alerts</Text>
        {healthAlerts.length === 0 ? (
          <Text style={styles.noData}>No health alerts</Text>
        ) : (
          healthAlerts.slice(-5).map((alert, index) => (
            <Text key={index} style={[styles.eventText, styles.alertText]}>{alert}</Text>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    marginTop: 50,
  },
  buttonContainer: {
    marginBottom: 30,
    gap: 10,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  statusContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 14,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  warningText: {
    color: '#856404',
    marginBottom: 10,
    fontSize: 14,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 8,
  },
  noData: {
    color: '#666',
    fontStyle: 'italic',
  },
  eventText: {
    fontSize: 14,
    marginBottom: 5,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  alertText: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
});