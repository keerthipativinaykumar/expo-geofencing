import ExpoModulesCore
import CoreLocation
import CoreMotion
import UserNotifications
import UIKit
import BackgroundTasks

public class ExpoGeofencingModule: Module {
  private var locationManager: CLLocationManager?
  private var motionActivityManager: CMMotionActivityManager?
  private var geofenceRegions: [String: CLCircularRegion] = [:]
  private var isMonitoringActivity = false
  private var isMonitoringLocation = false
  private var healthCheckTimer: Timer?
  private var healthCheckInterval: TimeInterval = 5 * 60 // 5 minutes
  private var lastLocationTime: Date = Date()
  private var lastAccurateLocationTime: Date = Date()
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid
  
  public func definition() -> ModuleDefinition {
    Name("ExpoGeofencing")
    
    Events("onGeofenceEvent", "onActivityRecognition", "onLocationUpdate", "onHealthAlert", "onServiceStatus")
    
    OnCreate {
      locationManager = CLLocationManager()
      locationManager?.delegate = self
      motionActivityManager = CMMotionActivityManager()
      setupNotifications()
      setupBackgroundTasks()
    }
    
    AsyncFunction("addGeofence") { (region: GeofenceRegion, promise: Promise) in
      guard let locationManager = locationManager else {
        promise.reject("LOCATION_MANAGER_ERROR", "Location manager not initialized")
        return
      }
      
      guard self.validateGeofenceRegion(region) else {
        promise.reject("INVALID_REGION", "Invalid geofence region parameters")
        return
      }
      
      guard locationManager.authorizationStatus == .authorizedAlways ||
            locationManager.authorizationStatus == .authorizedWhenInUse else {
        promise.reject("PERMISSION_DENIED", "Location permission not granted")
        return
      }
      
      let center = CLLocationCoordinate2D(latitude: region.latitude, longitude: region.longitude)
      let geofenceRegion = CLCircularRegion(center: center, radius: region.radius, identifier: region.id)
      
      geofenceRegion.notifyOnEntry = region.notifyOnEntry
      geofenceRegion.notifyOnExit = region.notifyOnExit
      
      geofenceRegions[region.id] = geofenceRegion
      locationManager.startMonitoring(for: geofenceRegion)
      
      self.startHealthMonitoringIfNeeded()
      self.sendServiceStatusUpdate()
      promise.resolve(nil)
    }
    
    AsyncFunction("removeGeofence") { (regionId: String, promise: Promise) in
      guard let locationManager = locationManager else {
        promise.reject("LOCATION_MANAGER_ERROR", "Location manager not initialized")
        return
      }
      
      if let region = geofenceRegions[regionId] {
        locationManager.stopMonitoring(for: region)
        geofenceRegions.removeValue(forKey: regionId)
      }
      
      promise.resolve(nil)
    }
    
    AsyncFunction("removeAllGeofences") { (promise: Promise) in
      guard let locationManager = locationManager else {
        promise.reject("LOCATION_MANAGER_ERROR", "Location manager not initialized")
        return
      }
      
      for region in geofenceRegions.values {
        locationManager.stopMonitoring(for: region)
      }
      geofenceRegions.removeAll()
      
      promise.resolve(nil)
    }
    
    AsyncFunction("startActivityRecognition") { (intervalMs: Int, promise: Promise) in
      guard let motionActivityManager = motionActivityManager else {
        promise.reject("MOTION_MANAGER_ERROR", "Motion activity manager not initialized")
        return
      }
      
      guard CMMotionActivityManager.isActivityAvailable() else {
        promise.reject("ACTIVITY_NOT_AVAILABLE", "Activity recognition not available on this device")
        return
      }
      
      let interval = TimeInterval(intervalMs / 1000)
      isMonitoringActivity = true
      
      motionActivityManager.startActivityUpdates(to: OperationQueue.main) { [weak self] activity in
        guard let self = self, let activity = activity, self.isMonitoringActivity else { return }
        
        let activityType = self.getActivityType(from: activity)
        let confidence = self.getConfidence(from: activity)
        
        let eventData: [String: Any] = [
          "activity": activityType,
          "confidence": confidence,
          "timestamp": Int(activity.timestamp.timeIntervalSince1970 * 1000)
        ]
        
        self.sendEvent("onActivityRecognition", eventData)
      }
      
      promise.resolve(nil)
    }
    
    AsyncFunction("stopActivityRecognition") { (promise: Promise) in
      guard let motionActivityManager = motionActivityManager else {
        promise.reject("MOTION_MANAGER_ERROR", "Motion activity manager not initialized")
        return
      }
      
      isMonitoringActivity = false
      motionActivityManager.stopActivityUpdates()
      
      promise.resolve(nil)
    }
    
    AsyncFunction("startLocationUpdates") { (options: LocationUpdateOptions, promise: Promise) in
      guard let locationManager = locationManager else {
        promise.reject("LOCATION_MANAGER_ERROR", "Location manager not initialized")
        return
      }
      
      guard self.validateLocationUpdateOptions(options) else {
        promise.reject("INVALID_OPTIONS", "Invalid location update options")
        return
      }
      
      guard locationManager.authorizationStatus == .authorizedAlways ||
            locationManager.authorizationStatus == .authorizedWhenInUse else {
        promise.reject("PERMISSION_DENIED", "Location permission not granted")
        return
      }
      
      locationManager.desiredAccuracy = getAccuracy(from: options.priority)
      locationManager.distanceFilter = CLLocationDistance(options.smallestDisplacement)
      
      locationManager.startUpdatingLocation()
      isMonitoringLocation = true
      
      self.startHealthMonitoringIfNeeded()
      self.sendServiceStatusUpdate()
      promise.resolve(nil)
    }
    
    AsyncFunction("stopLocationUpdates") { (promise: Promise) in
      guard let locationManager = locationManager else {
        promise.reject("LOCATION_MANAGER_ERROR", "Location manager not initialized")
        return
      }
      
      locationManager.stopUpdatingLocation()
      isMonitoringLocation = false
      
      self.sendServiceStatusUpdate()
      promise.resolve(nil)
    }
    
    // Enhanced iOS-specific functions
    AsyncFunction("checkSystemStatus") { (promise: Promise) in
      let authStatus = locationManager?.authorizationStatus ?? .notDetermined
      let backgroundRefreshStatus = UIApplication.shared.backgroundRefreshStatus
      let locationServicesEnabled = CLLocationManager.locationServicesEnabled()
      
      let status: [String: Any] = [
        "locationPermission": self.getLocationPermissionStatus(authStatus),
        "backgroundRefreshStatus": self.getBackgroundRefreshStatus(backgroundRefreshStatus),
        "locationServicesEnabled": locationServicesEnabled,
        "isMonitoringActive": isMonitoringLocation || !geofenceRegions.isEmpty,
        "activeGeofences": geofenceRegions.count,
        "activityRecognitionAvailable": CMMotionActivityManager.isActivityAvailable(),
        "healthCheckInterval": healthCheckInterval
      ]
      
      promise.resolve(status)
    }
    
    AsyncFunction("requestPermissions") { (promise: Promise) in
      guard let locationManager = locationManager else {
        promise.reject("LOCATION_MANAGER_ERROR", "Location manager not initialized")
        return
      }
      
      // Request location permissions
      locationManager.requestAlwaysAuthorization()
      
      // Request notification permissions
      UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
        if let error = error {
          promise.reject("NOTIFICATION_PERMISSION_ERROR", "Failed to request notification permission: \(error.localizedDescription)")
          return
        }
        promise.resolve(granted)
      }
    }
    
