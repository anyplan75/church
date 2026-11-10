# 은혜로운 예배 (church) — 에이전트 안내

한 주의 예배를 준비·점검하고 그 순서대로 화면에 송출하는 앱입니다.
Next.js 15 웹 + Electron 데스크톱(조작/송출, LAN 포트 `18765`) + Capacitor iOS 슬라이드 리모컨으로 이루어져 있고, 데이터는 Firebase RTDB `church/` 경로만 씁니다.

하위 폴더 `modl/`은 별도 앱(모들)입니다. 그 안에서 작업할 때는 `modl/AGENTS.md`를 따릅니다.

## 먼저 읽을 것

- `전체구조안내서.md` — 구조·데이터·비밀 이름·주의사항의 원본. 이 파일과 다르면 안내서가 맞습니다.
- `docs/desktop-install.md`, `docs/mobile-operator-install.md`, `docs/firebase-data-map.md`

## 실행·검사 (저장소 맨 위, Node.js 20+)

```bash
cp .env.example .env.local   # 값은 로컬에만
npm install
npm test                     # lib/*.test.ts — PR 전에 통과
npm run dev                  # http://localhost:3000
npm run build
npm run desktop:build-web && npm run desktop:dev   # 데스크톱 확인
npm run mobile:sync                                # iOS 리모컨
```

## 꼭 지킬 것

- `live-interpret` / `cheil` / `jifc` 경로·규칙·코드는 읽지도 쓰지도 않습니다(같은 Firebase DB를 쓰는 다른 제품).
- Firebase 규칙은 `firebase/church.rules.json`만 고칩니다. 전체 규칙을 이 조각으로 덮어쓰지 않습니다(`scripts/merge-church-rules.mjs` 사용).
- 송출 본선은 데스크톱 LAN 직접 연결(포트 `18765`, 지금 두 줄)입니다. Firebase `outputDirect`에 본문 `lines`를 넣지 않습니다.
- 성경·가사 텍스트는 조작 PC에만 둡니다. 전문을 자동 수집·배포하지 않습니다(`lib/copyright.ts`).
- 역할을 바꾸면 `lib/roles.ts` 경로 규칙도 함께 맞춥니다.
- 화면 안내는 누를 동작만 짧게 씁니다.
- 빌드 결과(`out/`, `.next/`, `desktop-dist/`, `EXE/`, `android/`)와 `.env*`, 서비스계정 JSON은 커밋하지 않습니다.

## 작업 방식 (Cursor·Devin 공통)

- 이 저장소는 Cursor와 Devin이 번갈아 작업합니다. 둘 다 이 파일 → `전체구조안내서.md` → `작업인계.md` → `작업일지.md` 맨 위 항목 순서로 읽고 시작합니다.
- 시작 전에 `git status`와 현재 브랜치를 확인합니다. 커밋하지 않은 변경은 사용자 작업일 수 있으니 지우거나 덮어쓰지 않습니다.
- 새 작업은 최신 `main`에서 새 브랜치로 합니다. Cursor는 `cursor/<짧은-설명>-<4자리>`, Devin은 `devin/<짧은-설명>`을 씁니다. 끝나면 PR로 `main`에 합칩니다.
- `main`에 강제 푸시하지 않고, 히스토리를 다시 쓰지 않습니다.
- 커밋 메시지는 무엇이 바뀌는지 한 문장으로 씁니다.
- 파일은 필요한 부분만 고칩니다. 파일 전체를 자리표시자나 `…` 생략으로 다시 쓰지 않습니다.
- 비밀 값(키, 비밀번호, 토큰, 서버 주소)은 코드·문서·커밋·로그에 쓰지 않습니다. 이름만 적습니다.
- 구조, 실행 명령, 데이터 경로, 주의사항이 바뀌면 같은 PR에서 `전체구조안내서.md`도 고칩니다. 이 파일(AGENTS.md)에는 요약과 규칙만 둡니다.
- 작업을 마치거나 멈출 때 `작업일지.md` 맨 위에 항목을 하나 추가하고(날짜·작성자 Cursor/Devin·기기·브랜치·한 일·다음 할 일), `작업인계.md`의 진행 중·다음 할 일을 갱신합니다. 두 파일은 커밋해서 GitHub에도 올립니다.
- 기본 작업 기기는 맥미니(`juns-macmini`, Tailscale)입니다. 맥북에서는 Cursor Remote-SSH로 맥미니 폴더를 열고, Devin은 클라우드에서 Tailscale SSH로 맥미니에 접속합니다.

## 실행 파일 (EXE 폴더)
- 만든 설치·실행 파일은 `EXE/<기기>/`에 둡니다. 기기 폴더: `맥`, `윈도우`, `아이폰`, `안드로이드`, `웹`(발행주소.txt)
- 파일 이름: `<앱이름>-<기기>-<버전>[-빌드N][-아키텍처].<확장자>` (예: `은혜로운예배-맥-1.0.0-arm64.dmg`)
- 예전 버전은 지우지 않고 같이 둡니다. 새 버전을 만들면 버전·빌드 번호를 올려 새 이름으로 넣습니다.
- `EXE/`는 git에 올리지 않습니다(이 Mac의 `.git/info/exclude`와 `.cursorignore`로 제외). Cursor·Devin 모두 소스로 읽거나 고치지 않습니다.
