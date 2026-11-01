-- 모들 1단계 표 만들기.
-- 이 파일을 한 번에 실행하면 공동체가 쓸 표가 모두 생깁니다.
-- 비밀번호는 이 파일에 없습니다. 접속 주소는 .env 의 DATABASE_URL 입니다.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE plan_tier AS ENUM ('FREE', 'PRO');
CREATE TYPE language_mode AS ENUM ('JEJU_DUAL', 'JEJU_ONLY', 'STANDARD');
CREATE TYPE member_role AS ENUM ('PASTOR', 'EXECUTIVE', 'CELL_LEADER', 'MEMBER', 'NEWCOMER');
CREATE TYPE member_status AS ENUM ('ACTIVE', 'LONG_ABSENT', 'GRADUATED');
CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE department_type AS ENUM ('YOUTH', 'SCHOOL');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED');
CREATE TYPE check_method AS ENUM ('SELF_QR', 'GROUP_LEADER', 'EXECUTIVE');
CREATE TYPE calendar_category AS ENUM ('RETREAT', 'EVENT', 'BIRTHDAY', 'HOLIDAY', 'ETC');
CREATE TYPE prayer_visibility AS ENUM ('PUBLIC', 'GROUP_ONLY', 'LEADER_ONLY', 'PASTOR_ONLY');
CREATE TYPE finance_type AS ENUM ('INCOME', 'EXPENSE');

-- 앱 로그인 계정. 공동체 명부와는 따로 둡니다.
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_uidx UNIQUE (email)
);

-- 로그인 표식. 원문 대신 해시만 저장합니다.
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessions_token_hash_uidx UNIQUE (token_hash)
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- 교회 공동체. 다른 표는 community_id 로 이 줄을 가리킵니다.
CREATE TABLE communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  church_name text NOT NULL,
  denomination text NOT NULL,
  slug text NOT NULL,
  plan_tier plan_tier NOT NULL DEFAULT 'FREE',
  require_approval boolean NOT NULL DEFAULT false,
  language_mode language_mode NOT NULL DEFAULT 'JEJU_DUAL',
  custom_term_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT communities_slug_uidx UNIQUE (slug)
);

-- 명부. user_id 가 비어 있으면 아직 앱 계정이 없는 명부입니다.
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  birth_date date,
  gender text,
  role member_role NOT NULL DEFAULT 'MEMBER',
  current_group_id uuid,
  status member_status NOT NULL DEFAULT 'ACTIVE',
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX members_community_id_idx ON members (community_id);
CREATE INDEX members_user_id_idx ON members (user_id);
CREATE INDEX members_current_group_id_idx ON members (current_group_id);
CREATE INDEX members_community_status_idx ON members (community_id, status);

-- 계절 모들. 리더가 빠지면 리더 칸만 비웁니다.
CREATE TABLE small_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  season_year integer NOT NULL,
  name text NOT NULL,
  leader_member_id uuid REFERENCES members (id) ON DELETE SET NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX small_groups_community_id_idx ON small_groups (community_id);
CREATE INDEX small_groups_leader_member_id_idx ON small_groups (leader_member_id);
CREATE INDEX small_groups_community_season_idx ON small_groups (community_id, season_year);

-- 명부의 현재 모들. 모들이 지워지면 칸만 비웁니다.
ALTER TABLE members
  ADD CONSTRAINT members_current_group_id_fk
  FOREIGN KEY (current_group_id) REFERENCES small_groups (id) ON DELETE SET NULL;

-- 초대 코드.
CREATE TABLE invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  code text NOT NULL,
  created_by_member_id uuid REFERENCES members (id) ON DELETE SET NULL,
  expires_at timestamptz,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invite_codes_code_uidx UNIQUE (code),
  CONSTRAINT invite_codes_use_count_nonnegative CHECK (use_count >= 0),
  CONSTRAINT invite_codes_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0)
);

CREATE INDEX invite_codes_community_id_idx ON invite_codes (community_id);

