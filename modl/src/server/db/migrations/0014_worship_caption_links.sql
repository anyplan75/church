-- 예배 설정에서 언어마다 연결한 실시간 번역기 자막 주소입니다.
-- 주소가 없는 언어는 이 표에 두지 않습니다.

BEGIN;

CREATE TABLE worship_caption_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  language_code text NOT NULL,
  caption_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX worship_caption_links_community_language_uidx
  ON worship_caption_links (community_id, language_code);

CREATE INDEX worship_caption_links_community_id_idx
  ON worship_caption_links (community_id);

ALTER TABLE worship_caption_links
  ADD CONSTRAINT worship_caption_links_url_https
  CHECK (caption_url LIKE 'https://%');

ALTER TABLE worship_caption_links
  ADD CONSTRAINT worship_caption_links_code_known
  CHECK (language_code IN ('ko', 'en', 'zh', 'ja', 'vi', 'id', 'tl', 'th', 'mn', 'ru'));

COMMENT ON TABLE worship_caption_links IS '예배 언어와 실시간 번역기 자막 링크. 링크가 있는 언어만 고릅니다.';

COMMIT;
