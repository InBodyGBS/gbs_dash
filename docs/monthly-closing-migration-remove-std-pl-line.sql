-- ============================================
-- Monthly Closing - Migration Script
-- coa_mapping 테이블에서 std_pl_line 컬럼 제거
-- ============================================
-- 이전 버전에서 std_pl_line 컬럼이 있었지만, 
-- P&L Code 기반 구조로 변경되면서 std_pl_code만 사용하게 되었습니다.

-- 1. std_pl_line 컬럼이 존재하는지 확인하고 제거
DO $$ 
BEGIN
  -- std_pl_line 컬럼이 존재하면 제거
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coa_mapping' AND column_name = 'std_pl_line'
  ) THEN
    -- NOT NULL 제약조건이 있을 수 있으므로 먼저 제약조건 제거
    ALTER TABLE coa_mapping DROP COLUMN IF EXISTS std_pl_line;
    RAISE NOTICE 'std_pl_line 컬럼이 제거되었습니다.';
  ELSE
    RAISE NOTICE 'std_pl_line 컬럼이 존재하지 않습니다.';
  END IF;
END $$;

-- 2. std_pl_category 컬럼도 제거 (있다면)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coa_mapping' AND column_name = 'std_pl_category'
  ) THEN
    ALTER TABLE coa_mapping DROP COLUMN IF EXISTS std_pl_category;
    RAISE NOTICE 'std_pl_category 컬럼이 제거되었습니다.';
  ELSE
    RAISE NOTICE 'std_pl_category 컬럼이 존재하지 않습니다.';
  END IF;
END $$;

-- 3. pl_results 테이블에서도 동일하게 확인 및 제거
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pl_results' AND column_name = 'std_pl_line'
  ) THEN
    ALTER TABLE pl_results DROP COLUMN IF EXISTS std_pl_line;
    RAISE NOTICE 'pl_results.std_pl_line 컬럼이 제거되었습니다.';
  ELSE
    RAISE NOTICE 'pl_results.std_pl_line 컬럼이 존재하지 않습니다.';
  END IF;
END $$;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pl_results' AND column_name = 'std_pl_category'
  ) THEN
    ALTER TABLE pl_results DROP COLUMN IF EXISTS std_pl_category;
    RAISE NOTICE 'pl_results.std_pl_category 컬럼이 제거되었습니다.';
  ELSE
    RAISE NOTICE 'pl_results.std_pl_category 컬럼이 존재하지 않습니다.';
  END IF;
END $$;

-- 완료 메시지
SELECT 'Migration completed: Old std_pl_line and std_pl_category columns removed (if they existed)' AS status;
