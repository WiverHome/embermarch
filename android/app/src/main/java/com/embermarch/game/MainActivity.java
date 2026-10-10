package com.embermarch.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Клиент игры лежит в assets/www и отдаётся под происхождением сервера игры
 * (BuildConfig.GAME_ORIGIN). Поэтому location.origin и API_BASE в клиенте
 * совпадают с сервером: /api и WebSocket уходят в сеть, всё остальное читается из APK.
 */
public class MainActivity extends Activity {

    private static final String ASSET_ROOT = "www";
    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html");
        MIME.put("css", "text/css");
        MIME.put("js", "application/javascript");
        MIME.put("json", "application/json");
        MIME.put("webmanifest", "application/manifest+json");
        MIME.put("png", "image/png");
        MIME.put("svg", "image/svg+xml");
        MIME.put("mp3", "audio/mpeg");
    }

    private WebView webView;
    private Uri origin;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        origin = Uri.parse(BuildConfig.GAME_ORIGIN);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0c0a0d"));
        setContentView(webView);
        enterImmersive();
        applyCutoutInsets();

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " EmbermarchAndroid/" + BuildConfig.VERSION_NAME);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return serveLocal(req);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (isGameOrigin(u) && !u.getPath().startsWith("/admin")) return false;
                openExternal(u);
                return true;
            }
        });

        // Старый service worker с этого происхождения не должен перехватывать запросы
        if (Build.VERSION.SDK_INT >= 24) {
            ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebResourceRequest req) {
                    return serveLocal(req);
                }
            });
        }

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(BuildConfig.GAME_ORIGIN + "/");
    }

    private boolean isGameOrigin(Uri u) {
        return u != null
                && "https".equals(u.getScheme())
                && origin.getHost().equalsIgnoreCase(u.getHost())
                && origin.getPort() == u.getPort();
    }

    /** Файл клиента из APK; null - запрос идёт в сеть (/api, /admin, внешние ресурсы). */
    private WebResourceResponse serveLocal(WebResourceRequest req) {
        Uri u = req.getUrl();
        if (!isGameOrigin(u) || !"GET".equalsIgnoreCase(req.getMethod())) return null;
        String path = u.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
        if (path.startsWith("/api/") || path.startsWith("/admin")) return null;
        // Service worker в APK не нужен: регистрация тихо завершится ошибкой
        if ("/sw.js".equals(path)) return notFound();
        if (path.contains("..")) return notFound();

        String ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase();
        String mime = MIME.get(ext);
        if (mime == null) return notFound();
        try {
            AssetManager am = getAssets();
            InputStream in = am.open(ASSET_ROOT + path);
            String enc = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "UTF-8" : null;
            WebResourceResponse r = new WebResourceResponse(mime, enc, in);
            Map<String, String> h = new HashMap<>();
            h.put("Cache-Control", "no-cache");
            h.put("Access-Control-Allow-Origin", BuildConfig.GAME_ORIGIN);
            r.setResponseHeaders(h);
            return r;
        } catch (IOException e) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, null);
    }

    private void openExternal(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException ignored) {
        }
    }

    @SuppressWarnings("deprecation")
    private void enterImmersive() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 28) {
            w.getAttributes().layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    /** Вырез камеры: интерфейс не должен уходить под него. */
    private void applyCutoutInsets() {
        if (Build.VERSION.SDK_INT < 30) return;
        webView.setOnApplyWindowInsetsListener((v, insets) -> {
            android.graphics.Insets i = insets.getInsets(
                    WindowInsets.Type.displayCutout() | WindowInsets.Type.systemBars());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsets.CONSUMED;
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersive();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // Игра одностраничная: «назад» закрывает модальное окно (обязательное - не трогает),
        // а без окна сворачивает приложение
        webView.evaluateJavascript(
                "(function(){var m=document.getElementById('modal-root');"
                        + "if(!m||!m.firstChild)return false;"
                        + "var b=m.querySelector('.modal-close');if(b)b.click();return true;})()",
                handled -> {
                    if (!"true".equals(handled)) moveTaskToBack(true);
                });
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
