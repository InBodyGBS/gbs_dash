-- ============================================
-- Submission Storage 버킷 정책 설정
-- ============================================
-- Supabase SQL Editor에서 실행하세요.

-- 1. 인증된 사용자 업로드 허용
CREATE POLICY "Allow authenticated uploads to submission"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'submission'::text);

-- 2. 인증된 사용자 다운로드 허용
CREATE POLICY "Allow authenticated reads from submission"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'submission'::text);

-- 3. 인증된 사용자 삭제 허용
CREATE POLICY "Allow authenticated deletes from submission"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'submission'::text);

-- 4. 인증된 사용자 업데이트 허용 (필요한 경우)
CREATE POLICY "Allow authenticated updates to submission"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'submission'::text)
WITH CHECK (bucket_id = 'submission'::text);

-- ============================================
-- 또는 모든 사용자 허용 (개발 환경용)
-- ============================================
-- 아래 정책들은 public 역할에 대한 정책입니다.
-- 프로덕션 환경에서는 보안을 위해 위의 authenticated 정책만 사용하세요.

-- 5. 모든 사용자 업로드 허용 (선택사항)
-- CREATE POLICY "Allow public uploads to submission"
-- ON storage.objects
-- FOR INSERT
-- TO public
-- WITH CHECK (bucket_id = 'submission'::text);

-- 6. 모든 사용자 다운로드 허용 (선택사항)
-- CREATE POLICY "Allow public reads from submission"
-- ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'submission'::text);

-- 7. 모든 사용자 삭제 허용 (선택사항)
-- CREATE POLICY "Allow public deletes from submission"
-- ON storage.objects
-- FOR DELETE
-- TO public
-- USING (bucket_id = 'submission'::text);
