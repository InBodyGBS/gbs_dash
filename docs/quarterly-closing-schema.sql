-- ============================================
-- Quarterly Closing 데이터베이스 스키마
-- ============================================

-- 1. quarters 테이블 (분기 정보)
CREATE TABLE IF NOT EXISTS quarters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(year, quarter)
);

-- 인덱스
CREATE INDEX idx_quarters_year_quarter ON quarters(year DESC, quarter DESC);

-- 코멘트
COMMENT ON TABLE quarters IS '분기 정보';
COMMENT ON COLUMN quarters.year IS '연도';
COMMENT ON COLUMN quarters.quarter IS '분기 (1-4)';

-- ============================================
-- 2. schedule_items 테이블 (일정 항목)
-- ============================================
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

-- 인덱스
CREATE INDEX idx_schedule_quarter ON schedule_items(quarter_id);
CREATE INDEX idx_schedule_subsidiary ON schedule_items(subsidiary_id);
CREATE INDEX idx_schedule_status ON schedule_items(status);
CREATE INDEX idx_schedule_category ON schedule_items(category);

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_schedule_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_schedule_items_timestamp
    BEFORE UPDATE ON schedule_items
    FOR EACH ROW
    EXECUTE FUNCTION update_schedule_items_updated_at();

-- 코멘트
COMMENT ON TABLE schedule_items IS '결산 일정 항목';
COMMENT ON COLUMN schedule_items.category IS '카테고리 (employee-jd, sales-detail 등)';
COMMENT ON COLUMN schedule_items.status IS '상태 (planned: 예정, confirmed: 확정)';

-- ============================================
-- 3. document_submissions 테이블 (문서 제출)
-- ============================================
CREATE TABLE IF NOT EXISTS document_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quarter_id UUID NOT NULL REFERENCES quarters(id) ON DELETE CASCADE,
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  submitted_by TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(quarter_id, subsidiary_id, category, version)
);

-- 인덱스
CREATE INDEX idx_submissions_quarter ON document_submissions(quarter_id);
CREATE INDEX idx_submissions_subsidiary ON document_submissions(subsidiary_id);
CREATE INDEX idx_submissions_category ON document_submissions(category);
CREATE INDEX idx_submissions_submitted_at ON document_submissions(submitted_at DESC);

-- 코멘트
COMMENT ON TABLE document_submissions IS '결산 서류 제출 이력';
COMMENT ON COLUMN document_submissions.file_path IS 'Supabase Storage 경로';
COMMENT ON COLUMN document_submissions.version IS '문서 버전 (재제출 시 증가)';

-- ============================================
-- 4. closing_guides 테이블 (결산 가이드)
-- ============================================
CREATE TABLE IF NOT EXISTS closing_guides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT,
  summary TEXT,
  content TEXT NOT NULL,
  attachments JSONB,
  tags TEXT[],
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_guides_category ON closing_guides(category);
CREATE INDEX idx_guides_tags ON closing_guides USING GIN(tags);
CREATE INDEX idx_guides_view_count ON closing_guides(view_count DESC);

-- 자동 updated_at 트리거
CREATE TRIGGER update_closing_guides_timestamp
    BEFORE UPDATE ON closing_guides
    FOR EACH ROW
    EXECUTE FUNCTION update_schedule_items_updated_at();

-- 코멘트
COMMENT ON TABLE closing_guides IS '결산 조정 가이드 문서';
COMMENT ON COLUMN closing_guides.content IS 'Markdown 형식 콘텐츠';
COMMENT ON COLUMN closing_guides.tags IS '검색용 태그 배열';

-- ============================================
-- 5. 샘플 데이터 입력
-- ============================================

-- 2024 Q4 분기 생성
INSERT INTO quarters (year, quarter, start_date, end_date) VALUES
(2024, 4, '2024-10-01', '2024-12-31')
ON CONFLICT (year, quarter) DO NOTHING;

-- 샘플 스케줄 항목 (2024 Q4)
-- USA 법인의 일정
INSERT INTO schedule_items (quarter_id, subsidiary_id, category, planned_date, status)
SELECT 
  q.id,
  s.id,
  'employee-jd',
  '2024-10-05'::DATE,
  'confirmed'
