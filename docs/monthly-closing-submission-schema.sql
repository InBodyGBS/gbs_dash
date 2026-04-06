-- ============================================
-- Monthly Closing - Submission / Overview 스키마
-- ============================================

-- 이 문서는 DB 테이블 생성용입니다. (구 월별 Overview/Submission UI는 제거됨)

-- ============================================
-- 1. monthly_submissions (Stamp=submitted_at)
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (
    category IN ('trial-balance', 'sales', 'inventory', 'ar', 'general-ledger')
  ),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  submitted_by TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(period_year, period_month, subsidiary_id, category, version)
);

CREATE INDEX IF NOT EXISTS idx_monthly_submissions_period
  ON monthly_submissions(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_monthly_submissions_subsidiary
  ON monthly_submissions(subsidiary_id);
CREATE INDEX IF NOT EXISTS idx_monthly_submissions_category
  ON monthly_submissions(category);
CREATE INDEX IF NOT EXISTS idx_monthly_submissions_latest
  ON monthly_submissions(period_year, period_month, subsidiary_id, category, submitted_at DESC);

CREATE OR REPLACE FUNCTION update_monthly_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_monthly_submissions_timestamp ON monthly_submissions;
CREATE TRIGGER update_monthly_submissions_timestamp
  BEFORE UPDATE ON monthly_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_submissions_updated_at();

-- ============================================
-- 2. monthly_review_statuses (Reviewing/Confirm 수기 토글)
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_review_statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL,
  reviewing BOOLEAN NOT NULL DEFAULT FALSE,
  confirm BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(period_year, period_month, subsidiary_id)
);

CREATE INDEX IF NOT EXISTS idx_monthly_review_statuses_period
  ON monthly_review_statuses(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_monthly_review_statuses_subsidiary
  ON monthly_review_statuses(subsidiary_id);

CREATE OR REPLACE FUNCTION update_monthly_review_statuses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_monthly_review_statuses_timestamp ON monthly_review_statuses;
CREATE TRIGGER update_monthly_review_statuses_timestamp
  BEFORE UPDATE ON monthly_review_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_review_statuses_updated_at();

-- ============================================
-- 3. RLS (프론트에서 authenticated upsert 사용)
-- ============================================
ALTER TABLE monthly_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_review_statuses ENABLE ROW LEVEL SECURITY;

-- 조회는 누구나
DROP POLICY IF EXISTS "Anyone can view monthly submissions" ON monthly_submissions;
CREATE POLICY "Anyone can view monthly submissions"
  ON monthly_submissions
  FOR SELECT
  USING (true);

-- 업로드/삭제는 authenticated
DROP POLICY IF EXISTS "Authenticated users can create monthly submissions" ON monthly_submissions;
CREATE POLICY "Authenticated users can create monthly submissions"
  ON monthly_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete monthly submissions" ON monthly_submissions;
CREATE POLICY "Authenticated users can delete monthly submissions"
  ON monthly_submissions
  FOR DELETE
  TO authenticated
  USING (true);

-- Reviewing/Confirm: upsert은 authenticated
DROP POLICY IF EXISTS "Anyone can view monthly review statuses" ON monthly_review_statuses;
CREATE POLICY "Anyone can view monthly review statuses"
  ON monthly_review_statuses
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can upsert monthly review statuses" ON monthly_review_statuses;
CREATE POLICY "Authenticated users can upsert monthly review statuses"
  ON monthly_review_statuses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update monthly review statuses" ON monthly_review_statuses;
CREATE POLICY "Authenticated users can update monthly review statuses"
  ON monthly_review_statuses
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

