Pod::Spec.new do |s|
  s.name           = 'ExpoGeofencing'
  s.version        = '1.0.0'
  s.summary        = 'Advanced geofencing and activity recognition for Expo'
  s.description    = 'Expo module for advanced geofencing and activity recognition with power-efficient location updates'
  s.author         = ''
  s.homepage       = 'https://github.com/your-username/expo-geofencing'
  s.platform       = :ios, '13.0'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end