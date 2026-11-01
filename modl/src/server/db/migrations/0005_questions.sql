-- 질문과 답글, 교인의 또래·선배 구분.
-- 비밀번호는 이 파일에 없습니다.

BEGIN;

CREATE TYPE member_cohort AS ENUM ('PEER', 'SENIOR');
CREATE TYPE question_audience AS ENUM ('PASTORS', 'PEERS', 'SENIORS');
CREATE TYPE question_reply_status AS ENUM ('PENDING', 'APPROVED');

ALTER TABLE members
  ADD COLUMN cohort member_cohort;

CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body text NOT NULL,
  designated_pastor_member_id uuid REFERENCES members (id) ON DELETE SET NULL,
  audience question_audience NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT questions_body_not_blank CHECK (length(btrim(body)) > 0)
);

CREATE INDEX questions_community_id_idx ON questions (community_id);
CREATE INDEX questions_author_user_id_idx ON questions (author_user_id);

CREATE TABLE question_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions (id) ON DELETE CASCADE,
  author_member_id uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  body text NOT NULL,
  status question_reply_status NOT NULL DEFAULT 'PENDING',
  approved_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_replies_body_not_blank CHECK (length(btrim(body)) > 0)
);

CREATE INDEX question_replies_community_id_idx ON question_replies (community_id);
CREATE INDEX question_replies_question_id_idx ON question_replies (question_id);

COMMIT;
