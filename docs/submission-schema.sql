-- ============================================
-- Submission 데이터베이스 스키마
-- ============================================

-- 1. submissions 테이블 (제출 파일 정보)
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quarter_id UUID REFERENCES quarters(id) ON DELETE SET NULL,
  subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL,
  fiscal_year TEXT,
  entity_name TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'employee-jd', 'preliminary-sales', 'sales-detail', 'lease-detail',
    'ar-detail', 'inventory-detail', 'sga-detail', 'demo-detail',
    'pkg', 'interco-transaction'
  )),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  submitted_by TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_submissions_quarter ON submissions(quarter_id);
CREATE INDEX IF NOT EXISTS idx_submissions_subsidiary ON submissions(subsidiary_id);
CREATE INDEX IF NOT EXISTS idx_submissions_fiscal_year ON submissions(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_submissions_entity_name ON submissions(entity_name);
CREATE INDEX IF NOT EXISTS idx_submissions_category ON submissions(category);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_category_date ON submissions(category, submitted_at DESC);

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_submissions_timestamp ON submissions;
CREATE TRIGGER update_submissions_timestamp
    BEFORE UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_submissions_updated_at();

-- 코멘트
COMMENT ON TABLE submissions IS '분기별 보고서 제출 파일 정보';
COMMENT ON COLUMN submissions.fiscal_year IS '귀속연도 (예: 2025)';
COMMENT ON COLUMN submissions.entity_name IS 'Entity 이름 (예: InBody Asia)';
COMMENT ON COLUMN submissions.category IS '카테고리 (일정 페이지의 카테고리와 동일)';
COMMENT ON COLUMN submissions.version IS '제출 버전 (같은 카테고리에서 여러 번 제출 시 증가)';
COMMENT ON COLUMN submissions.submitted_at IS '제출 날짜 (자동 분류에 사용)';

-- ============================================
-- 2. submission_comments 테이블 (댓글/메모)
-- ============================================
CREATE TABLE IF NOT EXISTS submission_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  edited BOOLEAN DEFAULT false
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_submission_comments_submission ON submission_comments(submission_id);
CREATE INDEX IF NOT EXISTS idx_submission_comments_created_at ON submission_comments(created_at ASC);

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_submission_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_submission_comments_timestamp ON submission_comments;
CREATE TRIGGER update_submission_comments_timestamp
    BEFORE UPDATE ON submission_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_submission_comments_updated_at();

-- 코멘트
COMMENT ON TABLE submission_comments IS '제출 파일에 대한 댓글/메모 (채팅 인터페이스)';
COMMENT ON COLUMN submission_comments.edited IS '댓글이 수정되었는지 여부';

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================

-- RLS 활성화
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_comments ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (이미 존재하는 경우)
DROP POLICY IF EXISTS "Anyone can view submissions" ON submissions;
DROP POLICY IF EXISTS "Anyone can view submission comments" ON submission_comments;
DROP POLICY IF EXISTS "Authenticated users can create submissions" ON submissions;
DROP POLICY IF EXISTS "Anyone can create submission comments" ON submission_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON submission_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON submission_comments;

-- 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view submissions"
  ON submissions
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view submission comments"
  ON submission_comments
  FOR SELECT
  USING (true);

-- 인증된 사용자가 제출 가능
CREATE POLICY "Authenticated users can create submissions"
  ON submissions
  FOR INSERT
  WITH CHECK (true);

-- 인증된 사용자가 댓글 작성 가능
CREATE POLICY "Anyone can create submission comments"
  ON submission_comments
  FOR INSERT
  WITH CHECK (true);

-- 작성자가 댓글 수정/삭제 가능
CREATE POLICY "Users can update their own comments"
  ON submission_comments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete their own comments"
  ON submission_comments
  FOR DELETE
  USING (true);
