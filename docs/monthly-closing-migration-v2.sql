-- ============================================
-- Monthly Closing - Migration Script v2
-- 기존 스키마에서 v2로 업그레이드
-- (std_bs_master 추가, coa_mapping에 statement_type 추가)
-- ============================================

-- 1. std_bs_master 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS std_bs_master (
  bs_code VARCHAR(10) PRIMARY KEY,
  bs_line VARCHAR(100) NOT NULL,
  bs_category VARCHAR(50) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_calculated BOOLEAN DEFAULT FALSE,
  account_type VARCHAR(20) NOT NULL DEFAULT 'Asset',
  is_contra BOOLEAN DEFAULT FALSE,
  parent_category VARCHAR(50)
);

-- 2. bs_results 테이블 생성 (없는 경우)
CREATE TABLE IF NOT EXISTS bs_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES tb_uploads(id) ON DELETE CASCADE,
  entity_code VARCHAR(10) NOT NULL,
  subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  std_bs_code VARCHAR(10) NOT NULL,
  amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'KRW',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. coa_mapping 테이블에 statement_type 컬럼 추가 (없는 경우)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coa_mapping' AND column_name = 'statement_type'
  ) THEN
    ALTER TABLE coa_mapping ADD COLUMN statement_type VARCHAR(5) NOT NULL DEFAULT 'PL';
    RAISE NOTICE 'statement_type 컬럼이 추가되었습니다.';
  ELSE
    RAISE NOTICE 'statement_type 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- 4. coa_mapping 테이블에 std_code 컬럼 추가 (std_pl_code 대신 일반화)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coa_mapping' AND column_name = 'std_code'
  ) THEN
    -- std_pl_code가 있으면 std_code로 복사
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'coa_mapping' AND column_name = 'std_pl_code'
    ) THEN
      ALTER TABLE coa_mapping ADD COLUMN std_code VARCHAR(10);
      UPDATE coa_mapping SET std_code = std_pl_code WHERE std_code IS NULL;
      ALTER TABLE coa_mapping ALTER COLUMN std_code SET NOT NULL;
      RAISE NOTICE 'std_code 컬럼이 추가되고 std_pl_code에서 데이터가 복사되었습니다.';
    ELSE
      ALTER TABLE coa_mapping ADD COLUMN std_code VARCHAR(10) NOT NULL DEFAULT '';
      RAISE NOTICE 'std_code 컬럼이 추가되었습니다.';
    END IF;
  ELSE
    RAISE NOTICE 'std_code 컬럼이 이미 존재합니다.';
  END IF;
END $$;

-- 5. 기존 std_pl_line, std_pl_category 컬럼 제거 (있는 경우)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coa_mapping' AND column_name = 'std_pl_line'
  ) THEN
    ALTER TABLE coa_mapping DROP COLUMN std_pl_line;
    RAISE NOTICE 'std_pl_line 컬럼이 제거되었습니다.';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'coa_mapping' AND column_name = 'std_pl_category'
  ) THEN
    ALTER TABLE coa_mapping DROP COLUMN std_pl_category;
    RAISE NOTICE 'std_pl_category 컬럼이 제거되었습니다.';
  END IF;
END $$;

