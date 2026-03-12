-- ============================================
-- Monthly Closing - pl_results 테이블 수정
-- std_pl_code 컬럼 추가 및 FK 설정
-- ============================================
-- Supabase SQL Editor에서 실행하세요.

-- 1. pl_results에 std_pl_code 컬럼 추가
ALTER TABLE pl_results 
ADD COLUMN IF NOT EXISTS std_pl_code VARCHAR(10);

-- 2. std_pl_master FK 추가
ALTER TABLE pl_results
ADD CONSTRAINT fk_pl_results_std_pl_master
FOREIGN KEY (std_pl_code) REFERENCES std_pl_master(pl_code)
ON DELETE SET NULL;

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_pl_results_std_pl_code ON pl_results(std_pl_code);

-- 4. 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'pl_results' 
ORDER BY ordinal_position;

-- 5. FK 확인
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'pl_results';
