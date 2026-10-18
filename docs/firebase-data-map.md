# 은혜로운 예배 — Firebase 자료 묶음

이 문서는 GitHub `anyplan75/church` 코드가 **실제로 읽고/쓰는** Firebase 경로만 정리한다.  
프로젝트: Realtime Database `live-interpret-db65e` (asia-southeast1). Firestore·Storage는 쓰지 않는다. 인증은 Firebase Authentication(이메일·비밀번호)만 쓴다.

슈퍼관리자(플랫폼) 이메일 관례: `anyplan@me.com`  
(비밀번호는 규칙·문서·코드에 두지 않는다.)

---

## 1. 쓰는 서비스

| 서비스 | 사용 |
| --- | --- |
| Realtime Database | 예. 최상위 `church/` 아래만 |
| Authentication | 예. 로그인·가입·비밀번호 변경·계정 삭제 |
| Firestore | 아니오 |
| Storage | 아니오 |

모든 DB 요청은 `lib/firebase-db.ts`의 `churchPath()`를 거친다. 상대 경로 앞에 `church/`가 붙고, 경로 조각에 `live-interpret` / `cheil` / `jifc`가 있으면 거부한다.

---

## 2. Realtime Database — `church` 묶음

### 2.1 `church/platform/adminUid`

| 항목 | 설명 |
| --- | --- |
| 값 | 문자열 (슈퍼관리자 Firebase `uid`) |
| 읽기 | 로그인한 사용자 |
| 쓰기 | `anyplan@me.com`만, 값 = 본인 `uid`, 최초 1회 또는 동일 uid |

### 2.2 `church/churchIndex/{churchId}`

교회 목록(플랫폼 화면).

| 필드 | 형 |
| --- | --- |
| `id` | 문자열 (`c` + 영숫자, 예: `c…`) |
| `name` | 문자열 |
| `operatorEmail` | 문자열 |
| `createdAt` | 숫자(ms) |

읽기·쓰기: 슈퍼관리자(`anyplan@me.com` 또는 `platform/adminUid`)만.

### 2.3 `church/accounts/{uid}`

로그인 계정 → 교회·역할.

| 필드 | 형 |
| --- | --- |
| `email` | 문자열 |
| `churchId` | 문자열 |
| `roles` | 객체. 키가 역할 id, 값이 `true` |
| `personId` | 문자열 또는 생략 (사람 명단 연결) |

역할 키: `view`, `prepare`, `run`, `output`, `directory`, `admin`.

읽기: 본인 / 슈퍼관리자 / 같은 `churchId` 계정.  
쓰기: 슈퍼관리자, 또는 해당 교회 `roles.admin == true`인 계정(같은 `churchId`로만).

### 2.4 `church/churches/{churchId}/meta`

| 필드 | 형 |
| --- | --- |
| `name` | 문자열 |
| `createdAt` | 숫자(ms) |

코드가 쓸 때 `operatorEmail`은 넣지 않는다. 목록용 이메일은 `churchIndex`에만 둔다.  
쓰기: 슈퍼관리자만. 읽기: 슈퍼관리자 또는 그 교회 소속 계정.

### 2.5 `church/churches/{churchId}/members/{uid}`

계정과 같은 본문(`email`, `churchId`, `roles`, 선택 `personId`).  
쓰기: 슈퍼관리자, 또는 그 교회 admin(쓰이는 문서의 `churchId`가 경로와 같을 때).

### 2.6 `church/churches/{churchId}/files/{fileName}`

배경 이미지 등. 값은 data URL 문자열.  
키는 파일명을 URL 인코딩한 형태.  
쓰기: 슈퍼관리자 또는 그 교회 admin.

### 2.6b `church/community/…` (지역 커뮤니티)

공유 지역 커뮤니티. **교회별 하위 경로가 아님** (`churches/{id}/community` 아님).  
읽기·쓰기: `church/accounts/{uid}` 교회 계정, 또는 전체 운영자(`anyplan@me.com` / `platform/adminUid`).  
`memberships` 쓰기는 본인 uid만. 교회 계정은 `churchId`가 자기 계정과 같아야 하고, 전체 운영자는 유효한 `c…` 교회 id를 넣는다. 모바일 Remote에는 연결하지 않는다.  
자료실은 **링크·짧은 메모만** 두고, 성경 txt 전문 업로드는 하지 않는다.

