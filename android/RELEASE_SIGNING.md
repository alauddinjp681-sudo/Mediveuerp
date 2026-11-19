# Android release signing

Configure the four `ANDROID_KEYSTORE_*` / `ANDROID_KEY_*` GitHub Actions secrets required by `.github/workflows/build-apk.yml`.

Keep the same release keystore and key alias for every update. Replacing the signing key changes the app certificate, so Google Play can reject updates to the existing app.
