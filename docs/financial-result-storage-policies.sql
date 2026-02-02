-- ============================================
-- Financial Result Storage 정책
-- ============================================

-- 기존 정책 삭제 (이미 존재하는 경우)
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;

-- financial-result 버킷에 대한 업로드 정책
CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'financial-result'
);

-- financial-result 버킷에 대한 다운로드 정책
CREATE POLICY "Allow public downloads"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'financial-result'
);
