-- ============================================
-- Issue category constraint transition (legacy + active allowed)
-- Use this when you already have the old constraint and need to:
-- 1) allow new categories immediately (stop 400s on insert/update)
-- 2) then run data migration
-- 3) then tighten to active-only constraint
-- ============================================

ALTER TABLE issues
  DROP CONSTRAINT IF EXISTS valid_category;

ALTER TABLE issues
  ADD CONSTRAINT valid_category CHECK (
    category IN (
      -- Legacy
      'Tax', 'Lease', 'Closing', 'System', 'Audit',
      'Depreciation', 'Labor SG&A', 'Accrual', 'PKG',
      'Inventory', 'Bad debt', 'Allowance', 'FS', 'Demo', 'Others',

      -- Active (new)
      'Audit/Tax',
      'Sales',
      'Fixed Asset /Lease',
      'Inventory/Demo',
      'PKG/FS'
    )
  );

