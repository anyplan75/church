-- 큰 한글 주보를 배포 서버 한도보다 작게 나누어 잠시 둡니다.
-- 읽기가 끝나면 지웁니다.

BEGIN;

CREATE TABLE bulletin_upload_parts (
  upload_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  part_index integer NOT NULL,
  part_count integer NOT NULL,
  file_name text NOT NULL,
  payload bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, user_id, part_index)
);

COMMIT;
