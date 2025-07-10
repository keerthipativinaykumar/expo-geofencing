package com.expogeofencing

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import expo.modules.kotlin.modules.ModuleRegistry
import expo.modules.kotlin.AppContext

class GeofenceBroadcastReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val geofencingEvent = GeofencingEvent.fromIntent(intent)
    
    if (geofencingEvent == null) {
      Log.e("GeofenceBroadcast", "Geofencing event is null")
      return
    }
    
    if (geofencingEvent.hasError()) {
      Log.e("GeofenceBroadcast", "Geofencing error: ${geofencingEvent.errorCode}")
      return
    }

    val geofenceTransition = geofencingEvent.geofenceTransition
    val triggeringGeofences = geofencingEvent.triggeringGeofences
    val location = geofencingEvent.triggeringLocation

    if (geofenceTransition == Geofence.GEOFENCE_TRANSITION_ENTER ||
        geofenceTransition == Geofence.GEOFENCE_TRANSITION_EXIT) {
      
      val eventType = if (geofenceTransition == Geofence.GEOFENCE_TRANSITION_ENTER) "enter" else "exit"
      
      triggeringGeofences?.forEach { geofence ->
        val eventData = mapOf(
          "regionId" to geofence.requestId,
          "eventType" to eventType,
          "timestamp" to System.currentTimeMillis(),
          "latitude" to (location?.latitude ?: 0.0),
          "longitude" to (location?.longitude ?: 0.0)
        )
        
        try {
          // Send event to JavaScript
          val appContext = AppContext.create(context)
          val moduleRegistry = appContext.moduleRegistry
          val module = moduleRegistry.getModule("ExpoGeofencing") as? ExpoGeofencingModule
          module?.sendEvent("onGeofenceEvent", eventData)
        } catch (e: Exception) {
          Log.e("GeofenceBroadcast", "Error sending geofence event: ${e.message}")
        }
      }
    }
  }
}