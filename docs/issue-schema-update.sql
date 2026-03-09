-- ============================================
-- Issue 테이블에 새 필드 추가 (inquired_by, type)
-- ============================================

-- 문의자 필드 추가
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS inquired_by TEXT;

-- Type 필드 추가 (Daily / Q Closing)
ALTER TABLE issues 
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('Daily', 'Q Closing') OR type IS NULL);

-- 인덱스 추가 (선택사항)
CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(type);
CREATE INDEX IF NOT EXISTS idx_issues_inquired_by ON issues(inquired_by);
