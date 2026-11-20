#!/usr/bin/env bash
# Creates the permanent Android signing key (macOS/Linux). Windows: use create-signing-key.ps1.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dir="$root/signing"; mkdir -p "$dir"
ks="$dir/armo-learn-release.jks"
if [ -f "$ks" ]; then echo "A key already exists at $ks. Keep using it."; exit 1; fi
command -v keytool >/dev/null || { echo "keytool not found: install a Java JDK (e.g. Temurin 17)."; exit 1; }

pass="$(openssl rand -base64 18 | tr '+/=' 'xxx')"
alias=armolearn
keytool -genkeypair -keystore "$ks" -storetype PKCS12 -alias "$alias" -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$pass" -keypass "$pass" -dname "CN=Armo Learn, O=Personal"
base64 < "$ks" | tr -d '\n' > "$dir/ANDROID_KEYSTORE_BASE64.txt"
fp="$(keytool -list -v -keystore "$ks" -alias "$alias" -storepass "$pass" | grep -m1 'SHA256:' | awk '{print $2}')"
cat > "$dir/github-secrets.txt" <<EOF
Add these repository secrets (Settings -> Secrets and variables -> Actions):
  ANDROID_KEY_ALIAS          = $alias
  ANDROID_KEYSTORE_PASSWORD  = $pass
  ANDROID_KEY_PASSWORD       = $pass
  ANDROID_KEYSTORE_BASE64    = (contents of signing/ANDROID_KEYSTORE_BASE64.txt)
Certificate SHA-256: $fp
EOF
echo "Created $ks"; echo "Instructions: $dir/github-secrets.txt"; echo "SHA-256: $fp"
if command -v gh >/dev/null; then
  read -r -p "Add the secrets to this repo with gh now? (y/n) " a
  if [ "$a" = y ]; then
    (cd "$root" && gh secret set ANDROID_KEYSTORE_BASE64 < "$dir/ANDROID_KEYSTORE_BASE64.txt" \
      && printf %s "$pass" | gh secret set ANDROID_KEYSTORE_PASSWORD \
      && printf %s "$pass" | gh secret set ANDROID_KEY_PASSWORD \
      && printf %s "$alias" | gh secret set ANDROID_KEY_ALIAS && echo "Secrets added.")
  fi
fi