-- 가입 승인 대기열. member_id 는 기존 미가입 명부와 합칠 때 씁니다.
CREATE TABLE approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  applicant_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  applicant_name text NOT NULL,
  applicant_contact text,
  denomination_confirmed boolean NOT NULL DEFAULT false,
  status approval_status NOT NULL DEFAULT 'PENDING',
  member_id uuid REFERENCES members (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX approval_requests_community_id_idx ON approval_requests (community_id);
CREATE INDEX approval_requests_applicant_user_id_idx ON approval_requests (applicant_user_id);
CREATE INDEX approval_requests_community_status_idx ON approval_requests (community_id, status);

-- 모들 글. 모들을 지우면 글도 지워집니다.
CREATE TABLE group_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES small_groups (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  content text NOT NULL,
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  grace_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_posts_grace_nonnegative CHECK (grace_count >= 0)
);

CREATE INDEX group_posts_group_id_idx ON group_posts (group_id);
CREATE INDEX group_posts_author_id_idx ON group_posts (author_id);

-- 모들 사진첩. 게시글과 분리합니다.
CREATE TABLE group_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES small_groups (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  title text NOT NULL,
  media_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX group_albums_group_id_idx ON group_albums (group_id);
CREATE INDEX group_albums_author_id_idx ON group_albums (author_id);

-- 주일 기별. 공개 나누기 표식은 서로 겹치지 않습니다. 초안은 표식이 비어도 됩니다.
CREATE TABLE bulletins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  worship_date date NOT NULL,
  sermon_title text NOT NULL,
  scripture_text text NOT NULL,
  preacher text NOT NULL,
  blocks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  share_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulletins_share_token_uidx UNIQUE (share_token)
);

CREATE INDEX bulletins_community_id_idx ON bulletins (community_id);
CREATE INDEX bulletins_community_date_idx ON bulletins (community_id, worship_date);

-- 출석 모임.
CREATE TABLE attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  department_type department_type NOT NULL,
  title text NOT NULL,
  session_date date NOT NULL,
  qr_checkin_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_sessions_qr_checkin_token_uidx UNIQUE (qr_checkin_token)
);

CREATE INDEX attendance_sessions_community_id_idx ON attendance_sessions (community_id);
CREATE INDEX attendance_sessions_community_date_idx ON attendance_sessions (community_id, session_date);

-- 출석 한 줄. 같은 모임에 같은 사람은 한 번만 기록합니다.
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES attendance_sessions (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  status attendance_status NOT NULL,
  check_method check_method NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_records_session_member_uidx UNIQUE (session_id, member_id)
);

CREATE INDEX attendance_records_member_id_idx ON attendance_records (member_id);

-- 공동체 일정.
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  title text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  category calendar_category NOT NULL,
  is_leader_only boolean NOT NULL DEFAULT false,
  google_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_time_order CHECK (end_at >= start_at)
);

CREATE INDEX calendar_events_community_id_idx ON calendar_events (community_id);
CREATE INDEX calendar_events_community_start_idx ON calendar_events (community_id, start_at);

-- 하루 묵상 본문.
CREATE TABLE daily_qts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  qt_date date NOT NULL,
  scripture_title text NOT NULL,
  scripture_body text NOT NULL,
  questions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_file_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX daily_qts_community_id_idx ON daily_qts (community_id);
CREATE INDEX daily_qts_community_date_idx ON daily_qts (community_id, qt_date);

-- 개인 묵상.
CREATE TABLE qt_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qt_id uuid NOT NULL REFERENCES daily_qts (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  answers_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  grace_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qt_reflections_grace_nonnegative CHECK (grace_count >= 0)
);

CREATE INDEX qt_reflections_qt_id_idx ON qt_reflections (qt_id);
CREATE INDEX qt_reflections_member_id_idx ON qt_reflections (member_id);

-- 기도 나눔.
CREATE TABLE prayer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  group_id uuid REFERENCES small_groups (id) ON DELETE SET NULL,
  content text NOT NULL,
  is_anonymous boolean NOT NULL DEFAULT false,
  visibility prayer_visibility NOT NULL DEFAULT 'PUBLIC',
  pray_together_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prayer_requests_count_nonnegative CHECK (pray_together_count >= 0)
);

CREATE INDEX prayer_requests_community_id_idx ON prayer_requests (community_id);
CREATE INDEX prayer_requests_member_id_idx ON prayer_requests (member_id);
CREATE INDEX prayer_requests_group_id_idx ON prayer_requests (group_id);

-- 함께 기도 반응. 한 글에 한 사람은 한 줄입니다.
CREATE TABLE prayer_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_request_id uuid NOT NULL REFERENCES prayer_requests (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prayer_reactions_request_member_uidx UNIQUE (prayer_request_id, member_id)
);

CREATE INDEX prayer_reactions_member_id_idx ON prayer_reactions (member_id);

-- 기도 쪽지.
CREATE TABLE prayer_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prayer_request_id uuid NOT NULL REFERENCES prayer_requests (id) ON DELETE CASCADE,
  sender_member_id uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  receiver_member_id uuid NOT NULL REFERENCES members (id) ON DELETE CASCADE,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prayer_letters_prayer_request_id_idx ON prayer_letters (prayer_request_id);
CREATE INDEX prayer_letters_sender_member_id_idx ON prayer_letters (sender_member_id);
CREATE INDEX prayer_letters_receiver_member_id_idx ON prayer_letters (receiver_member_id);

