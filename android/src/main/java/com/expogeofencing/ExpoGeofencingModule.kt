package com.expogeofencing

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.*
import com.google.android.gms.tasks.Task
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.Enumerable
import android.app.Activity
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

class GeofenceRegionRecord : Record {
  @Field
  val id: String = ""
  
  @Field
  val latitude: Double = 0.0
  
  @Field
  val longitude: Double = 0.0
  
  @Field
  val radius: Float = 0f
  
  @Field
  val notifyOnEntry: Boolean = true
  
  @Field
  val notifyOnExit: Boolean = true
}

class LocationUpdateOptionsRecord : Record {
  @Field
  val interval: Long = 10000
  
  @Field
  val fastestInterval: Long = 5000
  
  @Field
  val smallestDisplacement: Float = 0f
  
  @Field
  val priority: String = "high_accuracy"
}

enum class ActivityType(val value: String) : Enumerable {
  STILL("still"),
  WALKING("walking"),
  RUNNING("running"),
  DRIVING("driving"),
  CYCLING("cycling"),
  UNKNOWN("unknown")
}

class ExpoGeofencingModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private lateinit var fusedLocationClient: FusedLocationProviderClient
  private lateinit var geofencingClient: GeofencingClient
  private lateinit var activityRecognitionClient: ActivityRecognitionClient
  private lateinit var batteryOptimizationHelper: BatteryOptimizationHelper
  
  private var geofenceList = mutableListOf<Geofence>()
  private var locationCallback: LocationCallback? = null
  private var activityCallback: PendingIntent? = null
  private var isMonitoringActive = false
  private var healthCheckInterval = 5 * 60 * 1000L // 5 minutes

  override fun definition() = ModuleDefinition {
    Name("ExpoGeofencing")

    Events("onGeofenceEvent", "onActivityRecognition", "onLocationUpdate", "onHealthAlert", "onServiceStatus")

    OnCreate {
      fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
      geofencingClient = LocationServices.getGeofencingClient(context)
      activityRecognitionClient = ActivityRecognition.getClient(context)
      batteryOptimizationHelper = BatteryOptimizationHelper(context)
    }

    AsyncFunction("addGeofence") { region: GeofenceRegionRecord, promise: Promise ->
      if (!validateGeofenceRegion(region)) {
        promise.reject("INVALID_REGION", "Invalid geofence region parameters", null)
        return@AsyncFunction
      }
      if (!hasLocationPermission()) {
        promise.reject("PERMISSION_DENIED", "Location permission not granted", null)
        return@AsyncFunction
      }

      val geofence = Geofence.Builder()
        .setRequestId(region.id)
        .setCircularRegion(region.latitude, region.longitude, region.radius)
        .setExpirationDuration(Geofence.NEVER_EXPIRE)
        .setTransitionTypes(
          (if (region.notifyOnEntry) Geofence.GEOFENCE_TRANSITION_ENTER else 0) or
          (if (region.notifyOnExit) Geofence.GEOFENCE_TRANSITION_EXIT else 0)
        )
        .build()

      geofenceList.add(geofence)

      val geofencingRequest = GeofencingRequest.Builder()
        .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
        .addGeofence(geofence)
        .build()

      val pendingIntent = createGeofencePendingIntent()

      geofencingClient.addGeofences(geofencingRequest, pendingIntent)
        .addOnSuccessListener { 
          startPersistenceServiceIfNeeded()
          sendServiceStatusUpdate()
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          promise.reject("GEOFENCE_ERROR", "Failed to add geofence: ${exception.message}", exception)
        }
    }

    AsyncFunction("removeGeofence") { regionId: String, promise: Promise ->
      geofencingClient.removeGeofences(listOf(regionId))
        .addOnSuccessListener {
          geofenceList.removeAll { it.requestId == regionId }
          sendServiceStatusUpdate()
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          promise.reject("GEOFENCE_ERROR", "Failed to remove geofence: ${exception.message}", exception)
        }
    }

    AsyncFunction("removeAllGeofences") { promise: Promise ->
      geofencingClient.removeGeofences(createGeofencePendingIntent())
        .addOnSuccessListener {
          geofenceList.clear()
          sendServiceStatusUpdate()
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          promise.reject("GEOFENCE_ERROR", "Failed to remove all geofences: ${exception.message}", exception)
        }
    }

    AsyncFunction("startActivityRecognition") { intervalMs: Long, promise: Promise ->
      if (intervalMs < 1000) {
        promise.reject("INVALID_INTERVAL", "Activity recognition interval must be at least 1000ms", null)
        return@AsyncFunction
      }
      val intent = Intent(context, ActivityRecognitionReceiver::class.java)
      activityCallback = PendingIntent.getBroadcast(
        context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )

      activityRecognitionClient.requestActivityUpdates(intervalMs, activityCallback!!)
        .addOnSuccessListener {
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          promise.reject("ACTIVITY_ERROR", "Failed to start activity recognition: ${exception.message}", exception)
        }
    }

    AsyncFunction("stopActivityRecognition") { promise: Promise ->
      activityCallback?.let { callback ->
        activityRecognitionClient.removeActivityUpdates(callback)
          .addOnSuccessListener {
            promise.resolve(null)
          }
          .addOnFailureListener { exception ->
            promise.reject("ACTIVITY_ERROR", "Failed to stop activity recognition: ${exception.message}", exception)
          }
      } ?: promise.resolve(null)
    }

    AsyncFunction("startLocationUpdates") { options: LocationUpdateOptionsRecord, promise: Promise ->
      if (!validateLocationUpdateOptions(options)) {
        promise.reject("INVALID_OPTIONS", "Invalid location update options", null)
        return@AsyncFunction
      }
      if (!hasLocationPermission()) {
        promise.reject("PERMISSION_DENIED", "Location permission not granted", null)
        return@AsyncFunction
      }

      val locationRequest = LocationRequest.Builder(
        getPriorityFromString(options.priority),
        options.interval
      )
        .setMinUpdateIntervalMillis(options.fastestInterval)
        .setMinUpdateDistanceMeters(options.smallestDisplacement)
        .build()

      locationCallback = object : LocationCallback() {
        override fun onLocationResult(locationResult: LocationResult) {
          locationResult.locations.forEach { location ->
            sendEvent("onLocationUpdate", mapOf(
              "latitude" to location.latitude,
              "longitude" to location.longitude,
              "accuracy" to location.accuracy,
              "timestamp" to location.time
            ))
          }
        }
      }

      fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback!!, Looper.getMainLooper())
        .addOnSuccessListener {
          isMonitoringActive = true
          startPersistenceServiceIfNeeded()
          promise.resolve(null)
        }
        .addOnFailureListener { exception ->
          promise.reject("LOCATION_ERROR", "Failed to start location updates: ${exception.message}", exception)
        }
    }

    AsyncFunction("stopLocationUpdates") { promise: Promise ->
      locationCallback?.let { callback ->
        fusedLocationClient.removeLocationUpdates(callback)
        locationCallback = null
        isMonitoringActive = false
        promise.resolve(null)
      } ?: promise.resolve(null)
    }

    // New functions for enhanced features
    AsyncFunction("checkBatteryOptimization") { promise: Promise ->
      val isOptimized = !batteryOptimizationHelper.isBatteryOptimizationDisabled()
      val deviceInstructions = batteryOptimizationHelper.getDeviceSpecificBatteryOptimizationInstructions()
      val locationEnabled = batteryOptimizationHelper.checkLocationServicesEnabled()
      
      promise.resolve(mapOf(
        "isBatteryOptimized" to isOptimized,
        "isLocationEnabled" to locationEnabled,
        "deviceInstructions" to deviceInstructions
      ))
    }

    AsyncFunction("requestBatteryOptimizationDisable") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        try {
          val activity = appContext.currentActivity as? Activity
          if (activity != null) {
            batteryOptimizationHelper.requestBatteryOptimizationDisable(activity, promise)
          } else {
            promise.reject("NO_ACTIVITY", "No current activity available", null)
          }
        } catch (e: Exception) {
          promise.reject("BATTERY_OPTIMIZATION_ERROR", "Failed to request battery optimization disable: ${e.message}", e)
        }
      } else {
        promise.resolve(true) // Not needed on older versions
      }
    }

    AsyncFunction("openLocationSettings") { promise: Promise ->
      try {
        batteryOptimizationHelper.openLocationSettings()
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("SETTINGS_ERROR", "Failed to open location settings: ${e.message}", e)
      }
    }

    AsyncFunction("setHealthCheckInterval") { intervalMs: Long, promise: Promise ->
      if (intervalMs < 60000) { // Minimum 1 minute
        promise.reject("INVALID_INTERVAL", "Health check interval must be at least 60000ms (1 minute)", null)
        return@AsyncFunction
      }
      
      healthCheckInterval = intervalMs
      
      // Restart health monitoring with new interval
      if (isMonitoringActive) {
        LocationHealthMonitor.stopMonitoring(context)
        LocationHealthMonitor.startMonitoring(context, intervalMs)
      }
      
      promise.resolve(null)
    }

    AsyncFunction("getServiceStatus") { promise: Promise ->
      val status = mapOf(
        "isMonitoringActive" to isMonitoringActive,
        "activeGeofences" to geofenceList.size,
        "isBatteryOptimized" to !batteryOptimizationHelper.isBatteryOptimizationDisabled(),
        "isLocationEnabled" to batteryOptimizationHelper.checkLocationServicesEnabled(),
        "healthCheckInterval" to healthCheckInterval,
        "hasLocationPermission" to hasLocationPermission(),
        "hasBackgroundLocationPermission" to hasBackgroundLocationPermission(),
        "hasActivityRecognitionPermission" to hasActivityRecognitionPermission()
      )
      
      promise.resolve(status)
    }

    AsyncFunction("forceLocationCheck") { promise: Promise ->
      if (!hasLocationPermission()) {
        promise.reject("PERMISSION_DENIED", "Location permission not granted", null)
        return@AsyncFunction
      }

      val locationRequest = LocationRequest.Builder(
        Priority.PRIORITY_HIGH_ACCURACY,
        1000
      ).setMaxUpdateDelayMillis(5000).build()

      fusedLocationClient.requestLocationUpdates(
        locationRequest,
        object : LocationCallback() {
          override fun onLocationResult(locationResult: LocationResult) {
            fusedLocationClient.removeLocationUpdates(this)
            val location = locationResult.lastLocation
            if (location != null) {
              promise.resolve(mapOf(
                "latitude" to location.latitude,
                "longitude" to location.longitude,
                "accuracy" to location.accuracy,
                "timestamp" to location.time
              ))
            } else {
              promise.reject("NO_LOCATION", "Unable to get current location", null)
            }
          }
        },
        Looper.getMainLooper()
      )
    }
  }

  private fun hasLocationPermission(): Boolean {
    return ActivityCompat.checkSelfPermission(
      context,
      Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED
  }

  private fun createGeofencePendingIntent(): PendingIntent {
    val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
    return PendingIntent.getBroadcast(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun getPriorityFromString(priority: String): Int {
    return when (priority) {
      "high_accuracy" -> Priority.PRIORITY_HIGH_ACCURACY
      "balanced" -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
      "low_power" -> Priority.PRIORITY_LOW_POWER
      "no_power" -> Priority.PRIORITY_PASSIVE
      else -> Priority.PRIORITY_HIGH_ACCURACY
    }
  }

  private fun validateGeofenceRegion(region: GeofenceRegionRecord): Boolean {
    return region.id.isNotEmpty() &&
           region.latitude >= -90.0 && region.latitude <= 90.0 &&
           region.longitude >= -180.0 && region.longitude <= 180.0 &&
           region.radius > 0 && region.radius <= 10000 // Max 10km radius
  }

  private fun validateLocationUpdateOptions(options: LocationUpdateOptionsRecord): Boolean {
    return options.interval >= 1000 && // Min 1 second
           options.fastestInterval >= 500 && // Min 500ms
           options.smallestDisplacement >= 0 &&
           options.priority in listOf("high_accuracy", "balanced", "low_power", "no_power")
  }

  private fun hasBackgroundLocationPermission(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ContextCompat.checkSelfPermission(
        context,
        android.Manifest.permission.ACCESS_BACKGROUND_LOCATION
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      hasLocationPermission() // Background permission included in location permission on older versions
    }
  }

  private fun hasActivityRecognitionPermission(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ContextCompat.checkSelfPermission(
        context,
        android.Manifest.permission.ACTIVITY_RECOGNITION
      ) == PackageManager.PERMISSION_GRANTED
    } else {
      true // Not required on older versions
    }
  }

  private fun startPersistenceServiceIfNeeded() {
    if (geofenceList.isNotEmpty() || isMonitoringActive) {
      GeofencingPersistenceService.startService(context)
    }
  }

  private fun sendServiceStatusUpdate() {
    val status = mapOf(
      "isMonitoringActive" to isMonitoringActive,
      "activeGeofences" to geofenceList.size,
      "timestamp" to System.currentTimeMillis()
    )
    sendEvent("onServiceStatus", status)
  }
}