FROM quarters q, subsidiaries s
WHERE q.year = 2024 AND q.quarter = 4 AND s.code = 'USA'
ON CONFLICT DO NOTHING;

INSERT INTO schedule_items (quarter_id, subsidiary_id, category, planned_date, status)
SELECT 
  q.id,
  s.id,
  'sales-detail',
  '2024-10-10'::DATE,
  'confirmed'
FROM quarters q, subsidiaries s
WHERE q.year = 2024 AND q.quarter = 4 AND s.code = 'USA'
ON CONFLICT DO NOTHING;

INSERT INTO schedule_items (quarter_id, subsidiary_id, category, planned_date, status)
SELECT 
  q.id,
  s.id,
  'ar-detail',
  '2024-10-15'::DATE,
  'planned'
FROM quarters q, subsidiaries s
WHERE q.year = 2024 AND q.quarter = 4 AND s.code = 'USA'
ON CONFLICT DO NOTHING;

-- Japan 법인의 일정
INSERT INTO schedule_items (quarter_id, subsidiary_id, category, planned_date, status)
SELECT 
  q.id,
  s.id,
  'employee-jd',
  '2024-10-07'::DATE,
  'planned'
FROM quarters q, subsidiaries s
WHERE q.year = 2024 AND q.quarter = 4 AND s.code = 'JPN'
ON CONFLICT DO NOTHING;

INSERT INTO schedule_items (quarter_id, subsidiary_id, category, planned_date, status)
SELECT 
  q.id,
  s.id,
  'sales-detail',
  '2024-10-12'::DATE,
  'confirmed'
FROM quarters q, subsidiaries s
WHERE q.year = 2024 AND q.quarter = 4 AND s.code = 'JPN'
ON CONFLICT DO NOTHING;

-- 샘플 가이드 문서
INSERT INTO closing_guides (title, category, icon, summary, content, tags) VALUES
(
  'Inventory Adjustment',
  'Assets',
  '💼',
  '재고자산 평가 및 조정 방법',
  E'# Inventory Adjustment Guide\n\n## 개요\n재고자산의 기말 평가 및 조정사항을 정리합니다.\n\n## 조정 항목\n1. 재고자산 실사 차이\n2. 평가충당금 설정\n3. 기말 재고 평가',
  ARRAY['재고', '평가', '조정']
),
(
  'Fixed Assets Depreciation',
  'Assets',
  '📊',
  '고정자산 감가상각 계산',
  E'# Fixed Assets Depreciation\n\n## 개요\n고정자산의 감가상각 계산 방법을 안내합니다.\n\n## 계산 방법\n- 정액법\n- 정률법',
  ARRAY['고정자산', '감가상각']
),
(
  'Revenue Recognition',
  'Revenue',
  '💰',
  '수익 인식 기준',
  E'# Revenue Recognition Guide\n\n## 원칙\n수익 인식의 5단계 프로세스를 설명합니다.',
  ARRAY['수익', '인식']
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. 유용한 조회 쿼리
-- ============================================

-- 현재 분기 조회
SELECT * FROM quarters 
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND quarter = EXTRACT(QUARTER FROM CURRENT_DATE);

-- 법인별 일정 현황
SELECT 
  s.name AS subsidiary,
  si.category,
  si.planned_date,
  si.confirmed_date,
  si.status
FROM schedule_items si
JOIN subsidiaries s ON si.subsidiary_id = s.id
JOIN quarters q ON si.quarter_id = q.id
WHERE q.year = 2024 AND q.quarter = 4
ORDER BY s.name, si.planned_date;

-- 성사율 계산 (법인별)
SELECT 
  s.name AS subsidiary,
  COUNT(*) AS total_items,
  COUNT(CASE WHEN si.status = 'confirmed' THEN 1 END) AS confirmed_items,
  ROUND(
    COUNT(CASE WHEN si.status = 'confirmed' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100, 
    2
  ) AS completion_rate
FROM schedule_items si
JOIN subsidiaries s ON si.subsidiary_id = s.id
JOIN quarters q ON si.quarter_id = q.id
WHERE q.year = 2024 AND q.quarter = 4
GROUP BY s.id, s.name
ORDER BY completion_rate DESC;

