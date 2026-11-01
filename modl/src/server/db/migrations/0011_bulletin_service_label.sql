-- 한 주보에서 읽은 예배 이름을 칸에 둡니다.
-- 예전 주보는 비워 두고, 없는 예배 이름을 채우지 않습니다.

BEGIN;

ALTER TABLE bulletins
  ADD COLUMN service_label text NOT NULL DEFAULT '';

ALTER TABLE bulletins
  ADD COLUMN service_time text NOT NULL DEFAULT '';

COMMIT;