    AsyncFunction("setHealthCheckInterval") { (intervalMs: Int, promise: Promise) in
      guard intervalMs >= 60000 else { // Minimum 1 minute
        promise.reject("INVALID_INTERVAL", "Health check interval must be at least 60000ms (1 minute)")
        return
      }
      
      healthCheckInterval = TimeInterval(intervalMs / 1000)
      
      // Restart health monitoring with new interval
      self.stopHealthMonitoring()
      self.startHealthMonitoringIfNeeded()
      
      promise.resolve(nil)
    }
    
    AsyncFunction("forceLocationCheck") { (promise: Promise) in
      guard let locationManager = locationManager else {
        promise.reject("LOCATION_MANAGER_ERROR", "Location manager not initialized")
        return
      }
      
      guard locationManager.authorizationStatus == .authorizedAlways ||
            locationManager.authorizationStatus == .authorizedWhenInUse else {
        promise.reject("PERMISSION_DENIED", "Location permission not granted")
        return
      }
      
      locationManager.requestLocation()
      promise.resolve(nil)
    }
  }
  
  private func getActivityType(from activity: CMMotionActivity) -> String {
    if activity.stationary {
      return "still"
    } else if activity.walking {
      return "walking"
    } else if activity.running {
      return "running"
    } else if activity.automotive {
      return "driving"
    } else if activity.cycling {
      return "cycling"
    } else {
      return "unknown"
    }
  }
  
  private func getConfidence(from activity: CMMotionActivity) -> Int {
    switch activity.confidence {
    case .low:
      return 25
    case .medium:
      return 50
    case .high:
      return 75
    @unknown default:
      return 0
    }
  }
  
  private func getAccuracy(from priority: String) -> CLLocationAccuracy {
    switch priority {
    case "high_accuracy":
      return kCLLocationAccuracyBest
    case "balanced":
      return kCLLocationAccuracyNearestTenMeters
    case "low_power":
      return kCLLocationAccuracyHundredMeters
    case "no_power":
      return kCLLocationAccuracyThreeKilometers
    default:
      return kCLLocationAccuracyBest
    }
  }
  
  // MARK: - Validation Functions
  private func validateGeofenceRegion(_ region: GeofenceRegion) -> Bool {
    return !region.id.isEmpty &&
           region.latitude >= -90.0 && region.latitude <= 90.0 &&
           region.longitude >= -180.0 && region.longitude <= 180.0 &&
           region.radius > 0 && region.radius <= 10000 // Max 10km radius
  }
  
  private func validateLocationUpdateOptions(_ options: LocationUpdateOptions) -> Bool {
    return options.interval >= 1000 && // Min 1 second
           options.fastestInterval >= 500 && // Min 500ms
           options.smallestDisplacement >= 0 &&
           ["high_accuracy", "balanced", "low_power", "no_power"].contains(options.priority)
  }
  
  // MARK: - System Status Functions
  private func getLocationPermissionStatus(_ status: CLAuthorizationStatus) -> String {
    switch status {
    case .notDetermined:
      return "not_determined"
    case .restricted:
      return "restricted"
    case .denied:
      return "denied"
    case .authorizedWhenInUse:
      return "when_in_use"
    case .authorizedAlways:
      return "always"
    @unknown default:
      return "unknown"
    }
  }
  
  private func getBackgroundRefreshStatus(_ status: UIBackgroundRefreshStatus) -> String {
    switch status {
    case .restricted:
      return "restricted"
    case .denied:
      return "denied"
    case .available:
      return "available"
    @unknown default:
      return "unknown"
    }
  }
  
  // MARK: - Health Monitoring Functions
  private func startHealthMonitoringIfNeeded() {
    guard (isMonitoringLocation || !geofenceRegions.isEmpty) && healthCheckTimer == nil else {
      return
    }
    
    healthCheckTimer = Timer.scheduledTimer(withTimeInterval: healthCheckInterval, repeats: true) { _ in
      self.performHealthCheck()
    }
    
    // Also perform an initial check
    performHealthCheck()
  }
  
  private func stopHealthMonitoring() {
    healthCheckTimer?.invalidate()
    healthCheckTimer = nil
  }
  
  private func performHealthCheck() {
    let currentTime = Date()
    let timeSinceLastLocation = currentTime.timeIntervalSince(lastLocationTime)
    let timeSinceAccurateLocation = currentTime.timeIntervalSince(lastAccurateLocationTime)
    
    // Check if location services are still enabled
    if !CLLocationManager.locationServicesEnabled() {
      sendHealthAlert(title: "Location Services Disabled", message: "Please enable location services to continue geofencing")
      return
    }
    
    // Check authorization status
    if let locationManager = locationManager {
      if locationManager.authorizationStatus == .denied || locationManager.authorizationStatus == .restricted {
        sendHealthAlert(title: "Location Permission Denied", message: "Location permission is required for geofencing")
        return
      }
    }
    
    // Check background refresh status
    if UIApplication.shared.backgroundRefreshStatus == .denied {
      sendHealthAlert(title: "Background Refresh Disabled", message: "Enable background refresh for reliable geofencing")
    }
    
    // Check location timeouts
    if timeSinceLastLocation > 10 * 60 { // 10 minutes
      sendHealthAlert(title: "Location Timeout", message: "No location updates received recently")
      // Try to get current location
      locationManager?.requestLocation()
    }
    
    if timeSinceAccurateLocation > 30 * 60 { // 30 minutes
      sendHealthAlert(title: "GPS Accuracy Low", message: "Recent location updates are not accurate enough")
    }
    
    // Send periodic health check location request
    if isMonitoringLocation {
      locationManager?.requestLocation()
    }
  }
  
  private func sendHealthAlert(title: String, message: String) {
    let alertData: [String: Any] = [
      "type": "health_alert",
      "title": title,
      "message": message,
      "timestamp": Int(Date().timeIntervalSince1970 * 1000)
    ]
    
    sendEvent("onHealthAlert", alertData)
    
    // Also send local notification if app is in background
    if UIApplication.shared.applicationState != .active {
      sendLocalNotification(title: title, message: message)
    }
  }
  
  private func sendServiceStatusUpdate() {
    let status: [String: Any] = [
      "isMonitoringActive": isMonitoringLocation || !geofenceRegions.isEmpty,
      "activeGeofences": geofenceRegions.count,
      "timestamp": Int(Date().timeIntervalSince1970 * 1000)
    ]
    sendEvent("onServiceStatus", status)
  }
  
  // MARK: - Notification Functions
  private func setupNotifications() {
    UNUserNotificationCenter.current().delegate = self
  }
  
  private func sendLocalNotification(title: String, message: String) {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = message
    content.sound = .default
    
    let request = UNNotificationRequest(
      identifier: "geofencing_health_\(UUID().uuidString)",
      content: content,
      trigger: nil
    )
    
    UNUserNotificationCenter.current().add(request)
  }
  
  // MARK: - Background Task Functions
  private func setupBackgroundTasks() {
    if #available(iOS 13.0, *) {
      BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.expogeofencing.healthcheck", using: nil) { task in
        self.handleBackgroundHealthCheck(task: task as! BGAppRefreshTask)
      }
    }
  }
  
  @available(iOS 13.0, *)
  private func handleBackgroundHealthCheck(task: BGAppRefreshTask) {
    task.expirationHandler = {
      task.setTaskCompleted(success: false)
    }
    
    performHealthCheck()
    
    // Schedule next background task
    scheduleBackgroundHealthCheck()
    
    task.setTaskCompleted(success: true)
  }
  
  @available(iOS 13.0, *)
  private func scheduleBackgroundHealthCheck() {
    let request = BGAppRefreshTaskRequest(identifier: "com.expogeofencing.healthcheck")
    request.earliestBeginDate = Date(timeIntervalSinceNow: healthCheckInterval)
    
    try? BGTaskScheduler.shared.submit(request)
  }
}

