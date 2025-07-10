// Placeholder for native module - will be properly imported in production
const ExpoGeofencingNative = {
  addGeofence: async (_region: any) => {},
  removeGeofence: async (_regionId: string) => {},
  removeAllGeofences: async () => {},
  getActiveGeofences: async () => [],
  startActivityRecognition: async (_intervalMs: number) => {},
  stopActivityRecognition: async () => {},
  startLocationUpdates: async (_options: any) => {},
  stopLocationUpdates: async () => {},
  setHealthCheckInterval: async (_intervalMs: number) => {},
  forceLocationCheck: async () => ({ latitude: 0, longitude: 0, accuracy: 0, timestamp: 0 }),
  checkBatteryOptimization: async () => ({
    isBatteryOptimized: false,
    isLocationEnabled: true,
    deviceInstructions: {
      manufacturer: 'Generic',
      instructions: 'No optimization needed',
      additionalSettings: 'None'
    }
  }),
  requestBatteryOptimizationDisable: async () => true,
  openLocationSettings: async () => {},
  checkSystemStatus: async () => ({
    isMonitoringActive: false,
    activeGeofences: 0,
    locationServicesEnabled: true,
    healthCheckInterval: 300000
  }),
  getServiceStatus: async () => ({
    isMonitoringActive: false,
    activeGeofences: 0,
    locationServicesEnabled: true,
    healthCheckInterval: 300000
  }),
  requestPermissions: async () => true,
  addListener: (_event: string, _callback: any) => ({ remove: () => {} })
};

import { 
  GeofenceRegion, 
  ActivityRecognitionResult, 
  GeofenceEvent, 
  LocationUpdateOptions,
  ExpoGeofencingModule,
  SystemStatus,
  HealthAlert,
  ServiceStatus,
  BatteryOptimizationStatus,
  LocationData,
  validateGeofenceRegion,
  validateLocationUpdateOptions
} from './index';

class ExpoGeofencingImpl implements ExpoGeofencingModule {
  async addGeofence(region: GeofenceRegion): Promise<void> {
    if (!validateGeofenceRegion(region)) {
      throw new Error('Invalid geofence region parameters');
    }
    return ExpoGeofencingNative.addGeofence(region);
  }

  async removeGeofence(regionId: string): Promise<void> {
    return ExpoGeofencingNative.removeGeofence(regionId);
  }

  async removeAllGeofences(): Promise<void> {
    return ExpoGeofencingNative.removeAllGeofences();
  }

  async getActiveGeofences(): Promise<GeofenceRegion[]> {
    return ExpoGeofencingNative.getActiveGeofences();
  }

  async startActivityRecognition(intervalMs: number): Promise<void> {
    return ExpoGeofencingNative.startActivityRecognition(intervalMs);
  }

  async stopActivityRecognition(): Promise<void> {
    return ExpoGeofencingNative.stopActivityRecognition();
  }

  async startLocationUpdates(options: LocationUpdateOptions): Promise<void> {
    if (!validateLocationUpdateOptions(options)) {
      throw new Error('Invalid location update options');
    }
    return ExpoGeofencingNative.startLocationUpdates(options);
  }

  async stopLocationUpdates(): Promise<void> {
    return ExpoGeofencingNative.stopLocationUpdates();
  }

  addGeofenceListener(callback: (event: GeofenceEvent) => void): () => void {
    const subscription = ExpoGeofencingNative.addListener('onGeofenceEvent', callback);
    return () => subscription.remove();
  }

  addActivityListener(callback: (result: ActivityRecognitionResult) => void): () => void {
    const subscription = ExpoGeofencingNative.addListener('onActivityRecognition', callback);
    return () => subscription.remove();
  }

  addLocationUpdateListener(callback: (location: LocationData) => void): () => void {
    const subscription = ExpoGeofencingNative.addListener('onLocationUpdate', callback);
    return () => subscription.remove();
  }

  addHealthAlertListener(callback: (alert: HealthAlert) => void): () => void {
    const subscription = ExpoGeofencingNative.addListener('onHealthAlert', callback);
    return () => subscription.remove();
  }

  addServiceStatusListener(callback: (status: ServiceStatus) => void): () => void {
    const subscription = ExpoGeofencingNative.addListener('onServiceStatus', callback);
    return () => subscription.remove();
  }

  // Android-specific functions
  async checkBatteryOptimization(): Promise<BatteryOptimizationStatus> {
    return ExpoGeofencingNative.checkBatteryOptimization();
  }

  async requestBatteryOptimizationDisable(): Promise<boolean> {
    return ExpoGeofencingNative.requestBatteryOptimizationDisable();
  }

  async openLocationSettings(): Promise<void> {
    return ExpoGeofencingNative.openLocationSettings();
  }

  // iOS-specific functions
  async checkSystemStatus(): Promise<SystemStatus> {
    return ExpoGeofencingNative.checkSystemStatus();
  }

  async requestPermissions(): Promise<boolean> {
    return ExpoGeofencingNative.requestPermissions();
  }

  // Common functions
  async setHealthCheckInterval(intervalMs: number): Promise<void> {
    if (intervalMs < 60000) {
      throw new Error('Health check interval must be at least 60000ms (1 minute)');
    }
    return ExpoGeofencingNative.setHealthCheckInterval(intervalMs);
  }

  async forceLocationCheck(): Promise<LocationData> {
    return ExpoGeofencingNative.forceLocationCheck();
  }

  async getServiceStatus(): Promise<SystemStatus> {
    return ExpoGeofencingNative.getServiceStatus();
  }
}

// Create and export enhanced implementation
const ExpoGeofencing = new ExpoGeofencingImpl();

// Auto-setup health monitoring when first geofence is added
const originalAddGeofence = ExpoGeofencing.addGeofence.bind(ExpoGeofencing);
ExpoGeofencing.addGeofence = async (region: GeofenceRegion) => {
  await originalAddGeofence(region);
  
  // Auto-start health monitoring if not already started
  try {
    await ExpoGeofencing.setHealthCheckInterval(5 * 60 * 1000); // 5 minutes
  } catch (error) {
    // Ignore if already started or not supported
  }
};

export default ExpoGeofencing;