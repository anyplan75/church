-- 교회·모들 게시판 글입니다.
-- 그곳 구성원이 올리고, 안내 승인과는 따로 둡니다.

CREATE TABLE place_board_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE,
  group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT place_board_posts_one_place CHECK ((church_id IS NOT NULL) <> (group_id IS NOT NULL)),
  CONSTRAINT place_board_posts_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT place_board_posts_body_not_blank CHECK (length(btrim(body)) > 0)
);
CREATE INDEX place_board_posts_church_id_idx ON place_board_posts (church_id);
CREATE INDEX place_board_posts_group_id_idx ON place_board_posts (group_id);
CREATE INDEX place_board_posts_author_user_id_idx ON place_board_posts (author_user_id);
