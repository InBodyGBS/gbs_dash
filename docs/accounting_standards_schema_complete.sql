-- ========================================
-- Accounting Standards Card News Schema
-- 완전한 스키마 생성 스크립트 (삭제 + 생성)
-- ========================================
-- 이 스크립트는 기존 테이블을 삭제하고 새로 생성합니다.
-- 주의: 모든 기존 데이터가 삭제됩니다!
-- ========================================

-- ========================================
-- 1단계: 기존 객체 삭제
-- ========================================

-- 뷰 삭제
DROP VIEW IF EXISTS card_news_full CASCADE;

-- 테이블 삭제 (CASCADE로 트리거, 인덱스, 정책도 함께 삭제됨)
-- 참조 무결성 순서대로 삭제
DROP TABLE IF EXISTS practical_tips CASCADE;
DROP TABLE IF EXISTS card_references CASCADE;
DROP TABLE IF EXISTS card_news CASCADE;
DROP TABLE IF EXISTS card_categories CASCADE;
DROP TABLE IF EXISTS accounting_standards CASCADE;

-- 함수 삭제 (테이블 삭제 후)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 정책 삭제 (테이블이 삭제되면 자동 삭제되지만 명시적으로)
-- (테이블이 없으면 오류가 발생하므로 주석 처리)

-- 인덱스 삭제 (테이블이 삭제되면 자동 삭제되지만 명시적으로)
-- (테이블이 없으면 오류가 발생하므로 주석 처리)

-- ========================================
-- 2단계: 테이블 생성
-- ========================================

-- 1. 회계기준 카테고리 테이블
CREATE TABLE accounting_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code TEXT NOT NULL UNIQUE,
  standard_name TEXT NOT NULL,
  country TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 카드뉴스 카테고리 테이블
CREATE TABLE card_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID NOT NULL REFERENCES accounting_standards(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL,
  category_name_en TEXT,
  display_order INTEGER NOT NULL,
  icon TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 카드뉴스 메인 테이블
CREATE TABLE card_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES card_categories(id) ON DELETE CASCADE,
  card_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  title_en TEXT,
  subtitle TEXT,
  content TEXT NOT NULL,
  content_en TEXT,
  key_points JSONB,
  examples JSONB,
  visual_data JSONB,
  tags TEXT[],
  is_important BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 관련 법령/참고자료 테이블
CREATE TABLE card_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES card_news(id) ON DELETE CASCADE,
  reference_type TEXT NOT NULL,
  reference_name TEXT NOT NULL,
  reference_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 실무 팁 테이블
CREATE TABLE practical_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES card_news(id) ON DELETE CASCADE,
  tip_content TEXT NOT NULL,
  tip_type TEXT,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 3단계: 인덱스 생성
-- ========================================

CREATE INDEX idx_card_categories_standard ON card_categories(standard_id);
CREATE INDEX idx_card_news_category ON card_news(category_id);
CREATE INDEX idx_card_news_important ON card_news(is_important);
CREATE INDEX idx_card_news_tags ON card_news USING GIN(tags);
CREATE INDEX idx_card_references_card ON card_references(card_id);
CREATE INDEX idx_practical_tips_card ON practical_tips(card_id);

-- ========================================
-- 4단계: RLS (Row Level Security) 정책
-- ========================================

-- 모든 사용자 조회 가능
ALTER TABLE accounting_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_tips ENABLE ROW LEVEL SECURITY;

-- 읽기 권한
CREATE POLICY "Allow public read access on accounting_standards"
ON accounting_standards FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public read access on card_categories"
ON card_categories FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public read access on card_news"
ON card_news FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public read access on card_references"
ON card_references FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow public read access on practical_tips"
ON practical_tips FOR SELECT
TO public
USING (true);

-- 인증된 사용자만 쓰기 가능 (관리자용)
CREATE POLICY "Allow authenticated insert on card_news"
ON card_news FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated update on card_news"
ON card_news FOR UPDATE
TO authenticated
USING (true);

-- ========================================
-- 5단계: 트리거: updated_at 자동 업데이트
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accounting_standards_updated_at
  BEFORE UPDATE ON accounting_standards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_card_news_updated_at
  BEFORE UPDATE ON card_news
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 6단계: 뷰: 카드뉴스 전체 정보 조회
-- ========================================

CREATE VIEW card_news_full AS
SELECT 
  cn.id,
  cn.card_number,
  cn.title,
  cn.title_en,
  cn.subtitle,
  cn.content,
  cn.content_en,
  cn.key_points,
  cn.examples,
  cn.visual_data,
  cn.tags,
  cn.is_important,
  cc.category_name,
  cc.category_name_en,
  cc.icon as category_icon,
  cc.color as category_color,
  ast.standard_code,
  ast.standard_name,
  ast.country,
  cn.created_at,
  cn.updated_at
FROM card_news cn
JOIN card_categories cc ON cn.category_id = cc.id
JOIN accounting_standards ast ON cc.standard_id = ast.id
ORDER BY ast.standard_code, cc.display_order, cn.card_number;

-- ========================================
-- 완료 확인
-- ========================================
-- 다음 쿼리로 확인:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('accounting_standards', 'card_categories', 'card_news', 'card_references', 'practical_tips');
