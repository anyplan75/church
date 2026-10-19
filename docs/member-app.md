# 은혜로운 예배 — 성도(교인) 앱

조작용 **Remote**(`/remote`, Capacitor `org.eunhye.worship.operator`)·송출용 데스크톱과 **다른** 성도 전용 화면입니다.  
**예배(부서)별로** 예배 정보·광고·예배 중 자막을 보고, 기도제목을 **담당 목사님**에게 보냅니다. **커뮤니티**도 성도 앱 안에서만 엽니다.

로그인·앱 아이콘 등 **처음 화면**만 제품명 **은혜로운 예배**(성도)를 쓰고, 교회에 들어간 뒤에는 헤더·히어로에 **그 교회 이름**을 크게 둡니다.

주변 교회 주소 검색·등록은 전체 운영자 `/platform` 흐름입니다. → [`church-nearby-select.md`](./church-nearby-select.md)

## 범위

- **성도·커뮤니티·기도함**은 조작 데스크톱 상단 메뉴에 **없습니다**. Remote는 슬라이드만.
- 웹·성도 Capacitor 셸에서 `/member`, `/community`, `/prayers` 를 엽니다.
- **받은 기도함**은 성도 탭이 아니라 `/prayers` 전용입니다. 성도는 기도제목만 **보냅니다**.

## 웹으로 쓰기

배포 주소 예: `https://eunhye-church-app.surge.sh/member/`  
(정적 배포: `STATIC_EXPORT=1 npm run build` 후 `surge ./out` — `out/CNAME`은 `surge-fallback`이 채움)

| 경로 | 하는 일 |
| --- | --- |
| `/member` | 성도 홈(예배정보·예배자막·광고·기도). 헤더에서 **커뮤니티**·(담당 목사면) **기도함** 진입 |
| `/community` | 지역 모임·게시판·나의 교회·채팅·MY (코니아형 5탭) |
| `/prayers` | **담당 목사** 기도함(받은 기도 목록·상태 변경). `settings.pastorUid` 와 같은 계정 |

교회 Firebase 계정으로 로그인합니다. 성도만 쓰는 계정은 보통 **보기(`view`)** 역할이면 충분합니다. (기존 교회 로그인·역할 체계를 그대로 씁니다. `jifc`/`cheil`/`live-interpret` 경로는 건드리지 않습니다.)

### 예배 고르기

헤더의 **예배 선택**으로 주일 1부·2부·청소년부·청년부처럼 **자료가 다른 예배**를 고릅니다.  
고른 예배의 `services/{id}` 자료가 **모든 탭**(예배정보·예배자막·광고·기도 연결)에 공통으로 적용됩니다.  
운영자는 예배마다 순서·광고를 따로 올리고, 성도는 그날 참석하는 예배만 고르면 됩니다.

**기본 고르기**(앱을 연 시각 기준, 선택창으로 언제든 바꿀 수 있음):

1. 진행 중(`live`) 예배
2. **오늘** — 남은 예배 중 가장 가까운 다음 시작(예: 오전 10시 → 11:00 주일 2부, 오후 1시 → 14:00 청년부). 오늘 더 이상 없으면 이미 시작한 예배 중 가장 최근 시작
3. **요일·시각** — 오늘 예배가 없으면, 오늘과 같은 요일·비슷한 시간대의 예배
4. 다가오는 예배 → (없으면) 최근 예배

URL `?service=` 로 특정 예배를 고정할 수 있습니다.

### 탭 안내 (`/member`)

1. **예배정보** — 시간·장소·설교자·지금 순서(진행 중일 때).
2. **예배자막** — 예배 중 큰 글씨 자막. 현재 순서가 찬양이면 가사, 말씀(성경봉독·설교)이면 본문/설교 문구.
3. **광고** — 선택한 예배 `announcements` 목록.
4. **기도** — 기도제목 작성 → `church/churches/{churchId}/prayerRequests/{id}` (`pastorUid` = 담당 목사).

### 예배 중 자막이 따라가는 자료

| 필드 | 의미 |
| --- | --- |
| `service.liveIndex` | 지금 순서(예배 순서 항목 번호) |
| `service.outputLines` | 조작 리모컨·진행이 넘긴 **활성 줄**(최대 2줄, 짧음). 있으면 자막이 이걸 우선 |
| 슬라이드/`songs` | `outputLines`가 비면 허가된 가사·본문 필드로 채움 |

조작 쪽에서 `saveLiveCue`로 순서를 넘기면 `outputLines`가 Firebase에 같이 저장되어, 성도 앱이 같은 예배를 보고 있으면 자막이 갱신됩니다.

### 담당 목사 지정

설정(`/settings`) → **담당 목사 (기도제목 받는 분)** 에서 `admin`/`prepare`/`run` 계정을 고릅니다.  
저장 값: `data/settings.pastorUid`, `pastorName`.

## iOS (Capacitor) 성도 앱

| 항목 | 값 |
| --- | --- |
| 표시 이름 | **은혜로운 예배 성도** |
| 번들 ID | `org.eunhye.worship.member` |
| ASC 앱 ID | `6824340939` (SKU `eunhye-worship-member`) |
| 설정 | `capacitor.member.config.ts` (`ios.path = ios-member`) |
| 프로젝트 | `ios-member/` (조작 `ios/` 와 분리) |
| AppIcon | 굵은 풀블리드·십자가+기도하는 성도 — `assets/app-icons/eunhye-member-app-icon-1024.png` |
| 안내 | `ios-member/README.md` |

조작 앱과 **같은 `out/` 정적 파일**을 쓰되, 네이티브 `appId`로 셸을 구분합니다. 성도 셸은 로그인 후 항상 `/member`로 가며, `/community`·`/prayers` 도 허용합니다.

```bash
npm run member:mobile:sync
```

### TestFlight 업로드

팀 ID는 Remote와 동일(`ZJYZ656BL8`). ASC API 키는 환경 변수로만 넘깁니다.

```bash
export APP_STORE_CONNECT_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_XXXX.p8"
export APP_STORE_CONNECT_KEY_ID="XXXX"
export APP_STORE_CONNECT_ISSUER_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
npm run member:mobile:ios:testflight
```

업로드가 끝나면 [App Store Connect](https://appstoreconnect.apple.com) → **은혜로운 예배 - 성도** → **TestFlight**에서 빌드 처리(수 분~수십 분)를 기다린 뒤, **내부 테스트** 그룹에 빌드를 추가하고 테스터를 초대하세요.

## 목회자가 기도제목을 보는 방법

1. `/prayers` (성도 화면 헤더의 **기도함** 링크, 담당 목사 계정일 때만 보임).
2. 본인 uid가 교회의 `pastorUid` 와 같아야 합니다.
3. Firebase: `church/churches/{churchId}/prayerRequests/…` 에 `pastorUid` 필드.

규칙을 배포하려면 `firebase/church.rules.json`을 합친 뒤 `node scripts/merge-church-rules.mjs`(토큰 필요) 또는 콘솔에 `docs/firebase-rules-paste.json`을 붙여 넣습니다. `live-interpret`/`cheil`/`jifc` 규칙은 변경하지 않습니다.

## 관련 문서

- 커뮤니티: [`community-tab.md`](./community-tab.md) (store) · 코드 `components/community/`
- 조작 앱: [`mobile-operator-install.md`](./mobile-operator-install.md)
- 자료 맵: [`firebase-data-map.md`](./firebase-data-map.md) §2.8
- 전체 구조: [`../전체구조안내서.md`](../전체구조안내서.md)
