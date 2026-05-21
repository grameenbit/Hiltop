package com.clothshop

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class SyncForegroundService : Service() {

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)
    private lateinit var connectivityManager: ConnectivityManager
    private lateinit var sharedPreferences: SharedPreferences
    private var isSyncing = false

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            super.onAvailable(network)
            // Perform auto background sync when network is available
            triggerBackgroundSync()
        }
    }

    override fun onCreate() {
        super.onCreate()
        sharedPreferences = getSharedPreferences("clothshop_prefs", Context.MODE_PRIVATE)
        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        createNotificationChannel()
        startForeground(1002, getNotification("অফলাইন ডাটা সিঙ্ক ম্যানেজার চালু আছে"))

        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(networkRequest, networkCallback)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "TRIGGER_SYNC") {
            triggerBackgroundSync()
        }
        return START_STICKY
    }

    private fun triggerBackgroundSync() {
        if (MainActivity.isAppInForeground) {
            System.out.println("SyncForegroundService: App is in foreground, skipping background synchronization.")
            return
        }

        synchronized(this) {
            if (isSyncing) {
                System.out.println("SyncForegroundService: Already syncing, skipping concurrent run.")
                return
            }
            isSyncing = true
        }

        scope.launch {
            try {
                val token = sharedPreferences.getString("sb_token", "") ?: ""
                val actionsJsonStr = sharedPreferences.getString("sync_actions", "[]") ?: "[]"
                val actionsArray = JSONArray(actionsJsonStr)

                if (actionsArray.length() == 0) return@launch

                val supabaseUrl = "https://pzfuthyzfxkjnpldczrm.supabase.co"
                val supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6ZnV0aHl6Znhram5wbGRjenJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjYzNjgsImV4cCI6MjA5NDQwMjM2OH0.QQ8XWuyiiAZm_FglGIpK1kT7eZhRGfMT5RpRS88h9vs"
                val activeToken = if (token.isNotEmpty()) token else supabaseAnonKey

                val indicesToRemove = mutableListOf<Int>()
                
                for (i in 0 until actionsArray.length()) {
                    val actionObj = actionsArray.getJSONObject(i)
                    val table = actionObj.getString("table")
                    val type = actionObj.getString("type") // insert, update, delete
                    val payload = actionObj.getJSONObject("payload")
                    
                    var success = false
                    try {
                        val endpointUrl = when (type) {
                            "insert" -> "$supabaseUrl/rest/v1/$table"
                            "update", "delete" -> {
                                val matchKey = actionObj.optJSONObject("match")?.keys()?.asSequence()?.firstOrNull()
                                if (matchKey != null) {
                                    val matchVal = actionObj.optJSONObject("match")?.getString(matchKey)
                                    "$supabaseUrl/rest/v1/$table?$matchKey=eq.$matchVal"
                                } else {
                                    "$supabaseUrl/rest/v1/$table"
                                }
                            }
                            else -> "$supabaseUrl/rest/v1/$table"
                        }

                        val url = URL(endpointUrl)
                        val conn = url.openConnection() as HttpURLConnection
                        conn.requestMethod = when (type) {
                            "insert" -> "POST"
                            "update" -> "PATCH"
                            "delete" -> "DELETE"
                            else -> "POST"
                        }

                        conn.setRequestProperty("apikey", supabaseAnonKey)
                        conn.setRequestProperty("Authorization", "Bearer $activeToken")
                        conn.setRequestProperty("Content-Type", "application/json")
                        
                        // For PostgreSQL auto-matching & bypass default empty payload check
                        if (type == "insert") {
                            conn.setRequestProperty("Prefer", "return=representation")
                        }

                        if (type != "delete") {
                            conn.doOutput = true
                            OutputStreamWriter(conn.outputStream).use { writer ->
                                writer.write(payload.toString())
                            }
                        }

                        val responseCode = conn.responseCode
                        if (responseCode in 200..299 || responseCode == 409) {
                            success = true
                        } else {
                            // Read error stream for debugging if needed
                            val errStream = conn.errorStream?.bufferedReader()?.use { it.readText() }
                            System.err.println("Background sync HTTP failed: $responseCode - $errStream")
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }

                    if (success) {
                        indicesToRemove.add(i)
                    }
                }

                if (indicesToRemove.isNotEmpty()) {
                    val newActionsArray = JSONArray()
                    for (i in 0 until actionsArray.length()) {
                        if (!indicesToRemove.contains(i)) {
                            newActionsArray.put(actionsArray.get(i))
                        }
                    }
                    sharedPreferences.edit().putString("sync_actions", newActionsArray.toString()).apply()
                    if (newActionsArray.length() == 0) {
                        updateNotificationText("সবগুলো ডাটা সফলভাবে সিঙ্ক করা হয়েছে!")
                    } else {
                        updateNotificationText("অফলাইন ডাটা সিঙ্ক হচ্ছে... (${newActionsArray.length()}টি বাকি)")
                    }
                }

            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                synchronized(this@SyncForegroundService) {
                    isSyncing = false
                }
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                "alifgarments_sync_channel",
                "Alif Garments Background Sync Profile",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(serviceChannel)
        }
    }

    private fun getNotification(text: String): Notification {
        return NotificationCompat.Builder(this, "alifgarments_sync_channel")
            .setContentTitle("Alif Garments - অটোমেটিক অফলাইন সিঙ্ক")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .build()
    }

    private fun updateNotificationText(text: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(1002, getNotification(text))
    }

    override fun onDestroy() {
        super.onDestroy()
        connectivityManager.unregisterNetworkCallback(networkCallback)
        job.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
