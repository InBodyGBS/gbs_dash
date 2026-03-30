-- ============================================
-- Issue category constraint migration
-- - Updates `issues.valid_category` CHECK constraint
-- - Allows the new active categories only
--
-- ⚠️ Before running:
-- Recommended order:
-- 1) Run `issue-category-constraint-transition-20260330.sql` (allow legacy + active)
-- 2) Run `issue-category-data-migration-20260330.sql` (convert legacy -> active)
-- 3) Run this file (tighten constraint to active-only)
-- ============================================

ALTER TABLE issues
  DROP CONSTRAINT IF EXISTS valid_category;

ALTER TABLE issues
  ADD CONSTRAINT valid_category CHECK (
    category IN (
      'Audit/Tax',
      'System',
      'Sales',
      'Fixed Asset /Lease',
      'Accrual',
      'Allowance',
      'Inventory/Demo',
      'Others',
      'PKG/FS'
    )
  );

