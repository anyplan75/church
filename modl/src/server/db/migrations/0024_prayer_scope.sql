-- 기도 글이 어느 범위인지 남깁니다. 사람 호칭은 저장하지 않습니다.

BEGIN;

ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS scope text;

COMMIT;
