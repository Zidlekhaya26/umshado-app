package com.umshado.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.content.pm.ActivityInfo;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);

		// Lock portrait
		setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

		// Immersive fullscreen
		getWindow().getDecorView().setSystemUiVisibility(
			View.SYSTEM_UI_FLAG_FULLSCREEN
			| View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
			| View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
		);

		// Make WebView background transparent and allow mixed content if required
		if (getBridge() != null && getBridge().getWebView() != null) {
			getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
			try {
				getBridge().getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
			} catch (Exception e) {
				// ignore if method not available on older WebView
			}
		}
	}

	@Override
	public void onBackPressed() {
		if (getBridge() != null && getBridge().getWebView() != null && getBridge().getWebView().canGoBack()) {
			getBridge().getWebView().goBack();
		} else {
			moveTaskToBack(true);
		}
	}
}
