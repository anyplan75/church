# TestFlight 재업로드 (Mac 복귀 후)

클라우드에서 빈 화면·「불러오는 중」코드 수정은 머지할 수 있습니다. **Archive·업로드는 Xcode가 있는 Mac**에서 합니다. JUN MacBook이 다시 붙으면 아래만 실행하면 됩니다.

## 준비

1. 저장소 최신 `main`(또는 머지된 PR 브랜치)을 받습니다.
2. `.env.local`에 Firebase **공개** 값을 채웁니다(커밋 금지).

```bash
cp .env.example .env.local
# NEXT_PUBLIC_FIREBASE_API_KEY=
# NEXT_PUBLIC_FIREBASE_DATABASE_URL=
```

3. Xcode → Settings → Accounts에 팀 `ZJYZ656BL8` 로그인.
4. (선택) App Store Connect API 키 환경 변수:

```bash
export APP_STORE_CONNECT_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_XXXX.p8"
export APP_STORE_CONNECT_KEY_ID="XXXX"
export APP_STORE_CONNECT_ISSUER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

## 조작 Remote (`org.eunhye.worship.operator`)

```bash
cd /path/to/church
npm install
bash scripts/ios-testflight-upload.sh
```

- 표시 이름: **은혜로운 예배 Remote**
- 빌드 번호: Xcode `CURRENT_PROJECT_VERSION` (**9** 이상)
- sync가 `out/` → `ios/App/App/public` + `eunhye-app-id` 주입 + `/login/` 시작 검사를 합니다.

## 성도 (`org.eunhye.worship.member`)

```bash
cd /path/to/church
npm install
npm run member:mobile:ios:testflight
```

- 표시 이름: **은혜로운 예배 성도**
- ASC 앱 ID: `6824340939`
- 빌드 번호: **10** 이상
- `ios/` Remote 프로젝트는 건드리지 않습니다.

## 업로드 후

1. [App Store Connect](https://appstoreconnect.apple.com) → 각 앱 → **TestFlight**
2. 빌드 처리(수 분~수십 분) 대기
3. **내부 테스트** 그룹에 새 빌드를 넣고 테스터 초대
4. 기기에서 이전 앱 **삭제 후** 재설치(캐시·옛 public HTML 제거)

## 확인 체크

| 앱 | 기대 |
| --- | --- |
| Remote | 열자마자 「불러오는 중」에 안 멈추고 **로그인** 또는 `/remote` |
| 성도 | **빈 화면 아님** → 로그인 또는 `/member` |
| 둘 다 | 오프라인·느린망에서도 약 18초 안에 로그인 화면으로 실패 개방 |

## 관련

- 조작 설치: [`mobile-operator-install.md`](./mobile-operator-install.md)
- 성도 앱: [`member-app.md`](./member-app.md)
- `ios-member/README.md`
