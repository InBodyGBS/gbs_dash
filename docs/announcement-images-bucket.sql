-- ============================================================
-- announcement-images Supabase Storage 버킷
--   - 공지사항(Announcements) 본문에 삽입되는 이미지 저장
--   - 공개 읽기(이미지 inline 노출용) + 인증된 사용자 업로드
--   - 관리자만 삭제·수정 가능
-- 실행: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1) 버킷 생성 (public 읽기 허용)
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcement-images', 'announcement-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2) 기존 정책 정리 (재실행 안전)
DROP POLICY IF EXISTS "announcement-images public read" ON storage.objects;
DROP POLICY IF EXISTS "announcement-images authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "announcement-images admin update" ON storage.objects;
DROP POLICY IF EXISTS "announcement-images admin delete" ON storage.objects;

-- 3) SELECT: 누구나 읽기 가능 (인라인 이미지 노출용)
CREATE POLICY "announcement-images public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'announcement-images');

-- 4) INSERT: 인증된 사용자(로그인된 staff)는 업로드 가능
CREATE POLICY "announcement-images authenticated insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'announcement-images');

-- 5) UPDATE: 관리자만 (gbs_admin)
CREATE POLICY "announcement-images admin update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'announcement-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'gbs_admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  )
)
WITH CHECK (
  bucket_id = 'announcement-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'gbs_admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  )
);

-- 6) DELETE: 관리자만 (gbs_admin)
CREATE POLICY "announcement-images admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'announcement-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'gbs_admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.is_admin = true
    )
  )
);

-- ============================================================
-- 확인
-- ============================================================
-- SELECT id, name, public FROM storage.buckets WHERE id = 'announcement-images';
-- SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND policyname LIKE 'announcement-images%';
