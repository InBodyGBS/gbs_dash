-- ============================================
-- 최소 설정: Quarterly Closing 테이블만 생성
-- ============================================

-- 1. quarters 테이블 생성
CREATE TABLE IF NOT EXISTS quarters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(year, quarter)
);

-- 2. schedule_items 테이블 생성
CREATE TABLE IF NOT EXISTS schedule_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quarter_id UUID NOT NULL REFERENCES quarters(id) ON DELETE CASCADE,
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  planned_date DATE NOT NULL,
  confirmed_date DATE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(quarter_id, subsidiary_id, category)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_quarters_year_quarter ON quarters(year DESC, quarter DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_quarter ON schedule_items(quarter_id);
CREATE INDEX IF NOT EXISTS idx_schedule_subsidiary ON schedule_items(subsidiary_id);
CREATE INDEX IF NOT EXISTS idx_schedule_status ON schedule_items(status);
CREATE INDEX IF NOT EXISTS idx_schedule_category ON schedule_items(category);

-- 4. 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_schedule_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_schedule_items_timestamp ON schedule_items;
CREATE TRIGGER update_schedule_items_timestamp
    BEFORE UPDATE ON schedule_items
    FOR EACH ROW
    EXECUTE FUNCTION update_schedule_items_updated_at();

-- 완료!
SELECT '✅ Quarterly Closing 테이블 생성 완료!' AS message;

