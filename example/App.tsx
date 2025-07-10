import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, ScrollView } from 'react-native';
import ExpoGeofencing from 'expo-geofencing';
import * as Location from 'expo-location';

export default function App() {
  const [location, setLocation] = useState<any>(null);
  const [geofenceEvents, setGeofenceEvents] = useState<string[]>([]);
  const [activityData, setActivityData] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required for geofencing');
      return;
    }

    const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus.status !== 'granted') {
      Alert.alert('Background permission required', 'Background location permission is needed for geofencing');
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
        setGeofenceEvents(prev => [...prev, message]);
      });

      // Start activity recognition
      await ExpoGeofencing.startActivityRecognition(5000); // 5 second intervals
      
      const activityUnsubscribe = ExpoGeofencing.addActivityListener((result) => {
        const message = `Activity: ${result.activity} (${result.confidence}% confidence) at ${new Date(result.timestamp).toLocaleTimeString()}`;
        setActivityData(prev => [...prev, message]);
      });

      // Start location updates
      await ExpoGeofencing.startLocationUpdates({
        interval: 10000, // 10 seconds
        fastestInterval: 5000, // 5 seconds
        smallestDisplacement: 10, // 10 meters
        priority: 'high_accuracy',
      });

      setIsMonitoring(true);
      Alert.alert('Started', 'Geofencing and activity monitoring started');

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
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Expo Geofencing Demo</Text>
      
      <View style={styles.buttonContainer}>
        <Button title="Add Sample Geofence" onPress={addSampleGeofence} />
        <Button 
          title={isMonitoring ? "Stop Monitoring" : "Start Monitoring"} 
          onPress={isMonitoring ? stopMonitoring : startMonitoring}
          color={isMonitoring ? "red" : "green"}
        />
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
          activityData.map((activity, index) => (
            <Text key={index} style={styles.eventText}>{activity}</Text>
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
});