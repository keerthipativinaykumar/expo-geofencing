package com.expogeofencing

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity
import expo.modules.kotlin.modules.ModuleRegistry
import expo.modules.kotlin.AppContext

class ActivityRecognitionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (ActivityRecognitionResult.hasResult(intent)) {
      val result = ActivityRecognitionResult.extractResult(intent)
      val mostProbableActivity = result?.mostProbableActivity
      
      if (mostProbableActivity != null) {
        val activityType = getActivityString(mostProbableActivity.type)
        val confidence = mostProbableActivity.confidence
        
        val eventData = mapOf(
          "activity" to activityType,
          "confidence" to confidence,
          "timestamp" to System.currentTimeMillis()
        )
        
        try {
          // Send event to JavaScript
          val appContext = AppContext.create(context)
          val moduleRegistry = appContext.moduleRegistry
          val module = moduleRegistry.getModule("ExpoGeofencing") as? ExpoGeofencingModule
          module?.sendEvent("onActivityRecognition", eventData)
        } catch (e: Exception) {
          Log.e("ActivityRecognition", "Error sending activity event: ${e.message}")
        }
      }
    }
  }
  
  private fun getActivityString(activityType: Int): String {
    return when (activityType) {
      DetectedActivity.STILL -> "still"
      DetectedActivity.WALKING -> "walking"
      DetectedActivity.RUNNING -> "running"
      DetectedActivity.IN_VEHICLE -> "driving"
      DetectedActivity.ON_BICYCLE -> "cycling"
      DetectedActivity.ON_FOOT -> "walking"
      DetectedActivity.TILTING -> "unknown"
      else -> "unknown"
    }
  }
}