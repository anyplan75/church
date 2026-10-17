# Firebase 일일 미러 백업 — 은혜로운 예배

Firebase Realtime Database의 **`/church`** 트리만 매일 읽어 JSON 파일로 복제하는 방법입니다.  
`live-interpret` / `cheil` / `jifc` 경로는 읽지 않고, 보안 규칙도 건드리지 않습니다.

경로 맵이 있으면 → [`firebase-data-map.md`](./firebase-data-map.md)  
(아직 없으면 아래 경로 표를 기준으로 쓰면 됩니다.)

---

## 1. 이 제품이 쓰는 RTDB 경로

DB URL: `https://live-interpret-db65e-default-rtdb.asia-southeast1.firebasedatabase.app`  
앱 코드는 상대 경로를 `church/...`로 붙입니다 (`lib/firebase-db.ts`의 `churchPath`).

| RTDB 절대 경로 | 내용 |
| --- | --- |
| `church/platform/adminUid` | 플랫폼 관리자 UID |
| `church/churchIndex/{churchId}` | 교회 목록 인덱스 |
| `church/accounts/{uid}` | 계정 → 교회·역할 |
| `church/churches/{churchId}/meta` | 교회 이름·생성일 등 |
| `church/churches/{churchId}/data` | 예배·사람·찬양·출결·비품·활동 등 **핵심 자료** |
| `church/churches/{churchId}/members/{uid}` | 교회별 멤버 |
| `church/churches/{churchId}/files/{name}` | 업로드 파일(데이터 URL, **용량 큼**) |

`data` 안에 보통 들어가는 키: `settings`, `people`, `songs`, `services`, `reminders`, `departments`, `attendance`, `supplies`, `activity`, `visits`, `outputDirect` 등.

교회 ID 형식: `c` + 소문자·숫자 (예: `c…`). `live-interpret`, `cheil`, `jifc`, `church`는 금지.

---

## 2. repo 스크립트로 미러 (권장)

repo에 `scripts/mirror-firebase.mjs`가 있습니다.

### 준비 (콘솔에서 한 번)

1. Firebase 콘솔 → 프로젝트 설정 → **서비스 계정** → 새 비공개 키 JSON 다운로드  
2. RTDB에서 이 계정이 `/church`를 **읽을** 수 있게 권한 부여(관리자 SDK는 보통 규칙 우회; 커스텀 토큰 방식이면 규칙에 맞게)  
3. JSON 값은 **절대 커밋하지 말고** 시크릿/환경 변수에만 둡니다

### 환경 변수 (이름만)

| 이름 | 용도 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | 서비스 계정 JSON 전체 문자열 |
| `GOOGLE_APPLICATION_CREDENTIALS` | 같은 JSON의 로컬 파일 경로 (택1) |
| `FIREBASE_TOKEN` / `GOOGLE_ACCESS_TOKEN` | 이미 있는 access token (택1) |
| `MIRROR_OUT_DIR` | 출력 폴더 (기본 `mirror-out`) |
| `MIRROR_INCLUDE_FILES` | `1`이면 `files` 포함 |
| `MIRROR_CHURCH_IDS` | 특정 교회만 (쉼표 구분). 비우면 `churchIndex` 전체 |

`.env` / `*.serviceAccount.json` / `mirror-out/` 은 `.gitignore`에 있습니다.

### 로컬 실행

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/절대경로/서비스계정.json"
npm run mirror:firebase
# 또는
node scripts/mirror-firebase.mjs
```

출력 예:

```text
mirror-out/
  20261017T180000Z/
    manifest.json
    platform.json
    churchIndex.json
    accounts.json
    churches/
      cxxxxxxxx/
        meta.json
        data.json
        members.json
        files.json          # MIRROR_INCLUDE_FILES=1 일 때만
  latest-pointer.json
```

### GitHub Actions (스케치)

워크플로: `.github/workflows/firebase-daily-mirror.yml`

1. repo **Settings → Secrets**에 `FIREBASE_SERVICE_ACCOUNT_JSON` 등록  
2. Actions에서 워크플로 활성화 (또는 `workflow_dispatch`로 시험)  
3. 스냅샷은 `backups/firebase/<UTC스탬프>/`에 **일반 commit + push** (force push 없음)

개인 보관함만 쓰려면 Actions의 commit 단계를 끄고, `mirror-out`을 Google Drive / 외장 SSD로 복사하면 됩니다.

### cron (서버·Mac)

```cron
0 3 * * * cd /path/to/church && . ./.env && /usr/bin/node scripts/mirror-firebase.mjs >> /var/log/church-mirror.log 2>&1
```

(`.env`에는 시크릿 이름·값만 로컬에; repo에 올리지 않음.)

---

## 3. n8n으로 같은 미러 (대안)

| 단계 | 노드 | 하는 일 |
| --- | --- | --- |
| 1 | Schedule Trigger | 매일 (예: KST 03:00) |
| 2 | HTTP Request 또는 코드 | 서비스 계정으로 Google OAuth access token 발급, 또는 미리 둔 `FIREBASE_TOKEN` credential |
| 3 | HTTP Request | `GET {DATABASE_URL}/church/churchIndex.json?access_token=…` |
| 4 | Split / Loop | 각 `churchId`에 대해 `…/church/churches/{id}/meta.json`, `…/data.json`, `…/members.json` GET |
| 5 | Write Binary / Convert to File | JSON 파일로 묶기 |
| 6 | Google Drive 업로드 **또는** GitHub 노드로 비공개 백업 repo에 commit | 파일 경로 예: `firebase/{날짜}/churches/{id}/data.json` |
| 7 | (선택) Error Trigger → Slack/메일 | 실패 알림 한 줄 |

n8n credential 이름 예: `Firebase Mirror SA`, `GitHub Mirror PAT`, `Drive Backup`.  
**값·JSON 본문은 문서·워크플로 공유본에 넣지 않습니다.**

REST 예시 (토큰은 환경/credential에서만):

```text
GET https://…firebasedatabase.app/church/churches/{churchId}/data.json?access_token={{$credentials.token}}
```

---

## 4. 주의

- **force push 금지** — 미러 히스토리는 일반 push만  
- 시크릿·서비스 계정 JSON을 문서·커밋·PR에 넣지 말 것  
- `files`는 사진 데이터 URL이 클 수 있어 기본 미러에서 제외 (`MIRROR_INCLUDE_FILES=1`로만 포함)  
- 규칙 파일(`firebase/*.rules.json`, `.settings/rules`)은 이 작업 범위 밖  
- 다른 앱 루트(`live-interpret`, `cheil`, `jifc`)는 스크립트가 거부함  
