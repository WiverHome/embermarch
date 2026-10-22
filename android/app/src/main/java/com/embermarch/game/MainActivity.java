package com.embermarch.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
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
 *
 * Если адрес сервера сменился (BuildConfig.LEGACY_ORIGIN), localStorage остался под
 * прежним происхождением: при первом запуске он один раз копируется под новое
 * (пустые страницы MIGRATE_PATH отдаются из APK, сеть не нужна).
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

    private static final String MIGRATE_PATH = "/__migrate.html";
    private static final String PREF_MIGRATED = "legacyStorageMigrated";
    /** Всё содержимое localStorage одной JSON-строкой; null, если пусто. */
    private static final String DUMP_JS = "(function(){var o={},n=0;for(var i=0;i<localStorage.length;i++)"
            + "{var k=localStorage.key(i);o[k]=localStorage.getItem(k);n++;}return n?JSON.stringify(o):null;})()";
    /** Переносит ключи, которых ещё нет под новым адресом (новое не затирается). */
    private static final String RESTORE_JS = "(function(d){var o=JSON.parse(d);for(var k in o)"
            + "{if(localStorage.getItem(k)===null)localStorage.setItem(k,o[k]);}return true;})";

    private WebView webView;
    private Uri origin;
    private Uri legacy;
    private int migrateStep;
    private String legacyDump;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        origin = Uri.parse(BuildConfig.GAME_ORIGIN);
        legacy = BuildConfig.LEGACY_ORIGIN.isEmpty() ? null : Uri.parse(BuildConfig.LEGACY_ORIGIN);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0c0a0d"));
        setContentView(webView);
        enterImmersive();
        applyCutoutInsets();
        registerBackCallback();

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        s.setTextZoom(100);
        // EmbermarchOffline: клиент (js/lang-api.js, OFFLINE_BUILD) запускается гостем без сервера
        s.setUserAgentString(s.getUserAgentString() + " EmbermarchAndroid/" + BuildConfig.VERSION_NAME
                + (BuildConfig.OFFLINE ? " EmbermarchOffline" : ""));

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

            @Override
            public void onPageFinished(WebView view, String url) {
                onMigratePageFinished(Uri.parse(url));
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

        if (legacy != null && !prefs().getBoolean(PREF_MIGRATED, false)) {
            // перенос не закончен (в том числе если его прервал поворот экрана) - начать заново
            migrateStep = 1;
            webView.loadUrl(BuildConfig.LEGACY_ORIGIN + MIGRATE_PATH);
        } else if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            loadGame();
        }
    }

    private void loadGame() {
        webView.loadUrl(BuildConfig.GAME_ORIGIN + "/");
    }

    private SharedPreferences prefs() {
        return getSharedPreferences("embermarch", MODE_PRIVATE);
    }

    /** Шаг 1: прочитать localStorage прежнего адреса; шаг 2: записать под новым. */
    private void onMigratePageFinished(Uri u) {
        if (!MIGRATE_PATH.equals(u.getPath())) return;
        if (migrateStep == 1 && sameOrigin(u, legacy)) {
            migrateStep = 2;
            webView.evaluateJavascript(DUMP_JS, dump -> {
                legacyDump = dump;
                webView.loadUrl(BuildConfig.GAME_ORIGIN + MIGRATE_PATH);
            });
        } else if (migrateStep == 2 && isGameOrigin(u)) {
            migrateStep = 0;
            String dump = legacyDump;
            legacyDump = null;
            if (dump == null || "null".equals(dump)) {
                finishMigration();
                return;
            }
            // dump - строковый литерал JSON, его можно подставить в JS как есть
            webView.evaluateJavascript(RESTORE_JS + "(" + dump + ")", r -> finishMigration());
        }
    }

    private void finishMigration() {
        prefs().edit().putBoolean(PREF_MIGRATED, true).apply();
        loadGame();
    }

    private boolean isGameOrigin(Uri u) {
        return sameOrigin(u, origin);
    }

    private static boolean sameOrigin(Uri u, Uri o) {
        return u != null && o != null
                && "https".equals(u.getScheme())
                && o.getHost().equalsIgnoreCase(u.getHost())
                && o.getPort() == u.getPort();
    }

    /** Файл клиента из APK; null - запрос идёт в сеть (/api, /admin, внешние ресурсы). */
    private WebResourceResponse serveLocal(WebResourceRequest req) {
        Uri u = req.getUrl();
        if (MIGRATE_PATH.equals(u.getPath()) && (isGameOrigin(u) || sameOrigin(u, legacy))) {
            return new WebResourceResponse("text/html", "UTF-8",
                    new java.io.ByteArrayInputStream("<!doctype html><meta charset=utf-8>".getBytes()));
        }
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

    /** Android 13+: «назад» приходит сюда (enableOnBackInvokedCallback в манифесте; с targetSdk 36 onBackPressed не вызывается). */
    private void registerBackCallback() {
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        handleBack();
    }

    private void handleBack() {
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
