# 주소로 교회 찾기·만들기

전체 운영자(`/platform`)가 교회를 고르거나 새로 만들 때 **주소 → 좌표 → 주변 목록** 순으로 진행합니다.

## 흐름

1. **주소 입력** (예: 제주특별자치도 제주시 …)
2. **반경** 선택 (5 / 10 / 15 / 20km, 기본 15km)
3. **주변 교회 찾기** → 주소를 위도·경도로 변환
4. 반경 안 **기존 교회**가 보이면 **이 교회 열기**
5. 맞는 교회가 없으면 아래 **교회 추가**에 이름·운영자 계정을 넣고 저장 (찾은 `address`/`lat`/`lng`가 함께 저장됨)

## 지오코딩(주소→좌표)

| 우선순위 | 환경 변수 | 비고 |
| --- | --- | --- |
| 1 | `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox |
| 2 | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Geocoding |
| 3 | (없음) | OpenStreetMap Nominatim (무료) |

비밀 키는 `.env.local`에만 두고 코드에 넣지 않습니다. 예시는 `.env.example`.

## 자료 위치

- `church/churchIndex/{id}` — 목록 + `address`/`lat`/`lng`
- `church/churches/{id}/meta` — 같은 위치 필드

거리 계산: `lib/geo.ts` (하버사인). 시험: `npm test` → `lib/geo.test.ts`.

## 브랜딩

- 로그인·스플래시·교회 미선택 플랫폼 화면: 제품명 **은혜로운 예배**
- 교회에 들어간 뒤(네비·성도 히어로·Remote 헤더): **그 교회 이름**이 주 제목

## 성도 로그인

성도 계정은 이미 `accounts/{uid}.churchId`에 묶여 있어 별도 교회 고르기가 없습니다. 주변 검색은 플랫폼 등록 UX에 해당합니다.
