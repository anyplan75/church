# 은혜로운 예배 성도 — iOS (Capacitor)

조작 앱(`ios/`, 번들 `org.eunhye.worship.operator`, 표시 이름 **은혜로운 예배 Remote**)과 **분리**된 성도용 셸입니다.

| 항목 | 값 |
| --- | --- |
| 표시 이름 | 은혜로운 예배 성도 |
| 번들 ID | `org.eunhye.worship.member` |
| ASC 앱 ID | `6824340939` |
| SKU | `eunhye-worship-member` |
| 설정 파일 | 저장소 루트 `capacitor.member.config.ts` (`ios.path = ios-member`) |
| 첫 화면 | `/member` |
| AppIcon | 기도하는 손 (`assets/app-icons/eunhye-member-praying-hands-1024.png`) |

## 처음 한 번 / 웹 다시 넣기

```bash
npm run member:mobile:sync
```

이 명령이 `out/` 정적 웹을 만들고, `capacitor.config.ts`를 잠시 멤버용으로 바꾼 뒤 `ios-member`에 `cap add`/`cap sync`를 실행한 다음 조작용 설정을 되돌립니다. **`ios/` Remote 프로젝트는 건드리지 않습니다.**

Xcode에서 확인할 것:

- `PRODUCT_BUNDLE_IDENTIFIER = org.eunhye.worship.member`
- `CFBundleDisplayName = 은혜로운 예배 성도`
- `DEVELOPMENT_TEAM = ZJYZ656BL8`

## TestFlight 업로드

App Store Connect API 키는 환경 변수로만 넘깁니다(커밋 금지).

```bash
export APP_STORE_CONNECT_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_XXXX.p8"
export APP_STORE_CONNECT_KEY_ID="XXXX"
export APP_STORE_CONNECT_ISSUER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
npm run member:mobile:ios:testflight
```

업로드 후 ASC → **TestFlight** → 빌드 처리가 끝나면 내부 테스트 그룹에 빌드를 추가하세요.

자세한 기능·권한은 [`docs/member-app.md`](../docs/member-app.md)를 보세요.
