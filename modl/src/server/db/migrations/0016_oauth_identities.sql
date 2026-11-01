-- 카카오·네이버 로그인으로 연결된 계정입니다.
-- 열쇠 값은 이 표에 두지 않습니다.

BEGIN;

CREATE TABLE oauth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_identities_provider_check CHECK (provider IN ('kakao', 'naver'))
);

CREATE UNIQUE INDEX oauth_identities_provider_user_uidx ON oauth_identities (provider, provider_user_id);
CREATE INDEX oauth_identities_user_id_idx ON oauth_identities (user_id);

COMMENT ON TABLE oauth_identities IS '카카오와 네이버 로그인 연결. 열쇠 값은 두지 않습니다.';

COMMIT;
