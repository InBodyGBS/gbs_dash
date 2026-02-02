-- ============================================
-- Financial Result 데이터베이스 스키마
-- ============================================

-- 1. financial_result_files 테이블 (업로드된 파일 정보)
CREATE TABLE IF NOT EXISTS financial_result_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  uploaded_by TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_financial_result_files_fiscal_year ON financial_result_files(fiscal_year DESC, quarter DESC);
CREATE INDEX IF NOT EXISTS idx_financial_result_files_uploaded_at ON financial_result_files(uploaded_at DESC);

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_financial_result_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_financial_result_files_timestamp ON financial_result_files;
CREATE TRIGGER update_financial_result_files_timestamp
    BEFORE UPDATE ON financial_result_files
    FOR EACH ROW
    EXECUTE FUNCTION update_financial_result_files_updated_at();

-- 코멘트
COMMENT ON TABLE financial_result_files IS '분기별 실적 파일 업로드 정보';
COMMENT ON COLUMN financial_result_files.fiscal_year IS '귀속연도 (예: 2025)';
COMMENT ON COLUMN financial_result_files.quarter IS '분기 (1-4)';

-- ============================================
-- 2. financial_result_data 테이블 (실적 데이터)
-- ============================================
CREATE TABLE IF NOT EXISTS financial_result_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID NOT NULL REFERENCES financial_result_files(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL,
  period TEXT NOT NULL, -- "20254Q" 형식
  rev_account TEXT NOT NULL, -- "매출", "매출원가", "판관비" 등
  amount_krw BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_financial_result_data_file ON financial_result_data(file_id);
CREATE INDEX IF NOT EXISTS idx_financial_result_data_entity ON financial_result_data(entity);
CREATE INDEX IF NOT EXISTS idx_financial_result_data_subsidiary ON financial_result_data(subsidiary_id);
CREATE INDEX IF NOT EXISTS idx_financial_result_data_period ON financial_result_data(period);
CREATE INDEX IF NOT EXISTS idx_financial_result_data_rev_account ON financial_result_data(rev_account);
CREATE INDEX IF NOT EXISTS idx_financial_result_data_entity_period ON financial_result_data(entity, period);
CREATE INDEX IF NOT EXISTS idx_financial_result_data_subsidiary_period ON financial_result_data(subsidiary_id, period);

-- 코멘트
COMMENT ON TABLE financial_result_data IS '실적 데이터 (Entity별, Period별, Rev_Account별)';
COMMENT ON COLUMN financial_result_data.entity IS 'Entity 이름 (예: HQ, USA, Japan) - 참조용';
COMMENT ON COLUMN financial_result_data.subsidiary_id IS '법인 ID (subsidiaries 테이블 참조, nullable - 연결조정 등은 NULL)';
COMMENT ON COLUMN financial_result_data.period IS 'Period 문자열 (예: "20254Q")';
COMMENT ON COLUMN financial_result_data.rev_account IS '계정명 (예: 매출, 매출원가, 판관비)';
COMMENT ON COLUMN financial_result_data.amount_krw IS '금액 (원화)';

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================

-- RLS 활성화
ALTER TABLE financial_result_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_result_data ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (이미 존재하는 경우)
DROP POLICY IF EXISTS "Anyone can view financial result files" ON financial_result_files;
DROP POLICY IF EXISTS "Anyone can view financial result data" ON financial_result_data;
DROP POLICY IF EXISTS "Anyone can create financial result files" ON financial_result_files;
DROP POLICY IF EXISTS "Anyone can create financial result data" ON financial_result_data;

-- 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view financial result files"
  ON financial_result_files
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can view financial result data"
  ON financial_result_data
  FOR SELECT
  USING (true);

-- 모든 사용자가 생성 가능
CREATE POLICY "Anyone can create financial result files"
  ON financial_result_files
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can create financial result data"
  ON financial_result_data
  FOR INSERT
  WITH CHECK (true);
