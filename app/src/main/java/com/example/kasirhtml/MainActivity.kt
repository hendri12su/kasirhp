package com.example.kasirhtml

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.viewinterop.AndroidView

class MainActivity : ComponentActivity() {

    private lateinit var webViewRef: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = Color(0xFFF3F4F6)
            ) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        WebView(ctx).apply {
                            webViewRef = this
                            webViewClient = WebViewClient()
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.databaseEnabled = true
                            settings.allowFileAccess = true
                            settings.cacheMode = WebSettings.LOAD_DEFAULT
                            addJavascriptInterface(KasirBridge(ctx), "AndroidKasir")
                            loadUrl("file:///android_asset/index.html")
                        }
                    }
                )
            }
        }
    }

    inner class KasirBridge(private val context: Context) {
        private val prefs = context.getSharedPreferences("kasir_hp_prefs", Context.MODE_PRIVATE)

        @JavascriptInterface
        fun saveData(key: String, value: String) {
            prefs.edit().putString(key, value).apply()
        }

        @JavascriptInterface
        fun loadData(key: String, defaultValue: String): String {
            return prefs.getString(key, defaultValue) ?: defaultValue
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webViewRef.isInitialized && webViewRef.canGoBack()) {
            webViewRef.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }
}
