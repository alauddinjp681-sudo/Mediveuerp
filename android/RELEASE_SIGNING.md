# Android release signing

The Android release workflow signs both the installable APK and Play Store AAB with the same release key. Keep a secure backup of the **existing** keystore and use it for every future release; generating a replacement key will change the app certificate and prevent Android from installing an update over an existing installation signed by the old key. An upload-key reset in Google Play does not change the signing key for apps enrolled in Play App Signing.

## GitHub Actions secrets

In the repository, configure these four secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded bytes of the existing `.jks`/`.keystore` file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Existing signing key alias |
| `ANDROID_KEY_PASSWORD` | Password for that alias |

The workflow decodes the keystore to a permission-restricted temporary file on the runner, passes its path and the three credentials to Gradle via environment variables, then removes the temporary file. Never commit the keystore, put passwords in Gradle files, or generate a new key to work around missing secrets. Gradle fails release tasks when any setting is missing or the keystore file is unavailable. Debug builds do not use this release key and must not be distributed as updates over production installs.

Before storing secrets, confirm the key alias and signing certificate fingerprint against the keystore used for the currently distributed app. If that original key is unavailable, stop release signing and recover the correct key; this configuration cannot make a different key compatible.
