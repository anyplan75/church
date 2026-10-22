-- 지도에 올리는 교회와, 교인이 데리러 가기 주소를 동의한 시각.
-- 주소가 없거나 좌표를 찾지 못한 교회는 핀 칸을 비워 둡니다.
-- 열쇠와 비밀번호는 이 파일에 없습니다.

BEGIN;

ALTER TABLE members
  ADD COLUMN address text,
  ADD COLUMN pickup_consent_at timestamptz,
  ADD COLUMN pickup_lat double precision,
  ADD COLUMN pickup_lon double precision;

CREATE TABLE map_churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  name text NOT NULL,
  pastor_name text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  service_time text NOT NULL DEFAULT '',
  memo text NOT NULL DEFAULT '',
  lat double precision,
  lon double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT map_churches_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX map_churches_community_id_idx ON map_churches (community_id);

COMMIT;
