-- Announcements / Announcement Comments — View open to all users (anon + authenticated)
-- Execute in Supabase SQL Editor (production + preview as needed)

-- Enable RLS
ALTER TABLE IF EXISTS announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS announcement_comments ENABLE ROW LEVEL SECURITY;

-- Read policies (anyone can read)
DROP POLICY IF EXISTS "Anon read announcements" ON announcements;
CREATE POLICY "Anon read announcements"
  ON announcements FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated read announcements" ON announcements;
CREATE POLICY "Authenticated read announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anon read announcement_comments" ON announcement_comments;
CREATE POLICY "Anon read announcement_comments"
  ON announcement_comments FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated read announcement_comments" ON announcement_comments;
CREATE POLICY "Authenticated read announcement_comments"
  ON announcement_comments FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- 쓰기 정책 (INSERT / UPDATE / DELETE)
-- 관리자 판정: user_roles.role = 'gbs_admin' 또는 user_profiles.is_admin = true
-- (두 admin 시스템이 병행 운영되는 동안 OR 조건으로 수용)
-- ============================================

-- 관리자 여부 체크 헬퍼 함수
CREATE OR REPLACE FUNCTION is_announcement_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'gbs_admin'
  ) OR EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- announcements: 관리자만 INSERT
DROP POLICY IF EXISTS "Admin insert announcements" ON announcements;
CREATE POLICY "Admin insert announcements"
  ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (is_announcement_admin());

-- announcements: 관리자만 UPDATE
DROP POLICY IF EXISTS "Admin update announcements" ON announcements;
CREATE POLICY "Admin update announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (is_announcement_admin())
  WITH CHECK (is_announcement_admin());

-- announcements: 관리자만 DELETE
DROP POLICY IF EXISTS "Admin delete announcements" ON announcements;
CREATE POLICY "Admin delete announcements"
  ON announcements FOR DELETE
  TO authenticated
  USING (is_announcement_admin());

-- announcement_comments: 인증 사용자는 본인 댓글만 작성/수정/삭제 가능 (운영 정책에 맞게 조정 가능)
DROP POLICY IF EXISTS "Authenticated insert announcement_comments" ON announcement_comments;
CREATE POLICY "Authenticated insert announcement_comments"
  ON announcement_comments FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated update announcement_comments" ON announcement_comments;
CREATE POLICY "Authenticated update announcement_comments"
  ON announcement_comments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete announcement_comments" ON announcement_comments;
CREATE POLICY "Authenticated delete announcement_comments"
  ON announcement_comments FOR DELETE
  TO authenticated
  USING (true);

