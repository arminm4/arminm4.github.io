#!/usr/bin/env bash
# Writes .well-known/assetlinks.json from the signing key stored in repository secrets.
# This file proves to Android that the app and the website belong together, so the
# Trusted Web Activity opens full-screen without a browser URL bar.
set -euo pipefail
out="$1"

if [ -z "${KEYSTORE_B64:-}" ]; then
  if [ -f "$out" ]; then echo "Using committed $out"; else echo "No signing-key secrets: skipping assetlinks.json (Android app will show a URL bar)."; fi
  exit 0
fi

ks="$(mktemp)"
echo "$KEYSTORE_B64" | base64 -d > "$ks"
fp=$(keytool -list -v -keystore "$ks" -alias "$KEY_ALIAS" -storepass "$KEYSTORE_PASSWORD" | grep -m1 'SHA256:' | awk '{print $2}')
rm -f "$ks"
if [ -z "$fp" ]; then echo "::error::Could not read the certificate fingerprint. Check the ANDROID_* secrets."; exit 1; fi

mkdir -p "$(dirname "$out")"
cat > "$out" <<JSON
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "${APP_ID}",
    "sha256_cert_fingerprints": ["${fp}"]
  }
}]
JSON
echo "Wrote $out for ${APP_ID} (${fp})"
