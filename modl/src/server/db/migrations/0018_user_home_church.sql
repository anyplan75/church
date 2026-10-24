-- 가입 뒤에 고른 다니는 교회를 계정에 둡니다. 비밀 열쇠가 아닙니다.

BEGIN;

ALTER TABLE users
  ADD COLUMN home_church_id uuid REFERENCES map_churches (id) ON DELETE SET NULL;

CREATE INDEX users_home_church_id_idx ON users (home_church_id);

COMMENT ON COLUMN users.home_church_id IS '가입 뒤에 고르거나 직접 등록한 다니는 교회. 비밀 열쇠가 아닙니다.';

COMMIT;
