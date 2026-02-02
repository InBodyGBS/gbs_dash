-- ============================================
-- Financial Result Entity → Subsidiaries 매핑 마이그레이션
-- ============================================

-- 1. financial_result_data 테이블에 subsidiary_id 컬럼 추가
ALTER TABLE financial_result_data
ADD COLUMN IF NOT EXISTS subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL;

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_financial_result_data_subsidiary ON financial_result_data(subsidiary_id);

-- 3. Entity → Subsidiary 매핑 업데이트
-- Entity 이름을 subsidiaries.code 또는 name과 매칭하여 subsidiary_id 업데이트
UPDATE financial_result_data frd
SET subsidiary_id = s.id
FROM subsidiaries s
WHERE 
  frd.subsidiary_id IS NULL
  AND (
    -- Entity가 code와 일치하는 경우
    (frd.entity = s.code)
    OR
    -- Entity가 name과 일치하는 경우
    (frd.entity = s.name)
    OR
    -- 특수 매핑 (Entity 이름 → Subsidiary code)
    (
      (frd.entity = 'USA' AND s.code = 'USA')
      OR (frd.entity = 'Japan' AND s.code = 'JPN')
      OR (frd.entity = 'China' AND s.code = 'CHN')
      OR (frd.entity = 'Europe' AND s.code = 'EUR')
      OR (frd.entity = 'Asia' AND s.code = 'ASIA')
      OR (frd.entity = 'India' AND s.code = 'IND')
      OR (frd.entity = 'Mexico' AND s.code = 'MEX')
      OR (frd.entity = 'Oceania' AND s.code = 'OCE')
      OR (frd.entity = 'BWA' AND s.code = 'BWA')
      OR (frd.entity = 'Vietnam' AND s.code = 'VNM')
      OR (frd.entity = 'Turkey' AND s.code = 'TUR')
    )
  );

-- 4. 코멘트 추가
COMMENT ON COLUMN financial_result_data.subsidiary_id IS '법인 ID (subsidiaries 테이블 참조, nullable - 연결조정 등은 NULL)';
COMMENT ON COLUMN financial_result_data.entity IS 'Entity 이름 (참조용, subsidiary_id와 매핑)';

-- 5. 기존 인덱스 업데이트 (entity와 subsidiary_id 모두 포함)
CREATE INDEX IF NOT EXISTS idx_financial_result_data_entity_subsidiary ON financial_result_data(entity, subsidiary_id);
CREATE INDEX IF NOT EXISTS idx_financial_result_data_subsidiary_period ON financial_result_data(subsidiary_id, period);
