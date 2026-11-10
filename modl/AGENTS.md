# 모들 (modl) — 에이전트 안내

교회와 모들(소모임)을 구독하고 일정·재정·게시판·지도 등을 쓰는 앱입니다. church 저장소 안의 별도 앱입니다.
Next.js 15 + Postgres(drizzle) 웹이고, 폰·패드·맥 앱은 이 웹을 감싸기만 합니다.

## 먼저 읽을 것

- `modl/전체구조안내서.md` — 모들 구조·자료·권한·주의사항의 원본
- 저장소 맨 위 `AGENTS.md`의 작업 방식도 그대로 따릅니다.

## 실행·검사 (반드시 `modl/` 안에서)

저장소 맨 위에서 `npm run dev`를 하면 은혜로운 예배가 열립니다. 모들이 아닙니다.

```bash
cd modl
npm install
npm run typecheck   # DB 없어도 됨
npm test            # DB 없어도 됨
npm run dev         # http://localhost:3210 (공개 앱 아님)
```

DB가 필요할 때만 `.env.example`을 `.env`로 복사해 `DATABASE_URL`을 채웁니다.

## 꼭 지킬 것

- 새 테스트 파일은 `modl/package.json`의 `test` 스크립트 목록에 직접 추가해야 돕니다(와일드카드 아님).
- 표를 더할 때는 `src/server/db/migrations`에 다음 번호의 SQL 파일(`0001_init.sql` 형식)로 추가합니다.
- `.env`, `secrets/`, `public/uploads/`는 커밋하지 않습니다. 구글 시트 값은 `GOOGLE_SHEETS_SERVICE_ACCOUNT`, `GOOGLE_SHEETS_SPREADSHEET_ID` 이름으로만 둡니다.
- 공개 앱은 Firebase 프로젝트 `modl-comm`(App Hosting·Postgres)이고, 폰·패드 앱의 처음 주소는 `https://modl-jeju.vercel.app`입니다. 이 컴퓨터의 `127.0.0.1` DB는 공개 앱이 쓰지 않습니다.
- 제주명조·제주고딕 글꼴을 다른 글꼴로 바꾸지 않습니다.
- Firebase 자료 묶음이나 n8n을 새로 추가할 때는 이름 앞에 `[모들]_`을 붙입니다.
