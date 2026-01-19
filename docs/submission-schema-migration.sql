-- ============================================
-- Submission 테이블에 fiscal_year와 entity_name 컬럼 추가
-- ============================================

-- fiscal_year 컬럼 추가 (귀속연도)
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS fiscal_year TEXT;

-- entity_name 컬럼 추가 (Entity 이름)
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS entity_name TEXT;

-- 인덱스 추가 (필요한 경우)
CREATE INDEX IF NOT EXISTS idx_submissions_fiscal_year ON submissions(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_submissions_entity_name ON submissions(entity_name);

-- 코멘트 추가
COMMENT ON COLUMN submissions.fiscal_year IS '귀속연도 (예: 2025)';
COMMENT ON COLUMN submissions.entity_name IS 'Entity 이름 (예: InBody Asia)';
