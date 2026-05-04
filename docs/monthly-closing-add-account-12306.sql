-- ============================================
-- Add account 12306 (개발비 / Development costs) to std_bs_master
-- 위치: Non-Current Assets > 무형자산 영역 (12303 Industrial rights ~ 12309 Computer Software 사이)
-- display_order = 154 (12304 다음, 12309 이전)
-- ============================================

INSERT INTO std_bs_master (
  bs_code,
  bs_line,
  bs_category,
  display_order,
  is_calculated,
  account_type,
  is_contra,
  parent_category
) VALUES (
  '12306',
  'Development costs',
  'Non-Current Assets',
  154,
  FALSE,
  'Asset',
  FALSE,
  'Non-Current Assets'
)
ON CONFLICT (bs_code) DO UPDATE SET
  bs_line          = EXCLUDED.bs_line,
  bs_category      = EXCLUDED.bs_category,
  display_order    = EXCLUDED.display_order,
  is_calculated    = EXCLUDED.is_calculated,
  account_type     = EXCLUDED.account_type,
  is_contra        = EXCLUDED.is_contra,
  parent_category  = EXCLUDED.parent_category;

-- ============================================
-- 검증
-- ============================================
SELECT bs_code, bs_line, bs_category, display_order, account_type, is_contra
FROM std_bs_master
WHERE bs_code BETWEEN '12300' AND '12320'
ORDER BY display_order;
