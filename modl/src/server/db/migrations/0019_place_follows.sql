-- 교회 구독, 모들 구독, 태우리의 수정 권한입니다.
-- 소개 페이지는 교회 또는 모들에 붙입니다.

ALTER TABLE users ADD COLUMN current_group_id uuid REFERENCES small_groups (id) ON DELETE SET NULL;
CREATE INDEX users_current_group_id_idx ON users (current_group_id);

ALTER TABLE map_churches ADD COLUMN created_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE map_churches ADD COLUMN slug text;
CREATE UNIQUE INDEX map_churches_slug_uidx ON map_churches (slug) WHERE slug IS NOT NULL;
CREATE INDEX map_churches_created_by_user_id_idx ON map_churches (created_by_user_id);

ALTER TABLE small_groups ADD COLUMN address text NOT NULL DEFAULT '';
ALTER TABLE small_groups ADD COLUMN lat double precision;
ALTER TABLE small_groups ADD COLUMN lon double precision;
ALTER TABLE small_groups ADD COLUMN created_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE small_groups ADD COLUMN slug text;
CREATE UNIQUE INDEX small_groups_slug_uidx ON small_groups (slug) WHERE slug IS NOT NULL;
CREATE INDEX small_groups_created_by_user_id_idx ON small_groups (created_by_user_id);

CREATE TABLE church_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES map_churches (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT church_follows_user_church_uidx UNIQUE (user_id, church_id)
);
CREATE INDEX church_follows_user_id_idx ON church_follows (user_id);
CREATE INDEX church_follows_church_id_idx ON church_follows (church_id);

CREATE TABLE group_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES small_groups (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_follows_user_group_uidx UNIQUE (user_id, group_id)
);
CREATE INDEX group_follows_user_id_idx ON group_follows (user_id);
CREATE INDEX group_follows_group_id_idx ON group_follows (group_id);

CREATE TABLE place_edit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE,
  group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE,
  granted_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT place_edit_grants_one_place CHECK ((church_id IS NOT NULL) <> (group_id IS NOT NULL))
);
CREATE UNIQUE INDEX place_edit_grants_church_uidx ON place_edit_grants (user_id, church_id) WHERE church_id IS NOT NULL;
CREATE UNIQUE INDEX place_edit_grants_group_uidx ON place_edit_grants (user_id, group_id) WHERE group_id IS NOT NULL;
CREATE INDEX place_edit_grants_user_id_idx ON place_edit_grants (user_id);

ALTER TABLE calendar_events ADD COLUMN church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE;
CREATE INDEX calendar_events_church_id_idx ON calendar_events (church_id);

ALTER TABLE finance_categories ADD COLUMN church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE;
ALTER TABLE finance_categories ADD COLUMN group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE;
CREATE INDEX finance_categories_church_id_idx ON finance_categories (church_id);
CREATE INDEX finance_categories_group_id_idx ON finance_categories (group_id);

ALTER TABLE transactions ADD COLUMN church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE;
CREATE INDEX transactions_church_id_idx ON transactions (church_id);
CREATE INDEX transactions_group_id_idx ON transactions (group_id);

ALTER TABLE bulletins ADD COLUMN church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE;
ALTER TABLE bulletins ADD COLUMN group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE;
ALTER TABLE daily_qts ADD COLUMN church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE;
ALTER TABLE daily_qts ADD COLUMN group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE;
ALTER TABLE prayer_requests ADD COLUMN church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE;
ALTER TABLE surveys ADD COLUMN church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE;
ALTER TABLE surveys ADD COLUMN group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE;
ALTER TABLE meeting_minutes ADD COLUMN church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE;
ALTER TABLE meeting_minutes ADD COLUMN group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE;
ALTER TABLE event_archives ADD COLUMN church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE;
ALTER TABLE event_archives ADD COLUMN group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE;

ALTER TABLE website_configs DROP CONSTRAINT website_configs_community_id_uidx;
ALTER TABLE website_configs ADD COLUMN church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE;
ALTER TABLE website_configs ADD COLUMN group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE;
CREATE UNIQUE INDEX website_configs_church_id_uidx ON website_configs (church_id) WHERE church_id IS NOT NULL;
CREATE UNIQUE INDEX website_configs_group_id_uidx ON website_configs (group_id) WHERE group_id IS NOT NULL;
