-- ============================================
-- financial_data 테이블 스키마 변경
-- ============================================
-- 변경사항:
-- 1. currency 컬럼 추가 (TEXT)
-- 2. target_revenue_krw 컬럼 삭제
-- 3. revenue_FCY 컬럼 추가 (BIGINT)
-- 4. operating_profit_FCY 컬럼 추가 (BIGINT)
-- 5. sga_krw 컬럼 추가 (BIGINT)
-- 6. sga_FCY 컬럼 추가 (BIGINT)
-- ============================================

-- 1. currency 컬럼 추가
ALTER TABLE financial_data
ADD COLUMN currency TEXT;

-- 2. revenue_fcy 컬럼 추가
ALTER TABLE financial_data
ADD COLUMN revenue_fcy BIGINT CHECK (revenue_fcy >= 0);

-- 3. operating_profit_fcy 컬럼 추가
ALTER TABLE financial_data
ADD COLUMN operating_profit_fcy BIGINT;

-- 4. sga_krw 컬럼 추가
ALTER TABLE financial_data
ADD COLUMN sga_krw BIGINT CHECK (sga_krw >= 0);

-- 5. sga_fcy 컬럼 추가
ALTER TABLE financial_data
ADD COLUMN sga_fcy BIGINT CHECK (sga_fcy >= 0);

-- 6. target_revenue_krw 컬럼 삭제
ALTER TABLE financial_data
DROP COLUMN IF EXISTS target_revenue_krw;

-- 코멘트 추가
COMMENT ON COLUMN financial_data.currency IS '통화 코드 (예: USD, EUR, JPY)';
COMMENT ON COLUMN financial_data.revenue_fcy IS '매출액 (외화, 원 단위)';
COMMENT ON COLUMN financial_data.operating_profit_fcy IS '영업이익 (외화, 원 단위)';
COMMENT ON COLUMN financial_data.sga_krw IS 'SG&A 비용 (원화, 원 단위)';
COMMENT ON COLUMN financial_data.sga_fcy IS 'SG&A 비용 (외화, 원 단위)';