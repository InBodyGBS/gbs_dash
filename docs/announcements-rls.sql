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

-- Optional: keep writes restricted (edit later for fine-grained control)
-- Example: only authenticated can insert/update/delete (adjust as needed later)
-- DROP POLICY IF EXISTS "Authenticated write announcements" ON announcements;
-- CREATE POLICY "Authenticated write announcements"
--   ON announcements FOR ALL
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);

-- DROP POLICY IF EXISTS "Authenticated write announcement_comments" ON announcement_comments;
-- CREATE POLICY "Authenticated write announcement_comments"
--   ON announcement_comments FOR ALL
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);

