-- ============================================
-- 회원가입 시 user_profiles 자동 생성
--
-- 문제:
--   - signUp() 직후 클라이언트가 user_profiles 에 INSERT 시도
--   - 그러나 (a) INSERT 정책이 없고 (b) 이메일 확인 활성화 시 세션이 없어 → 401 Unauthorized
--
-- 해결:
--   1) auth.users INSERT → SECURITY DEFINER 함수로 user_profiles 자동 생성 (트리거)
--   2) 안전망: 본인이 본인 행을 INSERT 하는 정책도 추가
--
-- Supabase SQL Editor 에서 실행
-- ============================================

-- 1) 본인 프로필 INSERT 허용 (인증 세션이 있을 때만)
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 2) auth.users 신규 생성 시 user_profiles 자동 채움 (트리거)
--    name / team 은 signUp() 호출 시 options.data 로 넘긴 raw_user_meta_data 에서 읽는다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, name, team)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'team'), '')
  )
  ON CONFLICT (id) DO NOTHING; -- 멱등성 보장
  RETURN NEW;
END;
$$;

-- 3) 기존 트리거 제거 후 재생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 검증 쿼리
-- ============================================
-- 트리거 등록 확인
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created';

-- 정책 등록 확인
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.user_profiles'::regclass;
