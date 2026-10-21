-- 교회에 사람이 직접 켜는 태그를 둡니다.
-- 주소로 태그를 채우지 않고, 이미 있는 교회 줄은 지우지 않습니다.
-- 태그를 안 켠 교회는 빈 목록입니다.

BEGIN;

ALTER TABLE map_churches
  ADD COLUMN tags jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE map_churches
  ADD CONSTRAINT map_churches_tags_known CHECK (
    jsonb_typeof(tags) = 'array'
    AND tags <@ '[
      "초교파",
      "독립교회",
      "예장통합",
      "예장합동",
      "기독교대한감리회",
      "기독교한국침례회",
      "한국기독교장로회",
      "순복음",
      "성결교",
      "밴드찬양",
      "전통예배",
      "청년부",
      "청소년부",
      "어린이주일학교",
      "영유아부",
      "평일모임",
      "영어통역",
      "중국어통역",
      "다국어자막",
      "수어통역",
      "통역수신기",
      "휠체어이동",
      "엘리베이터",
      "장애인화장실",
      "자모실",
      "전용주차장",
      "셔틀운행",
      "버스정류장인접"
    ]'::jsonb
  );

COMMIT;
