-- ============================================
-- Monthly Closing - Storage Policies
-- Supabase Storage RLS 정책 설정
-- PRD Section 4.6 기반
-- ============================================

-- 1. Storage Bucket 생성
-- Supabase Dashboard에서 먼저 버킷을 생성해야 합니다.
-- 버킷 이름: monthly-closing
-- Public: false (비공개)
INSERT INTO storage.buckets (id, name, public)
VALUES ('monthly-closing', 'monthly-closing', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Storage Policies
-- ============================================

-- Policy 1: 인증된 사용자만 업로드 가능
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'monthly-closing' 
  AND (storage.foldername(name))[1] = 'uploads'
);

-- Policy 2: 인증된 사용자는 모든 파일 조회 가능 (간소화된 정책)
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
CREATE POLICY "Authenticated users can view files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'monthly-closing'
);

-- Policy 3: 인증된 사용자는 파일 업데이트 가능
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
CREATE POLICY "Authenticated users can update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'monthly-closing'
);

-- Policy 4: 인증된 사용자는 파일 삭제 가능
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'monthly-closing'
);

-- ============================================
-- 선택사항: 고급 RLS 정책 (User Roles 기반)
-- user_roles 테이블이 있는 경우에만 사용
-- ============================================

/*
-- Policy: GBS Team은 모든 파일 조회 가능
DROP POLICY IF EXISTS "GBS Team can view all files" ON storage.objects;
CREATE POLICY "GBS Team can view all files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'monthly-closing'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('gbs_admin', 'gbs_user')
  )
);

-- Policy: Export 폴더는 GBS Team만 접근 가능
DROP POLICY IF EXISTS "GBS Team can manage exports" ON storage.objects;
CREATE POLICY "GBS Team can manage exports"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'monthly-closing'
  AND (storage.foldername(name))[1] = 'exports'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('gbs_admin', 'gbs_user')
  )
);
*/

-- ============================================
-- 확인 쿼리
-- ============================================
SELECT 
  policyname,
  tablename,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage';
