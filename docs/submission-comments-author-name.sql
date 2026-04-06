-- One-time migration: store memo author display at write time (readable without user_profiles join issues)
ALTER TABLE submission_comments ADD COLUMN IF NOT EXISTS author_name TEXT;
COMMENT ON COLUMN submission_comments.author_name IS '메모 작성 시점 표시 이름';
