-- ============================================
-- 완전한 Quarterly Closing 설정
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 기존 제약 조건 제거 (있다면)
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'schedule_items'::regclass
    AND contype = 'u';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE schedule_items DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE '기존 제약 조건 삭제: %', constraint_name;
    END IF;
END $$;

-- 4. 새로운 제약 조건 추가 (여러 카테고리 허용)
ALTER TABLE schedule_items 
ADD CONSTRAINT schedule_items_unique_constraint 
UNIQUE (quarter_id, subsidiary_id, planned_date, category);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_quarters_year_quarter ON quarters(year DESC, quarter DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_quarter ON schedule_items(quarter_id);
CREATE INDEX IF NOT EXISTS idx_schedule_subsidiary ON schedule_items(subsidiary_id);
CREATE INDEX IF NOT EXISTS idx_schedule_status ON schedule_items(status);
CREATE INDEX IF NOT EXISTS idx_schedule_category ON schedule_items(category);

-- 6. updated_at 트리거
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

-- 7. 테이블 확인
SELECT 
  '✅ quarters 테이블' AS status,
  COUNT(*) AS row_count
FROM quarters
UNION ALL
SELECT 
  '✅ schedule_items 테이블' AS status,
  COUNT(*) AS row_count
FROM schedule_items;

