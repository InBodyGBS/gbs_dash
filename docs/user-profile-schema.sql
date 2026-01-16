-- ============================================
-- 사용자 프로필 테이블 스키마
-- ============================================

-- user_profiles 테이블 생성
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  team TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- 코멘트
COMMENT ON TABLE user_profiles IS '사용자 프로필 정보';
COMMENT ON COLUMN user_profiles.id IS 'auth.users의 UUID (외래키)';
COMMENT ON COLUMN user_profiles.email IS '이메일 주소';
COMMENT ON COLUMN user_profiles.name IS '사용자 이름';
COMMENT ON COLUMN user_profiles.team IS '소속 팀';

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION update_user_profiles_updated_at();

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================

-- RLS 활성화
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 프로필 조회 가능
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 인증된 사용자가 자신의 프로필 수정 가능
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 모든 사용자가 프로필 조회 가능 (공개 정보)
CREATE POLICY "Anyone can view profiles"
  ON user_profiles
  FOR SELECT
  USING (true);
