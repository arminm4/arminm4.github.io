# Creates the permanent Android signing key for the Armo Learn app (Windows PowerShell).
# Run once:   powershell -ExecutionPolicy Bypass -File scripts\create-signing-key.ps1
#
# It writes:
#   signing\armo-learn-release.jks     the key (keep a backup; never commit it, it's git-ignored)
#   signing\github-secrets.txt         the 4 values to paste into GitHub → Settings → Secrets → Actions
# If the GitHub CLI (gh) is installed and logged in, it can add the secrets for you.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'signing'
New-Item -ItemType Directory -Force $dir | Out-Null
$ks = Join-Path $dir 'armo-learn-release.jks'
if (Test-Path $ks) {
  Write-Host "A key already exists at $ks." -ForegroundColor Yellow
  Write-Host "Keep using it: replacing it means Android can no longer update the installed app."
  exit 1
}

# Locate keytool (ships with every Java JDK).
$keytool = $null
if ($env:JAVA_HOME) { $c = Join-Path $env:JAVA_HOME 'bin\keytool.exe'; if (Test-Path $c) { $keytool = $c } }
if (-not $keytool) { $cmd = Get-Command keytool -ErrorAction SilentlyContinue; if ($cmd) { $keytool = $cmd.Source } }
if (-not $keytool) {
  $found = Get-ChildItem 'C:\Program Files\Java', 'C:\Program Files\Eclipse Adoptium', 'C:\Program Files\Microsoft', 'C:\Program Files\Android\Android Studio\jbr' -Recurse -Filter keytool.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($found) { $keytool = $found.FullName }
}
if (-not $keytool) { throw 'keytool was not found. Install a Java JDK (for example Eclipse Temurin 17) and run this again.' }
Write-Host "Using $keytool"

$bytes = New-Object byte[] 18
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$pass = [Convert]::ToBase64String($bytes) -replace '[+/=]', 'x'
$alias = 'armolearn'

& $keytool -genkeypair -keystore $ks -storetype PKCS12 -alias $alias -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass $pass -keypass $pass -dname 'CN=Armo Learn, O=Personal'
if ($LASTEXITCODE -ne 0) { throw 'keytool failed to create the key.' }

$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($ks))
$line = & $keytool -list -v -keystore $ks -alias $alias -storepass $pass | Select-String 'SHA256:' | Select-Object -First 1
$fp = $line.ToString().Trim().Split(' ', [StringSplitOptions]::RemoveEmptyEntries)[-1]

$info = @"
Armo Learn: Android signing key
================================
Keep signing\armo-learn-release.jks and this file somewhere safe (a password manager or a private cloud folder).

Add these 4 repository secrets on GitHub:
  your repo -> Settings -> Secrets and variables -> Actions -> New repository secret

  Name: ANDROID_KEY_ALIAS
  Value: $alias

  Name: ANDROID_KEYSTORE_PASSWORD
  Value: $pass

  Name: ANDROID_KEY_PASSWORD
  Value: $pass

  Name: ANDROID_KEYSTORE_BASE64
  Value: (the entire contents of signing\ANDROID_KEYSTORE_BASE64.txt)

Certificate SHA-256 fingerprint (the Pages workflow puts this into /.well-known/assetlinks.json):
  $fp
"@
Set-Content -Path (Join-Path $dir 'github-secrets.txt') -Value $info -Encoding UTF8
Set-Content -Path (Join-Path $dir 'ANDROID_KEYSTORE_BASE64.txt') -Value $b64 -Encoding ASCII -NoNewline

Write-Host ''
Write-Host 'Signing key created.' -ForegroundColor Green
Write-Host "Secrets and instructions: $(Join-Path $dir 'github-secrets.txt')"
Write-Host "SHA-256 fingerprint: $fp"

$gh = Get-Command gh -ErrorAction SilentlyContinue
if ($gh) {
  $ans = Read-Host 'GitHub CLI found. Add the 4 secrets to the GitHub repo of this folder now? (y/n)'
  if ($ans -eq 'y') {
    Push-Location $root
    try {
      $b64 | gh secret set ANDROID_KEYSTORE_BASE64
      $pass | gh secret set ANDROID_KEYSTORE_PASSWORD
      $pass | gh secret set ANDROID_KEY_PASSWORD
      $alias | gh secret set ANDROID_KEY_ALIAS
      Write-Host 'Secrets added.' -ForegroundColor Green
    } finally { Pop-Location }
  }
} else {
  Write-Host 'Next: add the 4 secrets on GitHub (see github-secrets.txt). Open the .txt files in Notepad to copy the values.'
}
