# 은혜로운 예배 성도 — iOS (Capacitor)

조작 앱(`ios/`, 번들 `org.eunhye.worship.operator`, 표시 이름 **은혜로운 예배 Remote**)과 **분리**된 성도용 셸입니다.

| 항목 | 값 |
| --- | --- |
| 표시 이름 | 은혜로운 예배 성도 |
| 번들 ID | `org.eunhye.worship.member` |
| 설정 파일 | 저장소 루트 `capacitor.member.config.ts` |
| 첫 화면 | `/member` |

## 처음 한 번 (Mac + Xcode)

1. [App Store Connect](https://appstoreconnect.apple.com)에 iOS 앱을 만듭니다.  
   이름: `은혜로운 예배 성도` · 번들 ID: `org.eunhye.worship.member`
2. 저장소에서 정적 웹을 만듭니다.

```bash
npm run member:mobile:sync
```

3. 조작용 `ios/` 를 건드리지 않도록, **별도 작업 폴더**에서 Capacitor iOS를 추가하는 것을 권장합니다.

```bash
# 예: 임시 복사본에서 성도 설정으로 iOS 생성
cp capacitor.member.config.ts capacitor.config.ts
npx cap add ios
# 생성된 ios/ 를 ios-member/ 로 옮긴 뒤, 조작용 capacitor.config.ts 를 되돌립니다.
```

4. Xcode에서 `PRODUCT_BUNDLE_IDENTIFIER = org.eunhye.worship.member`,  
   `CFBundleDisplayName = 은혜로운 예배 성도` 인지 확인합니다.
5. 로그인 후 앱이 `/member` 로 열리는지 확인합니다. (`lib/mobile-app.ts` 가 `appId`로 성도 셸을 구분합니다.)

웹만 다시 넣으려면 `npm run member:mobile:build-web` 후 `npx cap sync` (성도용 ios 경로)를 실행합니다.

자세한 기능·권한은 [`docs/member-app.md`](../docs/member-app.md)를 보세요.
