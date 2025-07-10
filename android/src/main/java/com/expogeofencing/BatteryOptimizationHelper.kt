package com.expogeofencing

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.annotation.RequiresApi
import expo.modules.kotlin.Promise

class BatteryOptimizationHelper(private val context: Context) {
    
    fun isBatteryOptimizationDisabled(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            powerManager.isIgnoringBatteryOptimizations(context.packageName)
        } else {
            true // Not applicable for older versions
        }
    }
    
    @RequiresApi(Build.VERSION_CODES.M)
    fun requestBatteryOptimizationDisable(activity: Activity, promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
            }
            activity.startActivityForResult(intent, BATTERY_OPTIMIZATION_REQUEST_CODE)
            promise.resolve(true)
        } catch (e: Exception) {
            // Fallback to general battery optimization settings
            try {
                val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                activity.startActivity(intent)
                promise.resolve(true)
            } catch (e2: Exception) {
                promise.reject("BATTERY_OPTIMIZATION_ERROR", "Cannot open battery optimization settings: ${e2.message}", e2)
            }
        }
    }
    
    fun getDeviceSpecificBatteryOptimizationInstructions(): Map<String, String> {
        val manufacturer = Build.MANUFACTURER.lowercase()
        val model = Build.MODEL.lowercase()
        
        return when {
            manufacturer.contains("xiaomi") -> mapOf(
                "manufacturer" to "Xiaomi",
                "instructions" to "Go to Settings > Apps > Manage Apps > [App Name] > Battery saver > No restrictions. Also disable 'Auto-start management'",
                "additionalSettings" to "MIUI Optimization, Autostart, Battery optimization"
            )
            
            manufacturer.contains("huawei") -> mapOf(
                "manufacturer" to "Huawei",
                "instructions" to "Go to Settings > Apps > [App Name] > Battery > App launch > Manage manually. Enable all options.",
                "additionalSettings" to "Protected apps, Startup manager, Battery optimization"
            )
            
            manufacturer.contains("oppo") -> mapOf(
                "manufacturer" to "OPPO",
                "instructions" to "Go to Settings > Battery > Battery Optimization > [App Name] > Don't optimize. Also add to startup manager.",
                "additionalSettings" to "Auto-launch management, Battery optimization"
            )
            
            manufacturer.contains("vivo") -> mapOf(
                "manufacturer" to "Vivo",
                "instructions" to "Go to Settings > Battery > Background Activity Manager > [App Name] > Allow background activity",
                "additionalSettings" to "Auto-launch, High background activity"
            )
            
            manufacturer.contains("samsung") -> mapOf(
                "manufacturer" to "Samsung",
                "instructions" to "Go to Settings > Apps > [App Name] > Battery > Optimize battery usage > Turn off. Add to 'Never sleeping apps'",
                "additionalSettings" to "Sleeping apps, Battery optimization, Auto-start"
            )
            
            manufacturer.contains("oneplus") -> mapOf(
                "manufacturer" to "OnePlus",
                "instructions" to "Go to Settings > Battery > Battery optimization > [App Name] > Don't optimize. Enable Auto-launch.",
                "additionalSettings" to "Battery optimization, Auto-launch"
            )
            
            else -> mapOf(
                "manufacturer" to "Generic Android",
                "instructions" to "Go to Settings > Apps > [App Name] > Battery > Battery optimization > Don't optimize",
                "additionalSettings" to "Battery optimization, Auto-start, Background activity"
            )
        }
    }
    
    fun checkLocationServicesEnabled(): Boolean {
        return try {
            val locationMode = Settings.Secure.getInt(
                context.contentResolver,
                Settings.Secure.LOCATION_MODE
            )
            locationMode != Settings.Secure.LOCATION_MODE_OFF
        } catch (e: Settings.SettingNotFoundException) {
            false
        }
    }
    
    fun openLocationSettings() {
        val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
    
    companion object {
        const val BATTERY_OPTIMIZATION_REQUEST_CODE = 1001
    }
}