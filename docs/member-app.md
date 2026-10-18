# 은혜로운 예배 — 성도(교인) 앱

조작용 **Remote**(`/remote`, Capacitor `org.eunhye.worship.operator`)·송출용 데스크톱과 **다른** 성도 전용 화면입니다.  
종이·디지털 주보를 대신해 오늘의 예배 정보·가사·광고를 보고, 기도제목을 목회자에게 보냅니다.

로그인·앱 아이콘 등 **처음 화면**만 제품명 **은혜로운 예배**(성도)를 쓰고, 교회에 들어간 뒤에는 헤더·히어로에 **그 교회 이름**을 크게 둡니다.

## 웹으로 쓰기

배포 주소 예: `https://eunhye-church-app.surge.sh/member/`  
(정적 배포는 `STATIC_EXPORT=1 npm run build` 후 `surge ./out` — `out/CNAME`은 `surge-fallback`이 채움)

| 경로 | 하는 일 |
| --- | --- |
| `/member` | 성도 홈(주보·가사·예배정보·기도) |
| `/prayers` | 목회자·운영자 **기도함**(받은 기도 목록·상태 변경). `admin` / `prepare` / `run` 역할 |

교회 Firebase 계정으로 로그인합니다. 성도만 쓰는 계정은 보통 **보기(`view`)** 역할이면 충분합니다. (기존 교회 로그인·역할 체계를 그대로 씁니다. `jifc`/`cheil`/`live-interpret` 경로는 건드리지 않습니다.)

### 탭 안내

1. **주보** — 오늘·진행 중·다가오는 예배의 순서·설교·광고(기존 `data/services` 주보 스키마).
2. **가사** — 해당 예배 슬라이드 문구. 허가된 찬양만 한 줄 가사, 그 외는 제목만.
3. **예배정보** — 시간·장소·설교자·지금 순서(진행 중일 때)·광고.
4. **기도** — 기도제목 작성 → `church/churches/{churchId}/prayerRequests/{id}` 에 저장.
5. **받은기도** (목회·준비·진행·설정 역할) — 상태 `새 기도` / `확인함` / `기도함`.

데스크톱 상단 메뉴의 **성도**·**기도함**으로도 들어갑니다.

## iOS (Capacitor) 성도 앱

| 항목 | 값 |
| --- | --- |
| 표시 이름 | **은혜로운 예배 성도** |
| 번들 ID | `org.eunhye.worship.member` |
| 설정 | `capacitor.member.config.ts` |
| 안내 | `ios-member/README.md` |

조작 앱과 **같은 `out/` 정적 파일**을 쓰되, 네이티브 `appId`로 셸을 구분합니다. 성도 셸은 로그인 후 항상 `/member`로 갑니다.

```bash
npm run member:mobile:sync
```

App Store Connect에 성도용 앱 레코드를 만든 뒤 Xcode에서 `ios-member`를 열어 서명·TestFlight하면 됩니다. (조작 앱 업로드 스크립트 `scripts/ios-testflight-upload.sh`는 Remote 전용입니다.)

## 목회자가 기도제목을 보는 방법

1. 웹/데스크톱에서 **기도함** (`/prayers`) 또는 성도 화면의 **받은기도** 탭.
2. 또는 성도 앱에 `admin`/`prepare`/`run`으로 로그인.
3. Firebase 경로: `church/churches/{churchId}/prayerRequests/…` (콘솔에서도 확인 가능).

규칙을 배포하려면 `firebase/church.rules.json`을 합친 뒤 `node scripts/merge-church-rules.mjs`(토큰 필요) 또는 콘솔에 `docs/firebase-rules-paste.json`을 붙여 넣습니다. `live-interpret`/`cheil`/`jifc` 규칙은 변경하지 않습니다.

## 관련 문서

- 조작 앱: [`mobile-operator-install.md`](./mobile-operator-install.md)
- 자료 맵: [`firebase-data-map.md`](./firebase-data-map.md) §2.8
- 전체 구조: [`../전체구조안내서.md`](../전체구조안내서.md)
