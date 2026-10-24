-- 토론 범위입니다. 서귀포시, 제주시, 제주도, 교회, 모들, 전체 교회.
-- 예전 제주 전체 글은 제주도로 옮깁니다.

ALTER TABLE discussion_posts ADD COLUMN scope text NOT NULL DEFAULT '';

UPDATE discussion_posts SET scope = 'jeju' WHERE is_jeju = true AND scope = '';
UPDATE discussion_posts SET scope = 'gathering' WHERE is_jeju = false AND group_id IS NOT NULL AND scope = '';
UPDATE discussion_posts SET scope = 'church' WHERE is_jeju = false AND church_id IS NOT NULL AND scope = '';

ALTER TABLE discussion_posts DROP CONSTRAINT IF EXISTS discussion_posts_one_place;
ALTER TABLE discussion_posts DROP CONSTRAINT IF EXISTS discussion_posts_scope_place;
ALTER TABLE discussion_posts ADD CONSTRAINT discussion_posts_scope_place CHECK (
  (scope IN ('seogwipo', 'jeju_city', 'jeju', 'all') AND church_id IS NULL AND group_id IS NULL)
  OR (scope = 'church' AND church_id IS NOT NULL AND group_id IS NULL AND is_jeju = false)
  OR (scope = 'gathering' AND group_id IS NOT NULL AND church_id IS NULL AND is_jeju = false)
);
