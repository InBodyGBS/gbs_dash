-- ============================================
-- submissions 테이블 category CHECK 제약 업데이트
-- 신규 카테고리 (general-ledger, sales-sbp, pkg-fs, trial-balance) 추가
-- Supabase SQL Editor에서 실행하세요.
-- ============================================

-- 기존 제약 삭제
ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS submissions_category_check;

-- 현재 코드의 모든 카테고리를 포함한 제약으로 교체
ALTER TABLE submissions
  ADD CONSTRAINT submissions_category_check
  CHECK (category IN (
    -- 분기말(3·6·9·12월) 카테고리
    'employee-jd',
    'preliminary-sales',
    'sales-sbp',
    'lease-detail',
    'ar-detail',
    'inventory-detail',
    'demo-detail',
    'general-ledger',
    'interco-transaction',
    'pkg-fs',
    -- 일반 월 카테고리
    'trial-balance',
    'sales-detail',
    -- 레거시 (기존 데이터 호환)
    'sga-detail',
    'pkg'
  ));
