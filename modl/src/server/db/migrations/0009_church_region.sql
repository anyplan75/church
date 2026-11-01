-- 교회에 통역 커뮤니티와 같은 지역 칸을 더합니다.
-- 시/도는 제주, 시군구는 제주시 또는 서귀포시, 지역 키는 둘을 붙인 값입니다.
-- 주소에 시 이름이 하나일 때만 채웁니다. 없거나 둘 다 있으면 비웁니다.
-- 좌표로 시를 만들지 않고, 교회 줄을 지우지 않습니다.

BEGIN;

ALTER TABLE map_churches
  ADD COLUMN sido text,
  ADD COLUMN district text,
  ADD COLUMN region_id text;

ALTER TABLE map_churches
  ADD CONSTRAINT map_churches_region_pair CHECK (
    (sido IS NULL AND district IS NULL AND region_id IS NULL)
    OR (
      sido = '제주'
      AND district IN ('제주시', '서귀포시')
      AND region_id = ('제주-' || district)
    )
  );

UPDATE map_churches
SET sido = '제주',
    district = '제주시',
    region_id = '제주-제주시'
WHERE position('제주시' in address) > 0
  AND position('서귀포시' in address) = 0;

UPDATE map_churches
SET sido = '제주',
    district = '서귀포시',
    region_id = '제주-서귀포시'
WHERE position('서귀포시' in address) > 0
  AND position('제주시' in address) = 0;

COMMIT;
