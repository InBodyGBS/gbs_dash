-- ============================================
-- Work Manual 테이블에 file_type 컬럼 추가
-- ============================================

-- file_type 컬럼 추가
ALTER TABLE work_manuals 
ADD COLUMN IF NOT EXISTS file_type TEXT CHECK (file_type IN ('업무기술서', '업무분장표'));

-- 코멘트 추가
COMMENT ON COLUMN work_manuals.file_type IS '파일 유형 (업무기술서 또는 업무분장표)';

-- 인덱스 생성 (필요시)
CREATE INDEX IF NOT EXISTS idx_work_manuals_file_type ON work_manuals(file_type);
