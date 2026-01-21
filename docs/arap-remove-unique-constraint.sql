-- ARAP 제출 로그 누적을 위한 제약 조건 제거
-- 같은 entity_id, fiscal_year, fiscal_month에 여러 제출이 가능하도록 수정

-- 1. 기존 제약 조건 제거
ALTER TABLE arap_submissions 
  DROP CONSTRAINT IF EXISTS unique_arap_submission;

-- 2. 인덱스는 유지 (성능을 위해)
-- idx_arap_submissions_entity_date 인덱스는 이미 존재하므로 그대로 사용

-- 3. 코멘트 업데이트
COMMENT ON TABLE arap_submissions IS 'Intercompany AR-AP 제출 정보 (여러 제출 가능)';
