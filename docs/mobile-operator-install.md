# 은혜로운 예배 — iPhone·iPad 슬라이드 리모컨

조작만 iPhone·iPad에서 합니다. **하는 일은 현재 예배 슬라이드를 넘기는 것**뿐입니다. 송출은 Mac/Windows 데스크톱 앱이 담당합니다. 같은 Wi‑Fi에서 포트 `18765`로 지금 두 줄만 보냅니다.

주보·사람·라이브러리·전체 설정은 **데스크톱 조작 앱**에서만 씁니다.

## TestFlight로 설치 (권장)

1. iPhone·iPad에 **TestFlight** 앱을 설치합니다.
2. App Store Connect에서 초청 메일을 받거나, 내부 테스트 그룹에 이미 들어가 있으면 TestFlight에 **은혜로운 예배 Remote**가 보입니다.
3. TestFlight에서 **설치** → 앱을 엽니다.
4. 아래 [한 번에 하는 일](#한-번에-하는-일)대로 로그인·송출 연결·슬라이드 넘기기를 합니다.

처리 중인 빌드는 App Store Connect → TestFlight에 몇 분~수십 분 뒤에 나타납니다. 내부 테스트 그룹이 있으면 그 그룹에 빌드를 넣습니다.

## 한 번에 하는 일

1. 송출 컴퓨터에서 **은혜로운 예배 송출**을 켭니다.
2. iPhone·iPad에서 **은혜로운 예배 Remote**를 엽니다.
3. 로그인합니다.
4. 처음이거나 연결이 없으면 오른쪽 위 **송출**을 눌러 송출 컴퓨터 IP를 넣고 **저장하고 연결**을 누릅니다. (예: `192.168.0.10`) 이미 저장돼 있으면 자동으로 붙습니다.
5. **현재 예배**를 고르거나(진행 중이면 자동), **이전 / 다음**으로 슬라이드를 넘깁니다.

로컬 네트워크 권한을 물으면 **허용**합니다.

## Mac에서 TestFlight용 빌드·업로드

Node.js 20+, Xcode, 유료 Apple Developer 팀이 있는 Mac에서. Xcode → Settings → Accounts에 팀이 로그인돼 있어야 합니다.

**먼저** [App Store Connect](https://appstoreconnect.apple.com)에 iOS 앱을 만듭니다.

- 이름: `은혜로운 예배 Remote` (홈 화면·TestFlight 표시 이름. ASC 앱 레코드 이름도 같게 바꿔 두면 목록이 맞춰집니다.)
- 번들 ID: `org.eunhye.worship.operator` (이미 Developer에 있으면 그걸 고름)

그다음:

```bash
git clone https://github.com/anyplan75/church.git
cd church
cp .env.example .env.local   # Firebase 값 채운 뒤 (커밋 금지)
npm install
bash scripts/ios-testflight-upload.sh
```

스크립트는 `STATIC_EXPORT` 정적 빌드 → `cap sync` → 서명 없는 Archive → Distribution 서명 IPA → App Store Connect 업로드까지 합니다. (연결된 iPhone이 없어도 됩니다.)

업로드 후 App Store Connect → TestFlight에서 빌드 처리가 끝나면 내부 테스터에게 보입니다.

선택: App Store Connect API 키를 쓰려면 셸에만 `APP_STORE_CONNECT_API_KEY_PATH`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`를 두고 같은 스크립트를 실행합니다. 키 파일은 저장소에 넣지 않습니다.

## 개발용 시뮬레이터

로컬에서 화면만 확인할 때: `npm run mobile:sync` 후 `npm run mobile:ios:sim` (또는 Xcode Run).

## 웹만 다시 넣고 싶을 때

화면 코드를 고친 뒤:

```bash
npm run mobile:sync
```

`out/`을 iOS 프로젝트에 다시 복사하고 `eunhye-app-id`(조작 번들)를 HTML에 넣습니다. TestFlight에 다시 올리려면 `bash scripts/ios-testflight-upload.sh`를 실행합니다.

조작 iOS(`ios/`)는 `NextExportRouter`로 `/login/`·`/remote/` 하위 HTML을 열고, 시작은 `/login/` 입니다. Firebase 부트가 멈춰도(또는 공개 키가 비어 있어도) 제한 시간 후 로그인 화면으로 넘어갑니다. Mac 복귀 후 재업로드: [`testflight-reupload.md`](./testflight-reupload.md).

## 되는 것 / 안 되는 것

| 되는 것 | 안 되는 것 |
| --- | --- |
| 로그인, 현재 예배 고르기 | 주보·사람·라이브러리·전체 설정 |
| 큰 이전/다음, 현재·다음 두 줄 미리보기 | 송출 화면(송출은 데스크톱) |
| 송출 IP 한 번 저장·자동 연결 | iPhone에서 로컬 txt 폴더 연결 |

가사·성경 **본문 txt는 조작 컴퓨터**에 둡니다. 모바일은 예배 진행·슬라이드 넘김·송출 연결만 담당합니다.

## 관련 문서

- 데스크톱 설치: [`docs/desktop-install.md`](./desktop-install.md)
- 전체 구조: [`../전체구조안내서.md`](../전체구조안내서.md)
