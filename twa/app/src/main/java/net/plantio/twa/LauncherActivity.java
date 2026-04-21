package net.plantio.twa;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabsIntent;

public class LauncherActivity extends androidx.activity.ComponentActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String url = "https://plant-share-001.plantio.net";
        try {
            ApplicationInfo ai = getPackageManager()
                    .getApplicationInfo(getPackageName(), PackageManager.GET_META_DATA);
            if (ai.metaData != null) {
                String override = ai.metaData.getString("defaultUrl");
                if (override != null) url = override;
            }
        } catch (PackageManager.NameNotFoundException ignored) {}

        CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder()
                .setShowTitle(false)
                .build();
        customTabsIntent.launchUrl(this, Uri.parse(url));
        finish();
    }
}
