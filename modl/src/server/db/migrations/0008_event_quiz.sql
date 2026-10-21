-- 행사 날짜와 퀴즈를 풀 수 있는 시간, 그달 상품 이름입니다.
-- 없는 날짜와 없는 자료와 없는 상품은 만들지 않습니다.

ALTER TABLE event_archives ADD COLUMN IF NOT EXISTS event_date date;

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS worship_ended_at timestamptz;

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS solve_minutes integer;

ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_solve_minutes_positive;

ALTER TABLE quizzes
  ADD CONSTRAINT quizzes_solve_minutes_positive
  CHECK (solve_minutes IS NULL OR solve_minutes > 0);

CREATE TABLE quiz_month_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  year_month text NOT NULL,
  prize_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_month_prizes_name_not_blank CHECK (length(btrim(prize_name)) > 0),
  CONSTRAINT quiz_month_prizes_month_shape CHECK (year_month ~ '^[0-9]{4}-[0-9]{2}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS quiz_month_prizes_community_month_uidx
  ON quiz_month_prizes (community_id, year_month);
