-- ============================================
-- ARAP Storage 버킷 정책 설정
-- ============================================
-- Supabase SQL Editor에서 실행하세요.
-- 
-- 주의: 이 스크립트를 실행하기 전에 Supabase Dashboard에서
-- 'arap-submissions' 버킷을 먼저 생성해야 합니다.
--
-- 버킷 생성 방법:
-- 1. Supabase Dashboard → Storage
-- 2. "New bucket" 클릭
-- 3. 버킷 이름: arap-submissions
-- 4. Public bucket: 선택 안 함 (비공개)
-- 5. "Create bucket" 클릭

-- 기존 정책이 있으면 삭제 (중복 방지)
DROP POLICY IF EXISTS "Allow authenticated uploads to arap-submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from arap-submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from arap-submissions" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to arap-submissions" ON storage.objects;

-- 1. 인증된 사용자 업로드 허용
CREATE POLICY "Allow authenticated uploads to arap-submissions"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'arap-submissions'::text);

-- 2. 인증된 사용자 다운로드 허용
CREATE POLICY "Allow authenticated reads from arap-submissions"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'arap-submissions'::text);

-- 3. 인증된 사용자 삭제 허용
CREATE POLICY "Allow authenticated deletes from arap-submissions"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'arap-submissions'::text);

-- 4. 인증된 사용자 업데이트 허용 (필요한 경우)
CREATE POLICY "Allow authenticated updates to arap-submissions"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'arap-submissions'::text)
WITH CHECK (bucket_id = 'arap-submissions'::text);

-- ============================================
-- 정책 확인
-- ============================================
-- 다음 쿼리로 정책이 제대로 생성되었는지 확인할 수 있습니다:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%arap-submissions%';
