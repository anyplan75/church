# n8n 워크플로 → GitHub 비공개 저장소 일일 미러

n8n에 있는 **모든 자동화 흐름 설계도(워크플로 JSON)**를 매일 API로 뽑아, 비공개 GitHub 저장소에 그대로 복제 올리는 절차입니다.  
시크릿 값은 적지 않습니다. credential·환경 변수 **이름만** 씁니다.

관련: Firebase 데이터 미러는 [`firebase-daily-mirror.md`](./firebase-daily-mirror.md).

---

## 목표 결과물

비공개 repo (예: `anyplan75/n8n-workflow-mirror`)에 매일 갱신되는 트리:

```text
README.md
manifest.json                 # 추출 시각, 워크플로 개수
workflows/
  <id>-<slug-name>.json       # 워크플로 본문
  …
tags/
  tags.json                   # (선택) 태그 목록
```

- 브랜치: `main`만 사용 (force push 금지)  
- 커밋 메시지 예: `chore: n8n workflow mirror 2026-10-17`

---

## 0. 준비물 (이름만)

| 항목 | 어디에 둠 | 용도 |
| --- | --- | --- |
| `N8N_API_KEY` | n8n **Settings → n8n API**에서 발급 → n8n Credential 또는 환경 변수 | `X-N8N-API-KEY` 헤더 |
| `N8N_BASE_URL` | env / credential | Cloud: `https://<subdomain>.app.n8n.cloud/api/v1` · Self-host: `https://<host>/api/v1` |
| `GITHUB_PAT` 또는 Deploy Key | n8n Credential **Header Auth** / **GitHub** | private repo `contents:write` (PAT이면 `repo` 범위의 최소 권한) |
| `GITHUB_OWNER` | env | 예: `anyplan75` |
| `GITHUB_REPO` | env | 예: `n8n-workflow-mirror` |
| `GITHUB_BRANCH` | env | 기본 `main` |

n8n Credential 권장 이름:

- `n8n API — workflow mirror` (API Key 필드만)
- `GitHub — workflow mirror PAT` (또는 SSH Deploy Key용 Credential)

API 키에 스코프가 있으면 최소: `workflow:list`, `workflow:read` (패키지 export를 쓰면 `workflow:export`).

---

## 1. 비공개 GitHub 저장소 만들기

화면에서:

1. GitHub → **New repository**  
2. 이름: `n8n-workflow-mirror` (원하는 이름)  
3. **Private** 선택  
4. README만 넣고 생성  
5. (선택) Settings → Deploy keys → 읽기/쓰기 Deploy Key 추가  
   또는 Fine-grained PAT: 이 repo만, Contents Read and write  

로컬에서 첫 구조 (선택):

```bash
git clone git@github.com:OWNER/n8n-workflow-mirror.git
cd n8n-workflow-mirror
mkdir -p workflows
echo "# n8n workflow mirror" > README.md
git add . && git commit -m "chore: init mirror layout"
git push origin main
```

**force push는 쓰지 않습니다.**

---

## 2. n8n API로 워크플로 가져오기

### 목록

```http
GET {N8N_BASE_URL}/workflows?limit=100&excludePinnedData=true
Header: X-N8N-API-KEY: <N8N_API_KEY만 credential에서>
```

응답에 `nextCursor`가 있으면 같은 URL에 `&cursor=…`를 붙여 다음 페이지 (최대 limit 250).  
**활성·비활성 전부** 미러하려면 `active` 필터를 넣지 않습니다.

### 단건 (본문 완전판)

목록 항목마다:

```http
GET {N8N_BASE_URL}/workflows/{id}?excludePinnedData=true
Header: X-N8N-API-KEY: …
```

파일 이름 규칙:

1. `name`을 소문자·하이픈 slug로 (`공백→-`, 한글은 그대로 두거나 `id`만 써도 됨)  
2. 파일: `workflows/{id}-{slug}.json`  
3. 내용: API 응답 JSON 전체 (`nodes`, `connections`, `settings`, `active` 등). **credential 값은 보통 id 참조만** 포함되며, 실제 비밀은 n8n DB에 남습니다. 미러 repo에 비밀번호를 붙여 넣지 마세요.

### (선택) 패키지 export

라이선스·기능이 있으면 `POST /api/v1/n8n-packages/export` 로 `.n8np`도 가능.  
일상 미러는 JSON 파일 트리가 복구·diff에 더 낫습니다.

---

## 3. n8n 안에서 “미러 워크플로” 만들기 (화면 단계)

새 워크플로 이름 예: `Daily — mirror all workflows to GitHub`

### 노드 순서

1. **Schedule Trigger**  
   - Cron: `0 3 * * *` (매일 03:00, 타임존은 n8n 인스턴스 설정)  
   - 또는 Interval: 24시간  

2. **HTTP Request — list workflows**  
   - Method: GET  
   - URL: `{{$env.N8N_BASE_URL}}/workflows?limit=100&excludePinnedData=true`  
   - Authentication: Header → Credential `n8n API — workflow mirror`  
     - Header name: `X-N8N-API-KEY`  
   - 페이지네이션: `nextCursor`가 있을 때까지 Loop / 재요청  

3. **Split Out** (또는 Code)  
   - `data` 배열의 각 워크플로 항목으로 분리  

