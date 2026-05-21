package com.clothshop

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.view.ViewGroup
import android.webkit.*
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val CAMERA_PERMISSION_CODE = 2001
    private var pendingPermissionRequest: PermissionRequest? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        isAppInForeground = true

        // Web view programmatic installation
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        webView = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                1.0f
            )
        }

        layout.addView(webView)
        setContentView(layout)

        // Optimize settings
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            webView.settings.mediaPlaybackRequiresUserGesture = false
        }

        // Web Client - Stay inside the app
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                view.loadUrl(url)
                return true
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest?): Boolean {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    val url = request?.url?.toString() ?: ""
                    view.loadUrl(url)
                }
                return true
            }
        }

        // Handle permissions delegation
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                val resources = request.resources
                var isCameraRequested = false
                for (resource in resources) {
                    if (resource == PermissionRequest.RESOURCE_VIDEO_CAPTURE) {
                        isCameraRequested = true
                        break
                    }
                }

                if (isCameraRequested) {
                    if (ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.CAMERA
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                    } else {
                        pendingPermissionRequest = request
                        ActivityCompat.requestPermissions(
                            this@MainActivity,
                            arrayOf(Manifest.permission.CAMERA),
                            CAMERA_PERMISSION_CODE
                        )
                    }
                } else {
                    request.grant(resources)
                }
            }
        }

        // Handle File / Base64 Download directly saved to Gallery
        webView.setDownloadListener { url, _, _, _, _ ->
            if (url.startsWith("data:image/")) {
                try {
                    val base64Data = url.substringAfter(",")
                    val imageBytes = Base64.decode(base64Data, Base64.DEFAULT)

                    val filename = "AlifGarments_QR_${System.currentTimeMillis()}.png"
                    val resolver = contentResolver
                    val contentValues = ContentValues().apply {
                        put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                        put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/AlifGarments")
                        }
                    }

                    val imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
                    if (imageUri != null) {
                        resolver.openOutputStream(imageUri).use { out ->
                            out?.write(imageBytes)
                        }
                        Toast.makeText(this@MainActivity, "QR কোড সফলভাবে গ্যালারিতে সেভ হয়েছে!", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(this@MainActivity, "সংরক্ষণ করতে ব্যর্থ হয়েছে!", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    Toast.makeText(this@MainActivity, "ডাউনলোড ত্রুটি: ${e.message}", Toast.LENGTH_LONG).show()
                }
            } else {
                Toast.makeText(this@MainActivity, "ডাউনলোড হচ্ছে...", Toast.LENGTH_SHORT).show()
            }
        }

        // Connect Javascript Interface to WebView for persistent sync and token saving
        webView.addJavascriptInterface(WebAppInterface(), "AndroidInterface")

        // Start Foreground Sync Service to process actions on connection change
        try {
            val serviceIntent = Intent(this, SyncForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Check startup camera privileges
        checkAndRequestPrivileges()

        // Load pre-bundled assets
        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun checkAndRequestPrivileges() {
        val permissionsToRequest = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }
        
        // Write permission exists under API 29
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }

        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissionsToRequest.toTypedArray(),
                CAMERA_PERMISSION_CODE
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_CODE) {
            val pReq = pendingPermissionRequest
            if (grantResults.isNotEmpty()) {
                var cameraGranted = false
                for (i in permissions.indices) {
                    if (permissions[i] == Manifest.permission.CAMERA && grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                        cameraGranted = true
                        break
                    }
                }

                if (cameraGranted) {
                    pReq?.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                    Toast.makeText(this, "ক্যামেরা পারমিশন গ্র্যান্ট হয়েছে!", Toast.LENGTH_SHORT).show()
                } else {
                    pReq?.deny()
                    Toast.makeText(this, "ক্যামেরা ব্যবহারের অনুমতি ছাড়া স্ক্যান করা যাবে না।", Toast.LENGTH_SHORT).show()
                }
            } else {
                pReq?.deny()
            }
            pendingPermissionRequest = null
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    inner class WebAppInterface {
        @JavascriptInterface
        fun saveSyncAction(actionJson: String) {
            val sharedPrefs = getSharedPreferences("clothshop_prefs", Context.MODE_PRIVATE)
            val actionsStr = sharedPrefs.getString("sync_actions", "[]") ?: "[]"
            try {
                val array = JSONArray(actionsStr)
                val newAction = JSONObject(actionJson)
                
                // Avoid duplicating items with same action ID
                var exists = false
                val newId = newAction.optString("id")
                for (i in 0 until array.length()) {
                    if (array.getJSONObject(i).optString("id") == newId) {
                        exists = true
                        break
                    }
                }
                if (!exists) {
                    array.put(newAction)
                    sharedPrefs.edit().putString("sync_actions", array.toString()).apply()
                }
                
                // Trigger Background Sync Service check
                val serviceIntent = Intent(this@MainActivity, SyncForegroundService::class.java).apply {
                    action = "TRIGGER_SYNC"
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent)
                } else {
                    startService(serviceIntent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun removeSyncAction(actionIdsJson: String) {
            val sharedPrefs = getSharedPreferences("clothshop_prefs", Context.MODE_PRIVATE)
            val actionsStr = sharedPrefs.getString("sync_actions", "[]") ?: "[]"
            try {
                val array = JSONArray(actionsStr)
                val idsToRemove = JSONArray(actionIdsJson)
                val idSet = mutableSetOf<String>()
                for (i in 0 until idsToRemove.length()) {
                    idSet.add(idsToRemove.getString(i))
                }

                val newArray = JSONArray()
                for (i in 0 until array.length()) {
                    val action = array.getJSONObject(i)
                    if (!idSet.contains(action.optString("id"))) {
                        newArray.put(action)
                    }
                }
                sharedPrefs.edit().putString("sync_actions", newArray.toString()).apply()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        @JavascriptInterface
        fun getSyncActions(): String {
            val sharedPrefs = getSharedPreferences("clothshop_prefs", Context.MODE_PRIVATE)
            return sharedPrefs.getString("sync_actions", "[]") ?: "[]"
        }

        @JavascriptInterface
        fun saveSessionToken(token: String) {
            val sharedPrefs = getSharedPreferences("clothshop_prefs", Context.MODE_PRIVATE)
            sharedPrefs.edit().putString("sb_token", token).apply()
        }

        @JavascriptInterface
        fun downloadBase64Image(base64Data: String, filename: String) {
            try {
                // Ensure correct cleaner base64 substring
                val pureBase64 = if (base64Data.contains(",")) {
                    base64Data.substringAfter(",")
                } else {
                    base64Data
                }
                
                val imageBytes = Base64.decode(pureBase64, Base64.DEFAULT)
                val resolver = contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
                    put(MediaStore.MediaColumns.MIME_TYPE, "image/png")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/ClothShop")
                    }
                }

                val imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)
                if (imageUri != null) {
                    resolver.openOutputStream(imageUri).use { out ->
                        out?.write(imageBytes)
                    }
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "QR কোড সফলভাবে গ্যালারিতে সেভ হয়েছে!", Toast.LENGTH_LONG).show()
                    }
                } else {
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "গ্যালারিতে সেভ করা যায়নি", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "ডাউনলোড ত্রুটি: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    companion object {
        var isAppInForeground = false
    }

    override fun onResume() {
        super.onResume()
        isAppInForeground = true
    }

    override fun onStart() {
        super.onStart()
        isAppInForeground = true
    }

    override fun onStop() {
        super.onStop()
        isAppInForeground = false
    }
}