-- 6. 표준 BS 마스터 데이터 삽입 (PRD 3.2.1.2 기반)
INSERT INTO std_bs_master (bs_code, bs_line, bs_category, display_order, is_calculated, account_type, is_contra, parent_category) VALUES
-- Current Assets
('11101', 'Cash', 'Current Assets', 10, FALSE, 'Asset', FALSE, 'Current Assets'),
('11102', 'Checking Account', 'Current Assets', 11, FALSE, 'Asset', FALSE, 'Current Assets'),
('11103', 'Foreign Currency Deposits', 'Current Assets', 12, FALSE, 'Asset', FALSE, 'Current Assets'),
('11201', 'Accounts Receivable', 'Current Assets', 20, FALSE, 'Asset', FALSE, 'Current Assets'),
('11202', 'Accounts Receivable - Allowance for Bad Debts', 'Current Assets', 21, FALSE, 'Asset', TRUE, 'Current Assets'),
('11203', 'A/R Nontrade', 'Current Assets', 22, FALSE, 'Asset', FALSE, 'Current Assets'),
('11204', 'A/R Nontrade - Allowance for Bad Debts', 'Current Assets', 23, FALSE, 'Asset', TRUE, 'Current Assets'),
('11205', 'Accrued Income', 'Current Assets', 24, FALSE, 'Asset', FALSE, 'Current Assets'),
('11206', 'Accrued Income - Allowance for Bad Debt', 'Current Assets', 25, FALSE, 'Asset', TRUE, 'Current Assets'),
('11301', 'Short-term Financial Instruments', 'Current Assets', 30, FALSE, 'Asset', FALSE, 'Current Assets'),
('11302', 'Short-term Loans', 'Current Assets', 31, FALSE, 'Asset', FALSE, 'Current Assets'),
('11303', 'Allowance for Short-term Loans', 'Current Assets', 32, FALSE, 'Asset', TRUE, 'Current Assets'),
('11304', 'Other Deposits Provided - Current', 'Current Assets', 33, FALSE, 'Asset', FALSE, 'Current Assets'),
('11305', 'Other Deposits Provided - Current - Allowance for Bad Debt', 'Current Assets', 34, FALSE, 'Asset', TRUE, 'Current Assets'),
('11401', 'Advance Payments', 'Current Assets', 40, FALSE, 'Asset', FALSE, 'Current Assets'),
('11402', 'Allowance for Advance Payments', 'Current Assets', 41, FALSE, 'Asset', TRUE, 'Current Assets'),
('11403', 'Prepaid Expense - General', 'Current Assets', 42, FALSE, 'Asset', FALSE, 'Current Assets'),
('11404', 'Advance tax', 'Current Assets', 43, FALSE, 'Asset', FALSE, 'Current Assets'),
('11405', 'SST input', 'Current Assets', 44, FALSE, 'Asset', FALSE, 'Current Assets'),
('11406', 'Prepaid Tax - Corporate Tax - Current', 'Current Assets', 45, FALSE, 'Asset', FALSE, 'Current Assets'),
('11407', 'Current Tax Assets', 'Current Assets', 46, FALSE, 'Asset', FALSE, 'Current Assets'),
('11501', 'Merchandise', 'Current Assets', 50, FALSE, 'Asset', FALSE, 'Current Assets'),
('11502', 'Merchandise - Valuation Allowance', 'Current Assets', 51, FALSE, 'Asset', TRUE, 'Current Assets'),
('11503', 'Finished Goods', 'Current Assets', 52, FALSE, 'Asset', FALSE, 'Current Assets'),
('11504', 'Finished Goods - Valuation Allowance', 'Current Assets', 53, FALSE, 'Asset', TRUE, 'Current Assets'),
('11505', 'Work in Progress', 'Current Assets', 54, FALSE, 'Asset', FALSE, 'Current Assets'),
('11506', 'Work in Progress - Valuation Allowance', 'Current Assets', 55, FALSE, 'Asset', TRUE, 'Current Assets'),
('11509', 'Raw Materials', 'Current Assets', 58, FALSE, 'Asset', FALSE, 'Current Assets'),
('11510', 'Raw Materials - Valuation Allowance', 'Current Assets', 59, FALSE, 'Asset', TRUE, 'Current Assets'),
('11511', 'Materials in Transit', 'Current Assets', 60, FALSE, 'Asset', FALSE, 'Current Assets'),
-- Non-Current Assets
('12101', 'Land', 'Non-Current Assets', 100, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12102', 'Land - State Aid', 'Non-Current Assets', 101, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12103', 'Buildings', 'Non-Current Assets', 102, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12104', 'Buildings - Accumulated Depreciation', 'Non-Current Assets', 103, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12107', 'Structures', 'Non-Current Assets', 106, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12108', 'Structures - Accumulated Depreciation', 'Non-Current Assets', 107, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12111', 'Machinery', 'Non-Current Assets', 110, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12112', 'Machinery - Accumulated Depreciation', 'Non-Current Assets', 111, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12114', 'Equipment - Accumulated Depreciation', 'Non-Current Assets', 113, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12119', 'Vehicles', 'Non-Current Assets', 118, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12120', 'Vehicles - Accumulated Depreciation', 'Non-Current Assets', 119, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12122', 'Fixtures & Furniture', 'Non-Current Assets', 121, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12123', 'Fixtures & Furniture - Accumulated Depreciation', 'Non-Current Assets', 122, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12125', 'Tools - Accumulated Depreciation', 'Non-Current Assets', 124, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12130', 'Construction in Progress', 'Non-Current Assets', 129, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12201', 'Right-of-use Assets', 'Non-Current Assets', 140, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12202', 'Right-of-use Assets - Accumulated Depreciation', 'Non-Current Assets', 141, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12301', 'Goodwill', 'Non-Current Assets', 150, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12303', 'Industrial rights', 'Non-Current Assets', 152, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12304', 'Industrial rights - Accumulated Depreciation', 'Non-Current Assets', 153, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12309', 'Computer Software', 'Non-Current Assets', 158, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12310', 'Computer Software - Accumulated Amortisation', 'Non-Current Assets', 159, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12313', 'Other intangible assets', 'Non-Current Assets', 162, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12317', 'Construction in Progress - Intangle Assets', 'Non-Current Assets', 166, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12401', 'Investment in real properties - Land', 'Non-Current Assets', 170, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12403', 'Investment in real properties - Buildings', 'Non-Current Assets', 172, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12404', 'Investment in real properties - Buildings - Accumulated Depreciation', 'Non-Current Assets', 173, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12501', 'Investment Securities - Subsidiaries', 'Non-Current Assets', 180, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12502', 'Investment Securities - Associates', 'Non-Current Assets', 181, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12601', 'Long-term Loans', 'Non-Current Assets', 190, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12602', 'Long-term Loans - Allowance for bad debt', 'Non-Current Assets', 191, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12603', 'Deposits Provided - Non Current', 'Non-Current Assets', 192, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12604', 'Deposits provided - Non Current - Present value discount', 'Non-Current Assets', 193, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12605', 'Long-term Financial Instruments', 'Non-Current Assets', 194, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12606', 'Long-term Financial Instruments - Present value discount', 'Non-Current Assets', 195, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12607', 'Financial assets at FVOCI', 'Non-Current Assets', 196, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12608', 'Long-term Trade Receivables', 'Non-Current Assets', 197, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12609', 'Long-term Trade Receivables - Allowance for Bad Debt', 'Non-Current Assets', 198, FALSE, 'Asset', TRUE, 'Non-Current Assets'),
('12610', 'Financial assets at FVPL', 'Non-Current Assets', 199, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
('12701', 'Deferred Tax Assets - Noncurrent', 'Non-Current Assets', 200, FALSE, 'Asset', FALSE, 'Non-Current Assets'),
-- Current Liabilities
('21100', 'Accounts Payable', 'Current Liabilities', 300, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21101', 'Accounts Payable - Trade', 'Current Liabilities', 301, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21201', 'A/P Nontrade', 'Current Liabilities', 310, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21202', 'Accrued Expense', 'Current Liabilities', 311, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21203', 'Guarantee Deposits Received', 'Current Liabilities', 312, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21401', 'Advance Received', 'Current Liabilities', 320, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21402', 'Unearned Income', 'Current Liabilities', 321, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21403', 'Withholdings', 'Current Liabilities', 322, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21404', 'SST Output (Service Tax)', 'Current Liabilities', 323, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21406', 'Accrued Expense - Salaries & Wages', 'Current Liabilities', 325, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21407', 'Dividends Payable', 'Current Liabilities', 326, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21409', 'Other Current Liabilities', 'Current Liabilities', 328, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21501', 'Lease Liabilities - Current', 'Current Liabilities', 330, FALSE, 'Liability', FALSE, 'Current Liabilities'),
('21601', 'Accrued Tax Expense', 'Current Liabilities', 340, FALSE, 'Liability', FALSE, 'Current Liabilities'),
-- Non Current Liabilities
('22101', 'Long-term Borrowings', 'Non Current Liabilities', 400, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
('22102', 'Long-term Borrowings - Present Value Discounts', 'Non Current Liabilities', 401, FALSE, 'Liability', TRUE, 'Non Current Liabilities'),
('22103', 'Debentures', 'Non Current Liabilities', 402, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
('22201', 'Accrued Severance & Retirement Benefits', 'Non Current Liabilities', 410, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
('22202', 'Deposits for Severance Benefits', 'Non Current Liabilities', 411, FALSE, 'Liability', TRUE, 'Non Current Liabilities'),
('22203', 'Retirement pension asset', 'Non Current Liabilities', 412, FALSE, 'Liability', TRUE, 'Non Current Liabilities'),
('22301', 'Long-term A/P Nontrade', 'Non Current Liabilities', 420, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
('22302', 'Long-term Advance Payment', 'Non Current Liabilities', 421, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
('22303', 'Long-term Accrued Expense', 'Non Current Liabilities', 422, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
('22304', 'Long-term Unearned Income', 'Non Current Liabilities', 423, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
('22305', 'Reserve for repairs', 'Non Current Liabilities', 424, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
('22306', 'Long Term Accrued Expense - Salaries & Wages', 'Non Current Liabilities', 425, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
('22401', 'Leasehold deposits received', 'Non Current Liabilities', 430, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
('22501', 'Deferred Tax Liabilities - Noncurrent', 'Non Current Liabilities', 440, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
('22601', 'Finance Lease Liabilities - Non Current', 'Non Current Liabilities', 450, FALSE, 'Liability', FALSE, 'Non Current Liabilities'),
-- Shareholders of the Parent Company (Equity)
('31101', 'Capital Stock - Common Stock', 'Shareholders of the Parent Company', 500, FALSE, 'Equity', FALSE, 'Shareholders of the Parent Company'),
('31201', 'Paid-In Capital in Excess of Par', 'Shareholders of the Parent Company', 510, FALSE, 'Equity', FALSE, 'Shareholders of the Parent Company'),
('31202', 'Other Additional Capital', 'Shareholders of the Parent Company', 511, FALSE, 'Equity', FALSE, 'Shareholders of the Parent Company'),
('31308', 'Overseas operations translation credit(debit)', 'Shareholders of the Parent Company', 520, FALSE, 'Equity', FALSE, 'Shareholders of the Parent Company'),
('31403', 'Retained Earnings - Carried Forward', 'Shareholders of the Parent Company', 530, FALSE, 'Equity', FALSE, 'Shareholders of the Parent Company'),
('31505', 'Other Capital Adjustments', 'Shareholders of the Parent Company', 540, FALSE, 'Equity', FALSE, 'Shareholders of the Parent Company')
ON CONFLICT (bs_code) DO NOTHING;

-- 7. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_coa_mapping_statement_type ON coa_mapping(statement_type);
CREATE INDEX IF NOT EXISTS idx_coa_mapping_std_code ON coa_mapping(std_code);
CREATE INDEX IF NOT EXISTS idx_bs_results_upload ON bs_results(upload_id);
CREATE INDEX IF NOT EXISTS idx_bs_results_entity_period ON bs_results(entity_code, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_bs_results_bs_code ON bs_results(std_bs_code);

-- 8. RLS 정책
ALTER TABLE std_bs_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE bs_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for std_bs_master" ON std_bs_master;
DROP POLICY IF EXISTS "Allow all for bs_results" ON bs_results;

CREATE POLICY "Allow all for std_bs_master" ON std_bs_master FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for bs_results" ON bs_results FOR ALL USING (true) WITH CHECK (true);

-- 9. Foreign Key 추가 (Supabase 조인 쿼리 지원)
-- pl_results → std_pl_master FK
DO $$
BEGIN
  -- std_pl_code 컬럼이 존재하는지 확인
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'pl_results' AND column_name = 'std_pl_code'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'fk_pl_results_std_pl_master' 
      AND table_name = 'pl_results'
    ) THEN
      ALTER TABLE pl_results
      ADD CONSTRAINT fk_pl_results_std_pl_master
      FOREIGN KEY (std_pl_code) REFERENCES std_pl_master(pl_code)
      ON DELETE SET NULL;
      RAISE NOTICE 'FK fk_pl_results_std_pl_master added';
    ELSE
      RAISE NOTICE 'FK fk_pl_results_std_pl_master already exists';
    END IF;
  ELSE
    RAISE NOTICE 'std_pl_code column does not exist in pl_results';
  END IF;
END $$;

-- bs_results → std_bs_master FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_bs_results_std_bs_master' 
    AND table_name = 'bs_results'
  ) THEN
    ALTER TABLE bs_results
    ADD CONSTRAINT fk_bs_results_std_bs_master
    FOREIGN KEY (std_bs_code) REFERENCES std_bs_master(bs_code)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 인덱스 추가 (FK 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_pl_results_std_pl_code ON pl_results(std_pl_code);

-- 완료 메시지
SELECT 'Migration v2 completed: BS support + FK relationships added' AS status;
