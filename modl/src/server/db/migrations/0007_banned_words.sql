-- 모들 전체 금지어 표.
-- 사역자가 설정 화면에서 고칩니다. 처음 목록만 여기에 넣고, 코드에는 단어를 고정하지 않습니다.

BEGIN;

CREATE TABLE banned_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT banned_words_word_not_blank CHECK (length(btrim(word)) > 0)
);

CREATE UNIQUE INDEX banned_words_word_uidx ON banned_words (word);

INSERT INTO banned_words (word) VALUES
  ('시발'),
  ('씨발'),
  ('씨팔'),
  ('시팔'),
  ('병신'),
  ('지랄'),
  ('존나'),
  ('개새끼'),
  ('미친놈'),
  ('미친년'),
  ('엿먹어'),
  ('닥쳐');

COMMIT;
