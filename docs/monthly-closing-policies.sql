-- ============================================
-- Monthly Closing - Storage Policies
-- Supabase Storage RLS 정책 설정
-- PRD Section 4.6 기반
-- ============================================

-- 1. Storage Bucket 생성
-- 주의: Supabase Dashboard에서 먼저 버킷을 생성하세요.
-- 버킷 이름: monthly-closing
-- Public: false (비공개)

-- 버킷이 없으면 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('monthly-closing', 'monthly-closing', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Storage Policies
-- ============================================

-- 기존 정책 삭제 (있으면)
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;

-- Policy 1: 인증된 사용자만 업로드 가능
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'monthly-closing'
);

-- Policy 2: 인증된 사용자는 모든 파일 조회 가능
CREATE POLICY "Authenticated users can view files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'monthly-closing'
);

-- Policy 3: 인증된 사용자는 파일 업데이트 가능
CREATE POLICY "Authenticated users can update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'monthly-closing'
);

-- Policy 4: 인증된 사용자는 파일 삭제 가능
CREATE POLICY "Authenticated users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'monthly-closing'
);
