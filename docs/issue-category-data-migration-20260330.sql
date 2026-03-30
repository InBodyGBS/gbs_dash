-- ============================================
-- Issue category data migration (legacy -> active)
-- Run this BEFORE tightening the CHECK constraint.
-- ============================================

-- 1) Normalize known legacy categories into the new active set
UPDATE issues
SET category = 'Audit/Tax'
WHERE category IN ('Tax', 'Audit');

UPDATE issues
SET category = 'Fixed Asset /Lease'
WHERE category IN ('Lease');

UPDATE issues
SET category = 'PKG/FS'
WHERE category IN ('PKG', 'FS');

UPDATE issues
SET category = 'Inventory/Demo'
WHERE category IN ('Inventory', 'Demo');

-- 2) Anything not in the active set goes to Others (failsafe)
UPDATE issues
SET category = 'Others'
WHERE category NOT IN (
  'Audit/Tax',
  'System',
  'Sales',
  'Fixed Asset /Lease',
  'Accrual',
  'Allowance',
  'Inventory/Demo',
  'Others',
  'PKG/FS'
);

-- 3) (Optional) Verify counts by category after migration
-- SELECT category, COUNT(*) FROM issues GROUP BY category ORDER BY category;

