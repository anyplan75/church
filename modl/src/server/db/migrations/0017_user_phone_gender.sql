-- 계정에 성별과 전화번호를 둡니다. 비밀 열쇠가 아닙니다.

BEGIN;

ALTER TABLE users
  ADD COLUMN phone text,
  ADD COLUMN gender text;

ALTER TABLE users
  ADD CONSTRAINT users_gender_check CHECK (gender IS NULL OR gender IN ('male', 'female'));

COMMENT ON COLUMN users.phone IS '계정 전화번호. 비밀 열쇠가 아닙니다.';
COMMENT ON COLUMN users.gender IS '계정 성별. male 또는 female. 비밀 열쇠가 아닙니다.';

CREATE TABLE oauth_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  gender text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_pending_provider_check CHECK (provider IN ('kakao', 'naver')),
  CONSTRAINT oauth_pending_gender_check CHECK (gender IS NULL OR gender IN ('male', 'female'))
);

CREATE UNIQUE INDEX oauth_pending_token_hash_uidx ON oauth_pending (token_hash);

COMMENT ON TABLE oauth_pending IS '성별이나 전화번호가 없어 아직 끝내지 못한 간편 가입. 열쇠 값은 두지 않습니다.';

COMMIT;
