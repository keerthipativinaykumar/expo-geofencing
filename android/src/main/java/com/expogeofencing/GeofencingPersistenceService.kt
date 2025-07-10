package com.expogeofencing

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import java.util.concurrent.TimeUnit

class GeofencingPersistenceService : Service() {
    private var wakeLock: PowerManager.WakeLock? = null
    private var isServiceRunning = false
    
    companion object {
        private const val CHANNEL_ID = "geofencing_persistence_channel"
        private const val NOTIFICATION_ID = 1000
        private const val TAG = "GeofencingPersistence"
        private const val WAKELOCK_TAG = "ExpoGeofencing:PersistenceWakeLock"
        
        fun startService(context: Context) {
            val intent = Intent(context, GeofencingPersistenceService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
        
        fun stopService(context: Context) {
            val intent = Intent(context, GeofencingPersistenceService::class.java)
            context.stopService(intent)
        }
    }
    
    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "GeofencingPersistenceService created")
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!isServiceRunning) {
            isServiceRunning = true
            startForeground(NOTIFICATION_ID, createPersistentNotification())
            acquireWakeLock()
            
            // Start location health monitoring
            LocationHealthMonitor.startMonitoring(this)
            
            Log.d(TAG, "GeofencingPersistenceService started")
        }
        
        // Return START_STICKY to ensure service restarts if killed
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        releaseWakeLock()
        LocationHealthMonitor.stopMonitoring(this)
        Log.d(TAG, "GeofencingPersistenceService destroyed")
    }
    
    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        Log.d(TAG, "Task removed, scheduling restart")
        
        // Schedule restart using AlarmManager
        val restartIntent = Intent(this, ServiceRestartReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            this, 0, restartIntent, PendingIntent.FLAG_IMMUTABLE
        )
        
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val restartTime = System.currentTimeMillis() + 5000 // Restart after 5 seconds
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                restartTime,
                pendingIntent
            )
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, restartTime, pendingIntent)
        }
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Geofencing Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps geofencing active in the background"
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }
            
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }
    
    private fun createPersistentNotification(): Notification {
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent, PendingIntent.FLAG_IMMUTABLE
        )
        
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Geofencing Active")
            .setContentText("Location monitoring is running")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }
    
    private fun acquireWakeLock() {
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                WAKELOCK_TAG
            )
            wakeLock?.acquire(TimeUnit.HOURS.toMillis(1)) // 1 hour timeout
            Log.d(TAG, "WakeLock acquired")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to acquire WakeLock", e)
        }
    }
    
    private fun releaseWakeLock() {
        try {
            wakeLock?.let { wl ->
                if (wl.isHeld) {
                    wl.release()
                    Log.d(TAG, "WakeLock released")
                }
            }
            wakeLock = null
        } catch (e: Exception) {
            Log.e(TAG, "Failed to release WakeLock", e)
        }
    }
}

// Receiver to restart the service when it's killed
class ServiceRestartReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("ServiceRestartReceiver", "Restarting GeofencingPersistenceService")
        GeofencingPersistenceService.startService(context)
    }
}