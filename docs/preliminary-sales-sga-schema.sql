-- ============================================
-- Preliminary Sales/SG&A 데이터베이스 스키마
-- ============================================

-- preliminary_sales_sga 테이블 생성
CREATE TABLE IF NOT EXISTS preliminary_sales_sga (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quarter_id UUID REFERENCES quarters(id) ON DELETE SET NULL,
  subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL,
  period TEXT NOT NULL CHECK (period IN ('1Q', '2Q', '3Q', '4Q')),
  sales NUMERIC(15, 2),
  sga NUMERIC(15, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(quarter_id, subsidiary_id, period)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_preliminary_sales_sga_quarter ON preliminary_sales_sga(quarter_id);
CREATE INDEX IF NOT EXISTS idx_preliminary_sales_sga_subsidiary ON preliminary_sales_sga(subsidiary_id);
CREATE INDEX IF NOT EXISTS idx_preliminary_sales_sga_period ON preliminary_sales_sga(period);

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_preliminary_sales_sga_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_preliminary_sales_sga_timestamp ON preliminary_sales_sga;
CREATE TRIGGER update_preliminary_sales_sga_timestamp
    BEFORE UPDATE ON preliminary_sales_sga
    FOR EACH ROW
    EXECUTE FUNCTION update_preliminary_sales_sga_updated_at();

-- 코멘트
COMMENT ON TABLE preliminary_sales_sga IS 'Preliminary Sales/SG&A 데이터';
COMMENT ON COLUMN preliminary_sales_sga.period IS '분기 (1Q, 2Q, 3Q, 4Q)';
COMMENT ON COLUMN preliminary_sales_sga.sales IS 'Sales 금액';
COMMENT ON COLUMN preliminary_sales_sga.sga IS 'SG&A 금액';

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================

-- RLS 활성화
ALTER TABLE preliminary_sales_sga ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view preliminary sales sga" ON preliminary_sales_sga;
DROP POLICY IF EXISTS "Anyone can create preliminary sales sga" ON preliminary_sales_sga;
DROP POLICY IF EXISTS "Anyone can update preliminary sales sga" ON preliminary_sales_sga;
DROP POLICY IF EXISTS "Anyone can delete preliminary sales sga" ON preliminary_sales_sga;

-- 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view preliminary sales sga"
  ON preliminary_sales_sga
  FOR SELECT
  USING (true);

-- 모든 사용자가 생성 가능
CREATE POLICY "Anyone can create preliminary sales sga"
  ON preliminary_sales_sga
  FOR INSERT
  WITH CHECK (true);

-- 모든 사용자가 수정 가능
CREATE POLICY "Anyone can update preliminary sales sga"
  ON preliminary_sales_sga
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 모든 사용자가 삭제 가능
CREATE POLICY "Anyone can delete preliminary sales sga"
  ON preliminary_sales_sga
  FOR DELETE
  USING (true);
