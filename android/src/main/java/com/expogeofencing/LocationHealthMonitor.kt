package com.expogeofencing

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.android.gms.location.*
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.ModuleRegistry
import java.util.concurrent.TimeUnit

class LocationHealthMonitor : Service() {
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var notificationManager: NotificationManager
    private var healthCheckHandler: Handler? = null
    private var healthCheckRunnable: Runnable? = null
    private var lastLocationTime: Long = 0
    private var lastAccurateLocationTime: Long = 0
    private var healthCheckInterval: Long = 5 * 60 * 1000 // 5 minutes
    private var isMonitoring = false
    
    companion object {
        private const val CHANNEL_ID = "location_health_channel"
        private const val NOTIFICATION_ID = 1001
        private const val HEALTH_CHECK_NOTIFICATION_ID = 1002
        private const val TAG = "LocationHealthMonitor"
        private const val LOCATION_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
        private const val ACCURATE_LOCATION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
        private const val MIN_ACCURACY_METERS = 50f
        
        fun startMonitoring(context: Context, intervalMs: Long = 5 * 60 * 1000) {
            val intent = Intent(context, LocationHealthMonitor::class.java)
            intent.putExtra("interval", intervalMs)
            context.startForegroundService(intent)
        }
        
        fun stopMonitoring(context: Context) {
            val intent = Intent(context, LocationHealthMonitor::class.java)
            context.stopService(intent)
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        createNotificationChannel()
        Log.d(TAG, "LocationHealthMonitor created")
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val interval = intent?.getLongExtra("interval", 5 * 60 * 1000) ?: 5 * 60 * 1000
        healthCheckInterval = interval
        
        startForeground(NOTIFICATION_ID, createPersistentNotification())
        startHealthChecks()
        
        return START_STICKY // Restart if killed
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        stopHealthChecks()
        Log.d(TAG, "LocationHealthMonitor destroyed")
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Location Health Monitoring",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors location services for geofencing"
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun createPersistentNotification(): android.app.Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Location Monitoring Active")
            .setContentText("Geofencing is running in the background")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }
    
    private fun startHealthChecks() {
        if (isMonitoring) return
        
        isMonitoring = true
        healthCheckHandler = Handler(Looper.getMainLooper())
        healthCheckRunnable = object : Runnable {
            override fun run() {
                performHealthCheck()
                healthCheckHandler?.postDelayed(this, healthCheckInterval)
            }
        }
        
        healthCheckHandler?.post(healthCheckRunnable!!)
        Log.d(TAG, "Health checks started with interval: ${healthCheckInterval}ms")
    }
    
    private fun stopHealthChecks() {
        isMonitoring = false
        healthCheckRunnable?.let { runnable ->
            healthCheckHandler?.removeCallbacks(runnable)
        }
        healthCheckHandler = null
        healthCheckRunnable = null
        Log.d(TAG, "Health checks stopped")
    }
    
    private fun performHealthCheck() {
        Log.d(TAG, "Performing location health check")
        
        try {
            // Check if location services are enabled
            if (!BatteryOptimizationHelper(this).checkLocationServicesEnabled()) {
                sendHealthAlert("Location services are disabled", "Please enable location services to continue geofencing")
                return
            }
            
            // Check battery optimization
            if (!BatteryOptimizationHelper(this).isBatteryOptimizationDisabled()) {
                sendHealthAlert("Battery optimization detected", "App may be killed by battery optimization")
            }
            
            // Request current location for health check
            val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000)
                .setMaxUpdateDelayMillis(5000)
                .build()
            
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                object : LocationCallback() {
                    override fun onLocationResult(result: LocationResult) {
                        fusedLocationClient.removeLocationUpdates(this)
                        handleLocationResult(result.lastLocation)
                    }
                },
                Looper.getMainLooper()
            )
            
            // Set timeout for location request
            Handler(Looper.getMainLooper()).postDelayed({
                checkLocationTimeout()
            }, 30000) // 30 seconds timeout
            
        } catch (e: SecurityException) {
            Log.e(TAG, "Security exception during health check", e)
            sendHealthAlert("Location permission denied", "Please grant location permission")
        } catch (e: Exception) {
            Log.e(TAG, "Error during health check", e)
            sendHealthAlert("Location service error", "Error checking location: ${e.message}")
        }
    }
    
    private fun handleLocationResult(location: Location?) {
        val currentTime = System.currentTimeMillis()
        
        if (location != null) {
            lastLocationTime = currentTime
            
            val accuracy = location.accuracy
            Log.d(TAG, "Location update: accuracy = ${accuracy}m")
            
            if (accuracy <= MIN_ACCURACY_METERS) {
                lastAccurateLocationTime = currentTime
                Log.d(TAG, "Accurate location received")
                
                // Send location to JavaScript
                sendLocationToJS(location)
            } else {
                Log.w(TAG, "Inaccurate location: ${accuracy}m")
            }
        } else {
            Log.w(TAG, "No location received")
        }
        
        // Update persistent notification
        updatePersistentNotification()
    }
    
    private fun checkLocationTimeout() {
        val currentTime = System.currentTimeMillis()
        
        if (currentTime - lastLocationTime > LOCATION_TIMEOUT_MS) {
            Log.w(TAG, "Location timeout detected")
            sendHealthAlert("Location timeout", "No location updates received recently")
        }
        
        if (currentTime - lastAccurateLocationTime > ACCURATE_LOCATION_TIMEOUT_MS) {
            Log.w(TAG, "Accurate location timeout detected")
            sendHealthAlert("GPS accuracy low", "Recent location updates are not accurate enough")
        }
    }
    
    private fun sendHealthAlert(title: String, message: String) {
        Log.w(TAG, "Health alert: $title - $message")
        
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE
        )
        
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        
        notificationManager.notify(HEALTH_CHECK_NOTIFICATION_ID, notification)
        
        // Send to JavaScript
        sendHealthAlertToJS(title, message)
    }
    
    private fun updatePersistentNotification() {
        val currentTime = System.currentTimeMillis()
        val timeSinceLastLocation = currentTime - lastLocationTime
        val timeSinceAccurateLocation = currentTime - lastAccurateLocationTime
        
        val status = when {
            timeSinceLastLocation < 2 * 60 * 1000 -> "Location: Active"
            timeSinceAccurateLocation < 10 * 60 * 1000 -> "Location: Recent"
            else -> "Location: Stale"
        }
        
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Geofencing Monitor")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
    
    private fun sendLocationToJS(location: Location) {
        try {
            val appContext = AppContext.create(this)
            val moduleRegistry = appContext.moduleRegistry
            val module = moduleRegistry.getModule("ExpoGeofencing") as? ExpoGeofencingModule
            
            val locationData = mapOf(
                "latitude" to location.latitude,
                "longitude" to location.longitude,
                "accuracy" to location.accuracy,
                "timestamp" to location.time,
                "isHealthCheck" to true
            )
            
            module?.sendEvent("onLocationUpdate", locationData)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending location to JS", e)
        }
    }
    
    private fun sendHealthAlertToJS(title: String, message: String) {
        try {
            val appContext = AppContext.create(this)
            val moduleRegistry = appContext.moduleRegistry
            val module = moduleRegistry.getModule("ExpoGeofencing") as? ExpoGeofencingModule
            
            val alertData = mapOf(
                "type" to "health_alert",
                "title" to title,
                "message" to message,
                "timestamp" to System.currentTimeMillis()
            )
            
            module?.sendEvent("onHealthAlert", alertData)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending health alert to JS", e)
        }
    }
}