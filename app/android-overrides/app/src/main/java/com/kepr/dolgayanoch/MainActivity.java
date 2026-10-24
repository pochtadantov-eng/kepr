package com.kepr.dolgayanoch;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

// Полноэкранный режим: прячем строку состояния и навигацию, рисуем игру под вырезом камеры
// и передаём размеры выреза в страницу, чтобы кнопки не оказались под камерой.
public class MainActivity extends BridgeActivity {
    private Insets cutout = Insets.NONE;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams attrs = getWindow().getAttributes();
            attrs.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attrs);
        }
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideSystemBars();

        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (view, insets) -> {
            cutout = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            sendCutoutToPage();
            return ViewCompat.onApplyWindowInsets(view, insets);
        });
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                sendCutoutToPage();
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    private void sendCutoutToPage() {
        if (bridge == null || bridge.getWebView() == null) return;
        float density = getResources().getDisplayMetrics().density;
        String js = "(function(s){"
            + "s.setProperty('--cut-l','" + Math.round(cutout.left / density) + "px');"
            + "s.setProperty('--cut-r','" + Math.round(cutout.right / density) + "px');"
            + "s.setProperty('--cut-t','" + Math.round(cutout.top / density) + "px');"
            + "s.setProperty('--cut-b','" + Math.round(cutout.bottom / density) + "px');"
            + "})(document.documentElement.style)";
        bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(js, null));
    }
}
