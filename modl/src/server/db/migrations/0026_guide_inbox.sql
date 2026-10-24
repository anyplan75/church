-- 메일로 온 안내입니다. 승인 전에 주보로 올리지 않습니다.

CREATE TABLE guide_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id text NOT NULL,
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  received_at timestamptz,
  community_id uuid REFERENCES communities (id) ON DELETE CASCADE,
  church_id uuid REFERENCES map_churches (id) ON DELETE SET NULL,
  group_id uuid REFERENCES small_groups (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  services_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NOT NULL DEFAULT '',
  bulletin_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guide_inbox_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  CONSTRAINT guide_inbox_one_place CHECK (church_id IS NULL OR group_id IS NULL)
);

CREATE UNIQUE INDEX guide_inbox_gmail_message_uidx ON guide_inbox (gmail_message_id);
CREATE INDEX guide_inbox_status_idx ON guide_inbox (status);
