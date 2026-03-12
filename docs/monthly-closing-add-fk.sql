-- ============================================
-- Monthly Closing - Foreign Key 추가
-- pl_results ↔ std_pl_master 관계 설정
-- ============================================
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요.

-- 0. 먼저 pl_results 테이블의 컬럼 확인
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'pl_results' 
ORDER BY ordinal_position;

-- 1. pl_results에 std_pl_code 컬럼이 있는 경우 FK 추가
DO $$
DECLARE
  col_exists BOOLEAN;
BEGIN
  -- std_pl_code 컬럼 존재 확인
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pl_results' AND column_name = 'std_pl_code'
  ) INTO col_exists;

  IF col_exists THEN
    -- FK가 없으면 추가
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_pl_results_std_pl_master' 
      AND table_name = 'pl_results'
    ) THEN
      ALTER TABLE pl_results
      ADD CONSTRAINT fk_pl_results_std_pl_master
      FOREIGN KEY (std_pl_code) REFERENCES std_pl_master(pl_code)
      ON DELETE SET NULL;
      RAISE NOTICE 'FK fk_pl_results_std_pl_master added (using std_pl_code)';
    ELSE
      RAISE NOTICE 'FK fk_pl_results_std_pl_master already exists';
    END IF;
  ELSE
    RAISE NOTICE 'std_pl_code column does not exist in pl_results - checking for std_code';
    
    -- std_code 컬럼 존재 확인
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'pl_results' AND column_name = 'std_code'
    ) INTO col_exists;
    
    IF col_exists THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_pl_results_std_pl_master' 
        AND table_name = 'pl_results'
      ) THEN
        ALTER TABLE pl_results
        ADD CONSTRAINT fk_pl_results_std_pl_master
        FOREIGN KEY (std_code) REFERENCES std_pl_master(pl_code)
        ON DELETE SET NULL;
        RAISE NOTICE 'FK fk_pl_results_std_pl_master added (using std_code)';
      END IF;
    ELSE
      RAISE NOTICE 'Neither std_pl_code nor std_code exists - please check table structure';
    END IF;
  END IF;
END $$;

-- 2. 인덱스 추가 (컬럼이 존재하는 경우에만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pl_results' AND column_name = 'std_pl_code'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_pl_results_std_pl_code ON pl_results(std_pl_code);
    RAISE NOTICE 'Index idx_pl_results_std_pl_code created';
  END IF;
END $$;

-- 3. 확인: FK 관계 조회
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
  AND tc.table_name IN ('pl_results', 'bs_results');
