package com.thienphat.licgen;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidBridge");
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    public static class WebAppInterface {
        private final Context context;

        public WebAppInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public void copyToClipboard(String text, String label) {
            ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
            ClipData clip = ClipData.newPlainText(label != null ? label : "CDKey", text);
            if (clipboard != null) {
                clipboard.setPrimaryClip(clip);
                Toast.makeText(context, "Đã sao chép CDKey vào bộ nhớ tạm!", Toast.LENGTH_SHORT).show();
            }
        }

        @JavascriptInterface
        public void shareKey(String customer, String cdkey) {
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("text/plain");
            String message = "Mã kích hoạt bản quyền PCCare Master Pro:\n\n"
                + "Khách hàng: " + customer + "\n\n"
                + "Mã CDKey kích hoạt:\n" + cdkey + "\n\n"
                + "Hướng dẫn: Mở phần mềm PCCare Master Pro trên máy tính -> Bấm 'Kích hoạt bản quyền' -> Dán mã CDKey này vào là xong!";
            intent.putExtra(Intent.EXTRA_TEXT, message);
            intent.putExtra(Intent.EXTRA_SUBJECT, "Mã kích hoạt PCCare Master Pro - " + customer);
            Intent chooser = Intent.createChooser(intent, "Chia sẻ mã CDKey qua");
            context.startActivity(chooser);
        }

        @JavascriptInterface
        public void showToast(String msg) {
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show();
        }
    }
}
