-- 제주 전체 토론 글과, 글·답글의 익명 선택입니다.
-- 익명을 고르면 화면에는 이름을 내리지 않습니다.

ALTER TABLE discussion_posts ADD COLUMN is_jeju boolean NOT NULL DEFAULT false;
ALTER TABLE discussion_posts ADD COLUMN anonymous boolean NOT NULL DEFAULT false;
ALTER TABLE discussion_replies ADD COLUMN anonymous boolean NOT NULL DEFAULT false;

ALTER TABLE discussion_posts DROP CONSTRAINT discussion_posts_one_place;
ALTER TABLE discussion_posts ADD CONSTRAINT discussion_posts_one_place CHECK (
  (is_jeju = true AND church_id IS NULL AND group_id IS NULL)
  OR (is_jeju = false AND (church_id IS NOT NULL) <> (group_id IS NOT NULL))
);
