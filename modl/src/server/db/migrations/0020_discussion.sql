-- 토론 글과 답글입니다.
-- 글은 지금 예배드리는 교회 또는 지금 가는 모들 한곳에만 붙습니다.

CREATE TABLE discussion_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE,
  group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discussion_posts_one_place CHECK ((church_id IS NOT NULL) <> (group_id IS NOT NULL)),
  CONSTRAINT discussion_posts_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT discussion_posts_body_not_blank CHECK (length(btrim(body)) > 0)
);
CREATE INDEX discussion_posts_church_id_idx ON discussion_posts (church_id);
CREATE INDEX discussion_posts_group_id_idx ON discussion_posts (group_id);
CREATE INDEX discussion_posts_author_user_id_idx ON discussion_posts (author_user_id);

CREATE TABLE discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES discussion_posts (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discussion_replies_body_not_blank CHECK (length(btrim(body)) > 0)
);
CREATE INDEX discussion_replies_post_id_idx ON discussion_replies (post_id);
CREATE INDEX discussion_replies_author_user_id_idx ON discussion_replies (author_user_id);
