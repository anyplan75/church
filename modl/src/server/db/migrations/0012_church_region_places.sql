-- 주소의 한글·영문 지명으로 제주시와 서귀포시를 다시 채웁니다.
-- 서귀포 지명이 있으면 서귀포시입니다. 그 주소에 제주만 더 있어도 서귀포시입니다.
-- 제주시 읍·면·동이 있거나, 서귀포가 아닌 제주/Jeju 가 있으면 제주시입니다.
-- 두 시 지명이 함께 있거나 지명을 못 읽으면 비웁니다.
-- 교회 줄은 지우지 않고, 좌표로 시를 만들지 않습니다.

BEGIN;

UPDATE map_churches
SET sido = NULL,
    district = NULL,
    region_id = NULL;

UPDATE map_churches
SET sido = '제주',
    district = '서귀포시',
    region_id = '제주-서귀포시'
WHERE address ~* '서귀포|남원|표선|성산|안덕|대정|중문|예래|대포|법환|서호|색달|(^|[^A-Za-z])(seogwipo|namwon|pyoseon|seongsan|andeok|daejeong|jungmun)'
  AND address !~* '제주시|조천|애월|한림|한경|구좌|추자|우도|이도|연동|노형|아라|오라|화북|삼양|봉개|외도|이호|도두|용담|건입|삼도|일도|(^|[^A-Za-z])(jocheon|aewol|hallim|hanrim|hangyeong|gujwa|ido|oedo|samyang|hwabuk|ora|yongdam|bonggae)|jeju([[:space:]]|-)*si';

UPDATE map_churches
SET sido = '제주',
    district = '제주시',
    region_id = '제주-제주시'
WHERE district IS NULL
  AND address !~* '서귀포|남원|표선|성산|안덕|대정|중문|예래|대포|법환|서호|색달|(^|[^A-Za-z])(seogwipo|namwon|pyoseon|seongsan|andeok|daejeong|jungmun)'
  AND (
    address ~* '제주시|조천|애월|한림|한경|구좌|추자|우도|이도|연동|노형|아라|오라|화북|삼양|봉개|외도|이호|도두|용담|건입|삼도|일도|제주|(^|[^A-Za-z])(jocheon|aewol|hallim|hanrim|hangyeong|gujwa|ido|oedo|samyang|hwabuk|ora|yongdam|bonggae|jeju)|jeju([[:space:]]|-)*si'
  );

COMMIT;