4. **HTTP Request — get one workflow**  
   - URL: `{{$env.N8N_BASE_URL}}/workflows/{{$json.id}}?excludePinnedData=true`  
   - 같은 API Key credential  

5. **Code — 파일명·본문 정리** (골격)

```javascript
// 시크릿 값을 로그로 남기지 말 것
const wf = items[0].json;
const id = String(wf.id || "unknown");
const slug = String(wf.name || "workflow")
  .toLowerCase()
  .replace(/[/\\?%*:|"<>]/g, "-")
  .replace(/\s+/g, "-")
  .slice(0, 80);
const path = `workflows/${id}-${slug}.json`;
const content = JSON.stringify(wf, null, 2) + "\n";
return [{ json: { path, content, id, name: wf.name } }];
```

6. **GitHub 노드 (또는 HTTP Request → Contents API)**  
   - Operation: Create or Update file  
   - Owner / Repository / Branch: env의 `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`  
   - File Path: `{{$json.path}}`  
   - File Content: `{{$json.content}}`  
   - Commit Message: `chore: sync {{$json.id}} {{$json.name}}`  
   - Credential: `GitHub — workflow mirror PAT`  

   Contents API를 직접 쓸 때 (값 없이 패턴만):

   ```http
   PUT https://api.github.com/repos/{OWNER}/{REPO}/contents/{path}
   Authorization: Bearer <GITHUB_PAT from credential>
   ```

   body 필드: `message`, `content`(Base64), `branch`, 기존 파일이면 `sha` (GET으로 조회 후).

7. **Code — manifest 한 번** (루프 끝난 뒤 Aggregate)  
   - `manifest.json`에 `{ "mirroredAt": "…", "count": N, "ids": […] }` 기록 후 GitHub에 upsert  

8. **Error 알림 (한 줄)**  
   - Error Trigger 또는 마지막 IF 실패 시  
   - Slack / 이메일 / n8n 알림:  
     `n8n 워크플로 GitHub 미러 실패 — 스케줄 Daily mirror 확인`

워크플로 자체도 미러 대상에 포함되면, 이 설계도까지 repo에 남습니다.

---

## 4. 워크플로 JSON 골격 (참고용 스케치)

아래는 **구조만** 보여주는 골격입니다. 실제 노드 id·credential id는 n8n이 채웁니다. 시크릿 없음.

```json
{
  "name": "Daily — mirror all workflows to GitHub",
  "nodes": [
    {
      "name": "Every day 03:00",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": { "interval": [{ "field": "cronExpression", "expression": "0 3 * * *" }] }
      }
    },
    {
      "name": "List workflows",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "={{$env.N8N_BASE_URL}}/workflows?limit=100&excludePinnedData=true",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth"
      }
    },
    {
      "name": "Split workflows",
      "type": "n8n-nodes-base.splitOut",
      "parameters": { "fieldToSplitOut": "data" }
    },
    {
      "name": "Get workflow",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "={{$env.N8N_BASE_URL}}/workflows/{{$json.id}}?excludePinnedData=true",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth"
      }
    },
    {
      "name": "Build file payload",
      "type": "n8n-nodes-base.code",
      "parameters": { "jsCode": "// see section 3 step 5" }
    },
    {
      "name": "Upsert on GitHub",
      "type": "n8n-nodes-base.github",
      "parameters": {
        "operation": "create",
        "owner": "={{$env.GITHUB_OWNER}}",
        "repository": "={{$env.GITHUB_REPO}}",
        "filePath": "={{$json.path}}",
        "fileContent": "={{$json.content}}"
      }
    }
  ],
  "connections": {
    "Every day 03:00": { "main": [[{ "node": "List workflows" }]] },
    "List workflows": { "main": [[{ "node": "Split workflows" }]] },
    "Split workflows": { "main": [[{ "node": "Get workflow" }]] },
    "Get workflow": { "main": [[{ "node": "Build file payload" }]] },
    "Build file payload": { "main": [[{ "node": "Upsert on GitHub" }]] }
  },
  "active": false,
  "settings": {}
}
```

활성은 시험 성공 후 `active: true` (화면에서 Active 토글).

---

## 5. git commit/push 패턴 (n8n 밖 대안)

서버나 Actions에서 돌릴 때:

```bash
# 1) API로 workflows/*.json 채우기 (스크립트 자리)
# 2) 일반 커밋만
cd /path/to/n8n-workflow-mirror
git add workflows manifest.json
git diff --cached --quiet || git commit -m "chore: n8n workflow mirror $(date -u +%Y-%m-%dT%H%MZ)"
git push origin main
# git push --force 금지
```

---

## 6. 실패 시

- n8n 실행 로그에서 실패한 노드(List / Get / GitHub) 확인  
- API 키 만료·GitHub PAT 권한·repo private 접근 재확인  
- 알림 문구: **「n8n 워크플로 GitHub 미러 실패 — 스케줄 Daily mirror 확인」**

---

## 7. 보안 체크리스트

- [ ] API 키·PAT를 워크플로 설명·이 문서·공개 이슈에 붙여 넣지 않음  
- [ ] 미러 repo는 **Private**  
- [ ] Credential 이름만 공유하고 값은 n8n Credential 금고에만  
- [ ] force push / history rewrite 금지  
- [ ] pinned data에 실데이터가 있으면 `excludePinnedData=true` 유지  
