#!/usr/bin/env bash
# 은혜로운 예배 성도 iOS → App Store Connect / TestFlight 업로드
# 조작용 scripts/ios-testflight-upload.sh 와 동일 패턴 (팀 ZJYZ656BL8, API 키 env).
# 시크릿은 커밋하지 않는다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TEAM_ID="${APPLE_TEAM_ID:-ZJYZ656BL8}"
BUNDLE_ID="${IOS_BUNDLE_ID:-org.eunhye.worship.member}"
BUILD_DIR="${IOS_BUILD_DIR:-$ROOT/build/ios-member}"
ARCHIVE_PATH="$BUILD_DIR/App.xcarchive"
EXPORT_DIR="$BUILD_DIR/export"
UPLOAD_DIR="$BUILD_DIR/upload"
XCODE_PROJECT="$ROOT/ios-member/App/App.xcodeproj"

write_export_options() {
  local dest="$1"
  local path="$2"
  cat > "$path" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>destination</key>
	<string>${dest}</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>teamID</key>
	<string>${TEAM_ID}</string>
	<key>uploadSymbols</key>
	<true/>
	<key>manageAppVersionAndBuildNumber</key>
	<true/>
</dict>
</plist>
PLIST
}

echo "== 1) 성도 정적 웹 → Capacitor ios-member 동기화 =="
npm run member:mobile:sync

if [[ ! -d "$XCODE_PROJECT" ]]; then
  echo "Xcode 프로젝트가 없습니다: $XCODE_PROJECT" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR"
write_export_options export "$BUILD_DIR/ExportOptions-export.plist"
write_export_options upload "$BUILD_DIR/ExportOptions-upload.plist"

echo "== 2) 서명 없이 Archive (Development 프로파일/기기 불필요) =="
rm -rf "$ARCHIVE_PATH"
xcodebuild archive \
  -project "$XCODE_PROJECT" \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGNING_ALLOWED=NO

echo "== 3) Distribution 서명으로 IPA export =="
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportOptionsPlist "$BUILD_DIR/ExportOptions-export.plist" \
  -exportPath "$EXPORT_DIR" \
  -allowProvisioningUpdates

IPA="$EXPORT_DIR/App.ipa"
if [[ ! -f "$IPA" ]]; then
  echo "IPA가 없습니다: $IPA" >&2
  exit 1
fi
echo "IPA: $IPA (bundle $BUNDLE_ID)"

echo "== 4) App Store Connect 업로드 =="
rm -rf "$UPLOAD_DIR"
mkdir -p "$UPLOAD_DIR"

AUTH_ARGS=()
if [[ -n "${APP_STORE_CONNECT_API_KEY_PATH:-}" && -n "${APP_STORE_CONNECT_KEY_ID:-}" && -n "${APP_STORE_CONNECT_ISSUER_ID:-}" ]]; then
  AUTH_ARGS=(
    -authenticationKeyPath "$APP_STORE_CONNECT_API_KEY_PATH"
    -authenticationKeyID "$APP_STORE_CONNECT_KEY_ID"
    -authenticationKeyIssuerID "$APP_STORE_CONNECT_ISSUER_ID"
  )
fi

set +e
if [[ ${#AUTH_ARGS[@]} -gt 0 ]]; then
  xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportOptionsPlist "$BUILD_DIR/ExportOptions-upload.plist" \
    -exportPath "$UPLOAD_DIR" \
    -allowProvisioningUpdates \
    "${AUTH_ARGS[@]}"
else
  xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportOptionsPlist "$BUILD_DIR/ExportOptions-upload.plist" \
    -exportPath "$UPLOAD_DIR" \
    -allowProvisioningUpdates
fi
UPLOAD_STATUS=$?
set -e

if [[ $UPLOAD_STATUS -ne 0 ]]; then
  echo "" >&2
  echo "업로드 실패. 흔한 원인:" >&2
  echo "  1) App Store Connect에 번들 ID $BUNDLE_ID 앱이 없음 → 앱을 먼저 만드세요." >&2
  echo "  2) Xcode 계정 세션 만료 → Xcode → Settings → Accounts 에서 다시 로그인." >&2
  echo "  3) API 키를 쓰려면 APP_STORE_CONNECT_API_KEY_PATH / KEY_ID / ISSUER_ID 를 설정." >&2
  exit "$UPLOAD_STATUS"
fi

echo "업로드 요청 완료. App Store Connect → TestFlight 에서 처리·내부 테스트 그룹을 확인하세요."
