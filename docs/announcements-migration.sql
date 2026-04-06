-- Announcements: visibility + view_count + user_profiles.is_admin
-- Supabase SQL Editor에서 실행하세요.

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'confidential';

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN announcements.visibility IS 'confidential: 관리자만 | all: 전체 읽기';
COMMENT ON COLUMN announcements.view_count IS '상세 페이지 조회 누적';

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN user_profiles.is_admin IS '관리자(Announcements 기밀·편집 등). NEXT_PUBLIC_ADMIN_EMAILS와 병행 가능';

-- 특정 계정을 관리자로 지정 (예시 — 필요 시 이메일만 바꿔 실행)
-- UPDATE user_profiles SET is_admin = true WHERE lower(email) = lower('seung-hyun.cho@inbody.com');
