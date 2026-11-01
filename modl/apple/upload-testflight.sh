#!/bin/sh
# 테스트플라이트 업로드. 자격과 비밀이 있을 때만 진행합니다.
# 값이 없으면 이름만 알리고 끝냅니다. 올린 것처럼 말하지 않습니다.

set -eu

missing=""
need() {
  name="$1"
  eval "value=\${$name-}"
  if [ -z "$value" ]; then
    missing="$missing $name"
  fi
}

need APPLE_TEAM_ID
need MODL_BUNDLE_ID
need APP_STORE_CONNECT_API_KEY_ID
need APP_STORE_CONNECT_API_ISSUER_ID
need APP_STORE_CONNECT_API_KEY_PATH

if [ -z "${APPLE_ID-}" ]; then
  missing="$missing APPLE_ID"
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Xcode 가 없습니다. 아카이브와 시뮬레이터 실행을 하지 않습니다."
  echo "없는 비밀:$missing"
  exit 2
fi

if [ -n "$missing" ]; then
  echo "테스트플라이트에 올리지 않습니다. 없는 비밀:$missing"
  exit 2
fi

if [ ! -f "$APP_STORE_CONNECT_API_KEY_PATH" ]; then
  echo "테스트플라이트에 올리지 않습니다. APP_STORE_CONNECT_API_KEY_PATH 파일이 없습니다."
  exit 2
fi

root=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
archive="$root/build/Modl.xcarchive"
export_dir="$root/build/export"
mkdir -p "$root/build"

xcodebuild \
  -project "$root/Modl.xcodeproj" \
  -scheme Modl \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$archive" \
  MODL_BUNDLE_ID="$MODL_BUNDLE_ID" \
  APPLE_TEAM_ID="$APPLE_TEAM_ID" \
  archive

cat > "$root/build/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>upload</string>
  <key>teamID</key>
  <string>$APPLE_TEAM_ID</string>
  <key>signingStyle</key>
  <string>automatic</string>
  <key>uploadSymbols</key>
  <true/>
</dict>
</plist>
EOF

xcodebuild \
  -exportArchive \
  -archivePath "$archive" \
  -exportPath "$export_dir" \
  -exportOptionsPlist "$root/build/ExportOptions.plist" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$APP_STORE_CONNECT_API_KEY_PATH" \
  -authenticationKeyID "$APP_STORE_CONNECT_API_KEY_ID" \
  -authenticationKeyIssuerID "$APP_STORE_CONNECT_API_ISSUER_ID"

echo "업로드 명령이 끝났습니다. App Store Connect 의 테스트플라이트에서 빌드 번호를 확인하세요."