-- 살림 항목.
CREATE TABLE finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  department_or_event text NOT NULL,
  type finance_type NOT NULL,
  name text NOT NULL,
  budget_amount numeric(14, 0) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_categories_budget_nonnegative CHECK (budget_amount >= 0)
);

CREATE INDEX finance_categories_community_id_idx ON finance_categories (community_id);

-- 돈 기록. 항목을 지우면 그 항목의 기록도 함께 지워집니다.
-- 적은 사람이 빠져도 돈 기록은 남고 recorded_by 만 비웁니다.
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES finance_categories (id) ON DELETE CASCADE,
  transaction_date date NOT NULL,
  type finance_type NOT NULL,
  amount numeric(14, 0) NOT NULL,
  description text NOT NULL,
  receipt_image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_by uuid REFERENCES members (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactions_amount_nonnegative CHECK (amount >= 0)
);

CREATE INDEX transactions_community_id_idx ON transactions (community_id);
CREATE INDEX transactions_category_id_idx ON transactions (category_id);
CREATE INDEX transactions_recorded_by_idx ON transactions (recorded_by);
CREATE INDEX transactions_community_date_idx ON transactions (community_id, transaction_date);

-- 설문.
CREATE TABLE surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  title text NOT NULL,
  questions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  allow_anonymous boolean NOT NULL DEFAULT false,
  deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX surveys_community_id_idx ON surveys (community_id);

-- 회의록.
CREATE TABLE meeting_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  meeting_date date NOT NULL,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  content text NOT NULL,
  attachment_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meeting_minutes_community_id_idx ON meeting_minutes (community_id);

-- 행사 기록.
CREATE TABLE event_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  title text NOT NULL,
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  youtube_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_archives_community_id_idx ON event_archives (community_id);

-- 퀴즈.
CREATE TABLE quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  title text NOT NULL,
  questions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  scores_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quizzes_community_id_idx ON quizzes (community_id);

-- 열린 안뜨레. 공동체마다 하나, 주소 이름은 서로 겹치지 않습니다.
CREATE TABLE website_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  slug text NOT NULL,
  theme_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  blocks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  visit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT website_configs_community_id_uidx UNIQUE (community_id),
  CONSTRAINT website_configs_slug_uidx UNIQUE (slug),
  CONSTRAINT website_configs_visit_nonnegative CHECK (visit_count >= 0)
);

-- 방문 문의.
CREATE TABLE website_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities (id) ON DELETE CASCADE,
  visitor_name text NOT NULL,
  visitor_contact text NOT NULL,
  message text NOT NULL,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX website_inquiries_community_id_idx ON website_inquiries (community_id);

COMMENT ON TABLE users IS '앱 로그인 계정';
COMMENT ON TABLE sessions IS '로그인 표식 해시';
COMMENT ON TABLE communities IS '교회 공동체';
COMMENT ON TABLE members IS '공동체 명부. user_id 가 비면 미가입 명부';
COMMENT ON TABLE small_groups IS '계절 모들';
COMMENT ON TABLE invite_codes IS '공동체 초대 코드';
COMMENT ON TABLE approval_requests IS '가입 승인 대기열';
COMMENT ON TABLE group_posts IS '모들 글';
COMMENT ON TABLE group_albums IS '모들 사진첩';
COMMENT ON TABLE bulletins IS '주일 기별';
COMMENT ON TABLE attendance_sessions IS '출석 모임';
COMMENT ON TABLE attendance_records IS '개인 출석';
COMMENT ON TABLE calendar_events IS '공동체 일정';
COMMENT ON TABLE daily_qts IS '하루 묵상 본문';
COMMENT ON TABLE qt_reflections IS '개인 묵상';
COMMENT ON TABLE prayer_requests IS '기도 나눔';
COMMENT ON TABLE prayer_reactions IS '함께 기도 반응';
COMMENT ON TABLE prayer_letters IS '기도 쪽지';
COMMENT ON TABLE finance_categories IS '살림 항목';
COMMENT ON TABLE transactions IS '돈 기록';
COMMENT ON TABLE surveys IS '설문';
COMMENT ON TABLE meeting_minutes IS '회의록';
COMMENT ON TABLE event_archives IS '행사 기록';
COMMENT ON TABLE quizzes IS '퀴즈';
COMMENT ON TABLE website_configs IS '열린 안뜨레 설정';
COMMENT ON TABLE website_inquiries IS '방문 문의';
COMMENT ON COLUMN members.status IS 'LONG_ABSENT 화면 호칭은 보고픈 괸당. 저장 값은 영문 코드';

COMMIT;
