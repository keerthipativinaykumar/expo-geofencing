import { ConfigPlugin, withAndroidManifest, withInfoPlist } from '@expo/config-plugins';

const withExpoGeofencing: ConfigPlugin = (config) => {
  // Add Android permissions
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    
    const permissions = [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'com.google.android.gms.permission.ACTIVITY_RECOGNITION',
      'android.permission.WAKE_LOCK'
    ];
    
    permissions.forEach(permission => {
      const exists = androidManifest.manifest['uses-permission'].find(
        (item: any) => item.$['android:name'] === permission
      );
      
      if (!exists) {
        androidManifest.manifest['uses-permission'].push({
          $: { 'android:name': permission }
        });
      }
    });
    
    return config;
  });

  // Add iOS permissions
  config = withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    
    infoPlist.NSLocationWhenInUseUsageDescription = 
      infoPlist.NSLocationWhenInUseUsageDescription ||
      'This app needs location access to provide geofencing features.';
    
    infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription = 
      infoPlist.NSLocationAlwaysAndWhenInUseUsageDescription ||
      'This app needs location access to provide geofencing features even when the app is in the background.';
    
    infoPlist.NSMotionUsageDescription = 
      infoPlist.NSMotionUsageDescription ||
      'This app needs motion access to detect your activity and provide context-aware features.';
    
    infoPlist.UIBackgroundModes = infoPlist.UIBackgroundModes || [];
    
    if (!infoPlist.UIBackgroundModes.includes('location')) {
      infoPlist.UIBackgroundModes.push('location');
    }
    
    return config;
  });

  return config;
};

export default withExpoGeofencing;