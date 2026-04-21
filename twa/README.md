# plant.io TWA (Trusted Web Activity)

Android app wrapper for the plant.io PWA. This opens your web dashboard
as a fullscreen Android app using Chrome Custom Tabs.

## Build instructions

You need Android Studio (or a machine with JDK 17 + Android SDK 34).

### 1. Generate a signing key

```bash
keytool -genkeypair -v -keystore plantio.keystore \
  -alias plantio -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Get the SHA-256 fingerprint

```bash
keytool -list -v -keystore plantio.keystore -alias plantio | grep SHA256
```

### 3. Update asset links

Replace `PLACEHOLDER:UPDATE_WITH_YOUR_SIGNING_KEY_FINGERPRINT` in
`web/public/.well-known/assetlinks.json` with the fingerprint from step 2.

Rebuild and redeploy the web container so the file is live at:
`https://plant-share-001.plantio.net/.well-known/assetlinks.json`

### 4. Build the APK

Open this `twa/` folder in Android Studio, or from command line:

```bash
cd twa
./gradlew assembleRelease
```

The APK will be at `app/build/outputs/apk/release/app-release-unsigned.apk`.

Sign it:
```bash
apksigner sign --ks plantio.keystore --ks-key-alias plantio app-release-unsigned.apk
```

### 5. Install on your phone

```bash
adb install app-release-unsigned.apk
```

Or transfer the APK to your phone and open it.

### 6. (Optional) Publish to Google Play

1. Create a Google Play Developer account ($25 one-time fee)
2. Build an AAB instead: `./gradlew bundleRelease`
3. Upload the signed AAB to the Play Console

## Alternative: PWABuilder (no local build needed)

1. Go to https://pwabuilder.com
2. Enter `https://plant-share-001.plantio.net`
3. Click "Package for stores" > "Android"
4. Download the generated APK/AAB
5. Follow their instructions for signing and publishing
