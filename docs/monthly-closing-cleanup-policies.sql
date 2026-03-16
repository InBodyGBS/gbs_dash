-- ============================================
-- Monthly Closing - 중복 정책 정리
-- 기존 정책 삭제 후 깔끔하게 재설정
-- ============================================

-- 1. 기존 monthly-closing 관련 중복 정책 삭제
DROP POLICY IF EXISTS "Allow authenticated deletes from monthly-closing" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads from monthly-closing" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to monthly-closing" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to monthly-closing" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- 2. 새로운 정책 생성 (깔끔하게 4개만)
CREATE POLICY "monthly-closing: authenticated upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'monthly-closing');

CREATE POLICY "monthly-closing: authenticated select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'monthly-closing');

CREATE POLICY "monthly-closing: authenticated update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'monthly-closing');

CREATE POLICY "monthly-closing: authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'monthly-closing');

-- 3. 확인
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'objects' 
  AND schemaname = 'storage'
  AND policyname LIKE '%monthly-closing%'
ORDER BY policyname;
