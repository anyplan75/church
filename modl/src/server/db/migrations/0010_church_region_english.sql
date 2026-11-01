-- 영어로 적힌 시 이름을 같은 지역 칸에 채웁니다.
-- 서귀포는 서귀포시, Jeju-si 는 제주시입니다.
-- 제주만 있거나 두 시가 함께 있으면 비워 둡니다. 이미 채운 줄은 건드리지 않습니다.

BEGIN;

UPDATE map_churches
SET sido = '제주',
    district = '서귀포시',
    region_id = '제주-서귀포시'
WHERE district IS NULL
  AND address ~* 'seogwipo|서귀포'
  AND address !~* '제주시|jeju[[:space:]-]*si';

UPDATE map_churches
SET sido = '제주',
    district = '제주시',
    region_id = '제주-제주시'
WHERE district IS NULL
  AND address ~* '제주시|jeju[[:space:]-]*si'
  AND address !~* 'seogwipo|서귀포';

COMMIT;