extension ExpoGeofencingModule: CLLocationManagerDelegate {
  public func locationManager(_ manager: CLLocationManager, didEnterRegion region: CLRegion) {
    handleGeofenceEvent(region: region, eventType: "enter")
  }
  
  public func locationManager(_ manager: CLLocationManager, didExitRegion region: CLRegion) {
    handleGeofenceEvent(region: region, eventType: "exit")
  }
  
  public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let location = locations.last else { return }
    
    lastLocationTime = Date()
    
    if location.horizontalAccuracy <= 50 { // Consider accurate if within 50 meters
      lastAccurateLocationTime = Date()
    }
    
    let eventData: [String: Any] = [
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude,
      "accuracy": location.horizontalAccuracy,
      "timestamp": Int(location.timestamp.timeIntervalSince1970 * 1000),
      "isHealthCheck": true
    ]
    
    sendEvent("onLocationUpdate", eventData)
  }
  
  public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    let alertData: [String: Any] = [
      "type": "location_error",
      "title": "Location Error",
      "message": "Failed to get location: \(error.localizedDescription)",
      "timestamp": Int(Date().timeIntervalSince1970 * 1000)
    ]
    
    sendEvent("onHealthAlert", alertData)
  }
  
  private func handleGeofenceEvent(region: CLRegion, eventType: String) {
    guard let location = locationManager?.location else { return }
    
    let eventData: [String: Any] = [
      "regionId": region.identifier,
      "eventType": eventType,
      "timestamp": Int(Date().timeIntervalSince1970 * 1000),
      "latitude": location.coordinate.latitude,
      "longitude": location.coordinate.longitude
    ]
    
    sendEvent("onGeofenceEvent", eventData)
  }
}

struct GeofenceRegion: Record {
  @Field var id: String = ""
  @Field var latitude: Double = 0.0
  @Field var longitude: Double = 0.0
  @Field var radius: Double = 0.0
  @Field var notifyOnEntry: Bool = true
  @Field var notifyOnExit: Bool = true
}

struct LocationUpdateOptions: Record {
  @Field var interval: Int = 10000
  @Field var fastestInterval: Int = 5000
  @Field var smallestDisplacement: Double = 0.0
  @Field var priority: String = "high_accuracy"
}

// MARK: - UNUserNotificationCenterDelegate
extension ExpoGeofencingModule: UNUserNotificationCenterDelegate {
  public func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    completionHandler([.banner, .sound, .badge])
  }
}