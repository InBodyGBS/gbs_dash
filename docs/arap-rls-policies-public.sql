-- Intercompany AR-AP Balance Reconciliation System
-- Row Level Security (RLS) 정책 설정 (Public 접근 허용)
-- 
-- 주의: 이 스크립트는 반드시 arap-schema.sql을 먼저 실행한 후에 실행해야 합니다!
-- 테이블이 생성되지 않은 상태에서 실행하면 에러가 발생합니다.
--
-- 이 버전은 인증 없이도 모든 사용자가 데이터를 볼 수 있도록 설정합니다.
-- Inter-co Transaction 페이지가 sessionStorage 기반 로그인을 사용하므로 필요합니다.

-- 1. arap_submissions 테이블 RLS 활성화
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'arap_submissions') THEN
    ALTER TABLE arap_submissions ENABLE ROW LEVEL SECURITY;
  ELSE
    RAISE NOTICE 'Table arap_submissions does not exist. Please run arap-schema.sql first.';
  END IF;
END $$;

-- 2. arap_submission_details 테이블 RLS 활성화
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'arap_submission_details') THEN
    ALTER TABLE arap_submission_details ENABLE ROW LEVEL SECURITY;
  ELSE
    RAISE NOTICE 'Table arap_submission_details does not exist. Please run arap-schema.sql first.';
  END IF;
END $$;

-- 3. arap_audit_logs 테이블 RLS 활성화
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'arap_audit_logs') THEN
    ALTER TABLE arap_audit_logs ENABLE ROW LEVEL SECURITY;
  ELSE
    RAISE NOTICE 'Table arap_audit_logs does not exist. Please run arap-schema.sql first.';
  END IF;
END $$;

-- 4. arap_submissions 정책 (Public 접근 허용)
-- 기존 정책이 있으면 삭제
DROP POLICY IF EXISTS "Anyone can view submissions" ON arap_submissions;
DROP POLICY IF EXISTS "Anyone can create submissions" ON arap_submissions;
DROP POLICY IF EXISTS "Anyone can update submissions" ON arap_submissions;
DROP POLICY IF EXISTS "Anyone can delete submissions" ON arap_submissions;

-- 모든 사용자(인증 없이도)는 조회 가능
CREATE POLICY "Anyone can view submissions"
ON arap_submissions FOR SELECT
TO public
USING (true);

-- 모든 사용자(인증 없이도)는 생성 가능
CREATE POLICY "Anyone can create submissions"
ON arap_submissions FOR INSERT
TO public
WITH CHECK (true);

-- 모든 사용자(인증 없이도)는 수정 가능
CREATE POLICY "Anyone can update submissions"
ON arap_submissions FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 모든 사용자(인증 없이도)는 삭제 가능
CREATE POLICY "Anyone can delete submissions"
ON arap_submissions FOR DELETE
TO public
USING (true);

-- 5. arap_submission_details 정책 (Public 접근 허용)
-- 기존 정책이 있으면 삭제
DROP POLICY IF EXISTS "Anyone can view submission details" ON arap_submission_details;
DROP POLICY IF EXISTS "Anyone can create submission details" ON arap_submission_details;
DROP POLICY IF EXISTS "Anyone can update submission details" ON arap_submission_details;
DROP POLICY IF EXISTS "Anyone can delete submission details" ON arap_submission_details;

-- 모든 사용자(인증 없이도)는 조회 가능
CREATE POLICY "Anyone can view submission details"
ON arap_submission_details FOR SELECT
TO public
USING (true);

-- 모든 사용자(인증 없이도)는 생성 가능
CREATE POLICY "Anyone can create submission details"
ON arap_submission_details FOR INSERT
TO public
WITH CHECK (true);

-- 모든 사용자(인증 없이도)는 수정 가능
CREATE POLICY "Anyone can update submission details"
ON arap_submission_details FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- 모든 사용자(인증 없이도)는 삭제 가능
CREATE POLICY "Anyone can delete submission details"
ON arap_submission_details FOR DELETE
TO public
USING (true);

-- 6. arap_audit_logs 정책 (Public 접근 허용)
-- 기존 정책이 있으면 삭제
DROP POLICY IF EXISTS "Anyone can view audit logs" ON arap_audit_logs;
DROP POLICY IF EXISTS "Anyone can create audit logs" ON arap_audit_logs;

-- 모든 사용자(인증 없이도)는 조회 가능
CREATE POLICY "Anyone can view audit logs"
ON arap_audit_logs FOR SELECT
TO public
USING (true);

-- 모든 사용자(인증 없이도)는 생성 가능 (읽기 전용이지만 로깅용)
CREATE POLICY "Anyone can create audit logs"
ON arap_audit_logs FOR INSERT
TO public
WITH CHECK (true);
