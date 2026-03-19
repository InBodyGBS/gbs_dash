-- ============================================
-- Monthly Submission Storage 버킷 정책 설정
-- Bucket id: monthly-submission (private)
-- ============================================

-- 1) 버킷 생성 (이미 있으면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('monthly-submission', 'monthly-submission', false)
ON CONFLICT (id) DO NOTHING;

-- 2) 인증 사용자 업로드 허용
DROP POLICY IF EXISTS "Allow authenticated uploads to monthly-submission" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to monthly-submission"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'monthly-submission');

-- 3) 인증 사용자 다운로드 허용
DROP POLICY IF EXISTS "Allow authenticated reads from monthly-submission" ON storage.objects;
CREATE POLICY "Allow authenticated reads from monthly-submission"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'monthly-submission');

-- 4) 인증 사용자 삭제 허용
DROP POLICY IF EXISTS "Allow authenticated deletes from monthly-submission" ON storage.objects;
CREATE POLICY "Allow authenticated deletes from monthly-submission"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'monthly-submission');

-- 5) 인증 사용자 업데이트 허용 (필요 시)
DROP POLICY IF EXISTS "Allow authenticated updates to monthly-submission" ON storage.objects;
CREATE POLICY "Allow authenticated updates to monthly-submission"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'monthly-submission')
WITH CHECK (bucket_id = 'monthly-submission');

