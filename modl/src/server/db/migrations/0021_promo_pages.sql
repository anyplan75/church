-- 교회 또는 모들 하나의 홍보 페이지입니다.
-- 인스타그램 계정, 유튜브 글, 게시판 탭, 지도 소개만 둡니다.

CREATE TABLE promo_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid REFERENCES map_churches (id) ON DELETE CASCADE,
  group_id uuid REFERENCES small_groups (id) ON DELETE CASCADE,
  instagram text NOT NULL DEFAULT '',
  intro text NOT NULL DEFAULT '',
  youtube_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  tabs_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_pages_one_place CHECK ((church_id IS NOT NULL) <> (group_id IS NOT NULL))
);
CREATE UNIQUE INDEX promo_pages_church_uidx ON promo_pages (church_id) WHERE church_id IS NOT NULL;
CREATE UNIQUE INDEX promo_pages_group_uidx ON promo_pages (group_id) WHERE group_id IS NOT NULL;
