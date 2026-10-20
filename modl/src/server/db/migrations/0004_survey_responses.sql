-- 설문을 만든 사람과 제출 답을 남깁니다.
ALTER TABLE surveys
  ADD COLUMN created_by_member_id uuid REFERENCES members (id) ON DELETE SET NULL;

CREATE INDEX surveys_created_by_member_id_idx ON surveys (created_by_member_id);

CREATE TABLE survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys (id) ON DELETE CASCADE,
  member_id uuid REFERENCES members (id) ON DELETE SET NULL,
  answers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX survey_responses_survey_id_idx ON survey_responses (survey_id);
CREATE INDEX survey_responses_member_id_idx ON survey_responses (member_id);
