-- 모들 편성 기록.
-- 시즌이 바뀌거나 사람을 옮겨도 지난 줄을 지우지 않습니다.
-- 끝난 편성은 ended_at 만 채웁니다.

BEGIN;

CREATE TABLE group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES small_groups (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  season_year integer NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX group_memberships_community_id_idx ON group_memberships (community_id);
CREATE INDEX group_memberships_group_id_idx ON group_memberships (group_id);
CREATE INDEX group_memberships_member_id_idx ON group_memberships (member_id);

-- 한 사람에게 진행 중인 편성은 하나만 둡니다. 끝난 줄은 여러 개여도 됩니다.
CREATE UNIQUE INDEX group_memberships_open_member_uidx
  ON group_memberships (member_id)
  WHERE ended_at IS NULL;

COMMENT ON TABLE group_memberships IS '모들 편성 기록. 지난 연결은 지우지 않고 끝난 시각만 적습니다.';

COMMIT;
