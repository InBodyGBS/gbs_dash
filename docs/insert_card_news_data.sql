-- ========================================
-- 데이터 삽입 스크립트
-- IFRS 및 Dutch GAAP 카드뉴스 데이터
-- ========================================

-- 1. accounting_standards 테이블 데이터 삽입
INSERT INTO accounting_standards (standard_code, standard_name, country, description) VALUES
('IFRS', 'International Financial Reporting Standards', 'International', '국제회계기준위원회(IASB)가 제정한 국제 회계기준'),
('DUTCH_GAAP', 'Dutch Generally Accepted Accounting Principles', 'Netherlands', '네덜란드 민법 제2편 제9장 및 네덜란드 회계기준위원회(RJ) 기준');

-- ========================================
-- IFRS 카드뉴스 데이터
-- ========================================

-- 2. IFRS 카테고리 삽입
DO $$
DECLARE
  ifrs_id UUID;
BEGIN
  -- IFRS standard_id 가져오기
  SELECT id INTO ifrs_id FROM accounting_standards WHERE standard_code = 'IFRS';
  
  -- 카테고리 삽입
  INSERT INTO card_categories (standard_id, category_name, category_name_en, display_order, icon, color) VALUES
  (ifrs_id, '재무제표 작성 기준', 'Financial Statement Preparation', 1, '📊', '#3B82F6'),
  (ifrs_id, '금융상품', 'Financial Instruments', 2, '💰', '#10B981'),
  (ifrs_id, '재고 및 유형자산', 'Inventory & Fixed Assets', 3, '📦', '#F59E0B'),
  (ifrs_id, '리스 회계', 'Lease Accounting', 4, '🏢', '#8B5CF6'),
  (ifrs_id, '법인세', 'Income Taxes', 5, '💼', '#EF4444'),
  (ifrs_id, '수익인식', 'Revenue Recognition', 6, '📈', '#06B6D4');
END $$;

-- 3. IFRS 카드뉴스 삽입
-- Note: 실제 환경에서는 JSON 데이터를 파싱하여 삽입하거나,
--       Supabase Client SDK를 사용하여 프로그래밍 방식으로 삽입하는 것이 좋습니다.
--       여기서는 샘플 데이터 일부만 SQL로 작성합니다.

-- 예시: 재무제표 작성 기준 > 카드 1
DO $$
DECLARE
  category_id_var UUID;
BEGIN
  SELECT id INTO category_id_var 
  FROM card_categories cc
  JOIN accounting_standards ast ON cc.standard_id = ast.id
  WHERE ast.standard_code = 'IFRS' AND cc.category_name = '재무제표 작성 기준';
  
  INSERT INTO card_news (
    category_id, 
    card_number, 
    title, 
    subtitle, 
    content, 
    key_points, 
    tags, 
    is_important
  ) VALUES (
    category_id_var,
    1,
    'IFRS 적용 기준',
    '국제회계기준 준수',
    'Biospace, Inc.는 미국 소재 회사이지만, US GAAP이 아닌 IFRS에 따라 재무제표를 작성합니다. 이는 한국 본사(InBody Co., Ltd.)의 연결재무제표 작성을 위한 것입니다.',
    '["준거 기준: IFRS (International Accounting Standards Board 발행)", "측정 기준: 역사적 원가 (Historical Cost Basis)", "표시통화: 미국 달러 (USD) - 기능통화", "감사 기준: International Standards on Auditing (ISAs)"]'::jsonb,
    ARRAY['IFRS', '재무제표', '작성기준', '측정기준'],
    true
  );
END $$;

-- ========================================
-- Dutch GAAP 카드뉴스 데이터
-- ========================================

-- 4. Dutch GAAP 카테고리 삽입
DO $$
DECLARE
  dutch_id UUID;
BEGIN
  SELECT id INTO dutch_id FROM accounting_standards WHERE standard_code = 'DUTCH_GAAP';
  
  INSERT INTO card_categories (standard_id, category_name, category_name_en, display_order, icon, color) VALUES
  (dutch_id, '일반 회계원칙', 'General Accounting Principles', 1, '📋', '#FF6B35'),
  (dutch_id, '외화환산', 'Foreign Currency', 2, '💱', '#004E89'),
  (dutch_id, '자산 평가', 'Asset Valuation', 3, '🏦', '#1A659E'),
  (dutch_id, '부채 평가', 'Liability Valuation', 4, '📊', '#F77F00'),
  (dutch_id, '손익 결정', 'Profit & Loss Determination', 5, '💰', '#06A77D'),
  (dutch_id, '연결 및 특수사항', 'Consolidation & Special Items', 6, '🔗', '#D62828');
END $$;

-- ========================================
-- 권장: Supabase Client SDK 사용
-- ========================================

/*
위 SQL은 데이터베이스 스키마 및 기본 데이터만 삽입합니다.
전체 카드뉴스 데이터는 다음 방법으로 삽입하는 것이 권장됩니다:

1. Supabase JavaScript Client 사용:
```javascript
import { createClient } from '@supabase/supabase-js'
import ifrsData from './ifrs_card_news_data.json'
import dutchData from './dutch_gaap_card_news_data.json'

const supabase = createClient(supabaseUrl, supabaseKey)

async function insertCardNews() {
  // 1. Standards 삽입
  const { data: standardData } = await supabase
    .from('accounting_standards')
    .insert([ifrsData.standard, dutchData.standard])
    .select()
  
  // 2. Categories 삽입
  for (const category of ifrsData.categories) {
    await supabase.from('card_categories').insert({
      standard_id: standardData[0].id,
      ...category
    })
  }
  
  // 3. Cards 삽입
  for (const card of ifrsData.cards) {
    const { data: categoryData } = await supabase
      .from('card_categories')
      .select('id')
      .eq('category_name', card.category)
      .single()
    
    await supabase.from('card_news').insert({
      category_id: categoryData.id,
      ...card
    })
  }
}
```

2. Python 스크립트 사용:
```python
from supabase import create_client
import json

supabase = create_client(supabase_url, supabase_key)

with open('ifrs_card_news_data.json') as f:
    ifrs_data = json.load(f)

# Standards 삽입
standard = supabase.table('accounting_standards').insert(ifrs_data['standard']).execute()

# Categories 삽입
for category in ifrs_data['categories']:
    category['standard_id'] = standard.data[0]['id']
    supabase.table('card_categories').insert(category).execute()

# Cards 삽입 (category_id 매칭 필요)
# ...
```

3. Supabase Studio UI 사용:
   - Table Editor에서 직접 행 추가
   - JSON 파일을 CSV로 변환 후 Import
*/

-- ========================================
-- 데이터 확인 쿼리
-- ========================================

-- 전체 카드뉴스 조회 (뷰 사용)
SELECT * FROM card_news_full ORDER BY standard_code, category_name, card_number;

-- IFRS 카드만 조회
SELECT * FROM card_news_full WHERE standard_code = 'IFRS';

-- Dutch GAAP 카드만 조회
SELECT * FROM card_news_full WHERE standard_code = 'DUTCH_GAAP';

-- 중요 카드만 조회
SELECT * FROM card_news_full WHERE is_important = true;

-- 특정 태그 검색
SELECT * FROM card_news_full WHERE 'IFRS16' = ANY(tags);