| 경로 | 내용 |
| --- | --- |
| `community/regions/{regionId}` | `name`, `sido`, `district` |
| `community/memberships/{uid}` | `regionId`, `sido`, `district`, `churchId`, `updatedAt` — 본인만 쓰기 |
| `community/posts/{regionId}/{postId}` | `title`, `body`, `category`(`notice`\|`question`\|`share`\|`promo`), 작성자·시각 |
| `community/posts/…/comments/{commentId}` | 댓글 본문·작성자·시각 |
| `community/resources/{regionId}/{resourceId}` | `title`, `url`, `note`, 작성자·시각 |

코드: `lib/community.ts`, `lib/community-db.ts`.

### 2.7 `church/churches/{churchId}/data/…`

교회 업무 데이터. 키별로 PUT한다. 읽기는 교회 단위로 한 번에 받는다.

#### `data/settings`

| 필드 | 형 |
| --- | --- |
| `churchName` | 문자열 |
| `backgroundColor` | `#RRGGBB` |
| `backgroundFile` | 문자열 또는 `null` |
| `overlay` | `bottom` \| `top` \| `left` \| `right` |
| `defaultPlace` | 문자열 |
| `folders` | `{ bible, hymn, praise }` 문자열 |
| `groups` | `[{ id, name, personIds[] }]` |
| `mainReady` | 불리언 |
| `overlayFont`, `fullscreenFont` | 문자열 |
| `fullscreenStep`, `mainFontSize`, `overlayFontSize` | 숫자 |
| `backgrounds` | 문자열 배열 |
| `outputHost` | 문자열(송출 PC 주소) |

#### `data/people[]`

| 필드 | 형 |
| --- | --- |
| `id`, `name`, `phone` | 문자열 |
| `roles` | 문자열 배열(직분 표시용) |
| `active` | 불리언 |
| `membership` | `member` \| `visitor` \| `newcomer` |
| `attendanceConsent` | 불리언 |
| `category` | `minister` \| `registered` \| `unregistered` |
| `office` | 직분 또는 `""` |
| `address`, `email`, `memo`, `photo` | 문자열 |

#### `data/songs[]`

| 필드 | 형 |
| --- | --- |
| `id`, `title`, `hymnNumber`, `key` | 문자열 |
| `license` | `title-only` \| `permitted` |
| `permittedLine` | 문자열 |

#### `data/services[]`

| 필드 | 형 |
| --- | --- |
| `id`, `title`, `date`, `time`, `place`, `notes` | 문자열 |
| `type` | 예배 종류 id |
| `preacherId` | 문자열 또는 `null` |
| `status` | `planning` \| `ready` \| `live` \| `done` |
| `items[]` | 아래 순서 항목 |
| `announcements[]` | `{ id, text }` |
| `liveIndex` | 숫자 |
| `liveSlide` | 숫자(선택) |
| `outputLines` | 문자열 배열(선택) |
| `startedAt` | 문자열 또는 `null` |
| `checks` | `{ [키]: boolean }` |
| `source` | `manual` \| `bulletin` |
| `groupId` | 문자열 또는 `null`(선택) |

순서 항목(`items[]`): `id`, `kind`, `title`, `note`, `scripture`, `scriptureText`, `scriptureLicensed`, `screenCue`, `personId`, `pendingName`, `songId`.

#### `data/reminders[]`

| 필드 | 형 |
| --- | --- |
| `id`, `serviceId`, `personId`, `dueAt`, `message` | 문자열 |
| `kind` | `day-before` \| `hour-before` |
| `status` | `scheduled` \| `due` \| `sent` |

#### `data/departments[]`

`id`, `name`

#### `data/attendance[]`

`personId`, `week`(YYYY-MM-DD), `present`(항상 `true`)

#### `data/supplies[]`

`id`, `departmentId`, `name`, `photo`, `status`(`have` \| `need` \| `requested`)

#### `data/activity[]`

`id`, `at`, `email`, `action`

#### `data/visits[]`

`id`, `email`, `connectedAt`, `leftAt`(또는 `null`), `did`

#### `data/outputDirect/{hostKey}/{mode}`

송출 WebRTC 신호. `mode`는 `overlay` 또는 `main`.  
`normalizeDb` 목록에는 없고, 별도 PATCH로만 갱신한다.

| 필드 | 형 |
| --- | --- |
| `offer` | `{ type: "offer", sdp }` 또는 `null` |
| `answer` | `{ type: "answer", sdp }` 또는 `null` |
| `offerIce` | ICE candidate 배열 |
| `answerIce` | ICE candidate 배열 |

`data` 쓰기 권한: 슈퍼관리자, 또는 그 교회에 `prepare` / `run` / `output` / `directory` / `admin` 중 하나. (`view`만 있으면 쓰기 불가.)

---

## 3. Authentication (경로 아님)

| 동작 | 코드 |
| --- | --- |
| 로그인 | `firebaseSignIn` |
| 교회 운영자·멤버 가입 | `firebaseSignUp` |
| 토큰 갱신 | `firebaseRefresh` |
| 이메일·비밀번호 변경 | `firebaseUpdateAccount` |
| 가입 실패 시 계정 삭제 | `firebaseDeleteAccount` |

비밀번호·해시·리프레시 토큰은 Realtime Database에 넣지 않는다. 브라우저 `localStorage` 키 `church-worship-session`에 세션만 둔다.

---

## 4. 규칙 안전성 (이번 점검)

**이전 붙여넣기 문서**에는 최상위 `jifc`, `cheil`에 `".read": true` / `".write": true`(아무나 읽고 쓰기)가 있었다. 시험 모드로 열린 상태였고, **이번 갱신에서 `".read": false` / `".write": false`로 닫았다.**

**repo `firebase/database.rules.json`의 `church` 구간**은 원래부터 로그인 + 슈퍼관리자/교회/역할 조건을 쓰고 있어 **시험용 전체 공개가 아니었다.** church 본문은 그대로 두고, 공유 규칙 최상위에 `jifc`·`cheil` 차단만 추가했다. 붙여넣기 파일은 repo와 동일하다.

`live-interpret` 안의 일부 `.read: true`(관리 uid 공개 읽기, 교회 `name`/`active` 공개)는 통역 앱용이며 이 repo의 church 앱은 건드리지 않는다. 공유 규칙에서 그 구간을 유지한다.

콘솔에 규칙을 반영하려면: [`firebase-rules-paste.json`](./firebase-rules-paste.json) 전체를 Realtime Database 규칙에 붙여넣는다.

---

## 5. 불필요 / 시험용 목록 (삭제하지 않음 — 확인 후 지울 것)

코드·규칙·문서에만 보이는 항목. **데이터·파일을 여기서 지우지 않았다.**

| 구분 | 경로·파일 | 이유 |
| --- | --- | --- |
| DB 최상위 | `jifc/`, `cheil/` | 이 앱 코드는 경로 금지. 예전 붙여넣기 규칙만 전체 공개였음. DB에 남아 있으면 콘솔에서 확인 후 삭제 가능 |
| DB 최상위 | `live-interpret/` | 통역 앱용. church 앱은 읽기/쓰기 안 함 |
| 로컬 파일 저장소 | `lib/store.ts` → `data/church.json` | 예전 서버 디스크 저장. 현재 UI는 import하지 않음 |
| 로컬 계정 스택 | `lib/accounts.ts`, `lib/sessions.ts`, `lib/session.ts`, `lib/passwords.ts`, `lib/guard.ts` | 예전 로컬 scrypt·쿠키 세션. 화면은 `app-db`+Firebase만 사용. 테스트(`auth.test.ts`)만 참조 |
| 브라우저 IndexedDB | `church-worship` | 예전 로컬 DB. 부팅 시 `deleteDatabase`로 지움. 더 이상 업무 데이터에 안 씀 |
| 시드 샘플 | `lib/seed.ts`의 샘플 예배·사람 | 빈 DB 폴백·테스트용. Firebase에 자동 업로드하지 않음 |
| 규칙 조각 | `firebase/church.rules.json` | `church`만 담은 조각. 배포는 `database.rules.json` / 붙여넣기 파일 기준 |
| meta 불일치 | `churches/*/meta.operatorEmail` | 읽기 폴백만 있음. 생성 시 meta에는 안 넣고 `churchIndex`에만 `operatorEmail` 기록 |

Firestore 존재하지 않거나 값이 없으면 “나중에 지울 후보”로만 보면 된다.
