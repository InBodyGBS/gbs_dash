-- ============================================
-- Monthly Closing - Database Schema v2
-- Trial Balance → P&L / BS 전환 시스템
-- PRD v1.1 기반 (P&L Code + BS Code 구조)
-- ============================================

-- 1. TB 업로드 기록
CREATE TABLE IF NOT EXISTS tb_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_code VARCHAR(10) NOT NULL,
  subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  uploaded_by VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'mapped', 'partial', 'error'
  unmapped_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(entity_code, period_year, period_month)
);

-- 2. TB 원장 데이터 (업로드된 원본)
CREATE TABLE IF NOT EXISTS tb_raw_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES tb_uploads(id) ON DELETE CASCADE,
  account_code VARCHAR(50) NOT NULL,
  account_name VARCHAR(200) NOT NULL,
  debit DECIMAL(18,2) NOT NULL DEFAULT 0,
  credit DECIMAL(18,2) NOT NULL DEFAULT 0,
  balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 표준 P&L 마스터 (Reference table)
CREATE TABLE IF NOT EXISTS std_pl_master (
  pl_code VARCHAR(10) PRIMARY KEY,
  pl_line VARCHAR(100) NOT NULL,
  pl_category VARCHAR(50) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_calculated BOOLEAN DEFAULT FALSE, -- TRUE for Gross Profit, Operating Income, etc.
  parent_category VARCHAR(50) -- For grouping (Sales, COGS, SG&A, etc.)
);

-- 4. 표준 BS 마스터 (Reference table) - PRD 3.2.1.2 기반
CREATE TABLE IF NOT EXISTS std_bs_master (
  bs_code VARCHAR(10) PRIMARY KEY,
  bs_line VARCHAR(100) NOT NULL,
  bs_category VARCHAR(50) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_calculated BOOLEAN DEFAULT FALSE, -- TRUE for subtotals
  account_type VARCHAR(20) NOT NULL, -- 'Asset', 'Liability', 'Equity'
  is_contra BOOLEAN DEFAULT FALSE, -- TRUE for allowances, accumulated depreciation
  parent_category VARCHAR(50) -- For grouping
);

-- 5. COA 매핑 테이블 (계정과목 → P&L Code 또는 BS Code 매핑)
-- 기존 coa_mapping 테이블 변경
-- statement_type 추가, std_code 일반화
CREATE TABLE IF NOT EXISTS coa_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_code VARCHAR(10) NOT NULL,
  local_account_code VARCHAR(50) NOT NULL,
  local_account_name VARCHAR(200),
  statement_type VARCHAR(5) NOT NULL DEFAULT 'PL', -- 'PL' or 'BS'
  std_code VARCHAR(10) NOT NULL, -- P&L Code or BS Code
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(100),
  UNIQUE(entity_code, local_account_code)
);

-- 6. P&L 결과 (매핑 후 생성된 손익계산서)
CREATE TABLE IF NOT EXISTS pl_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES tb_uploads(id) ON DELETE CASCADE,
  entity_code VARCHAR(10) NOT NULL,
  subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  std_pl_code VARCHAR(10) NOT NULL REFERENCES std_pl_master(pl_code),
  amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'KRW',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. BS 결과 (매핑 후 생성된 재무상태표)
CREATE TABLE IF NOT EXISTS bs_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES tb_uploads(id) ON DELETE CASCADE,
  entity_code VARCHAR(10) NOT NULL,
  subsidiary_id UUID REFERENCES subsidiaries(id) ON DELETE SET NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  std_bs_code VARCHAR(10) NOT NULL REFERENCES std_bs_master(bs_code),
  amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'KRW',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 환율 테이블
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate_date DATE NOT NULL,
  rate DECIMAL(10,6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, rate_date)
);

-- ============================================
-- 표준 P&L 마스터 데이터 삽입
-- ============================================
INSERT INTO std_pl_master (pl_code, pl_line, pl_category, display_order, is_calculated, parent_category) VALUES
-- Sales
('41000', 'Sales - Finished Goods', 'Sales', 10, FALSE, 'Sales'),
('42000', 'Sales - Finished Goods - Related party', 'Sales', 10, FALSE, 'Sales'),
('43000', 'Sales - Merchandise', 'Sales', 10, FALSE, 'Sales'),
('44000', 'Sales - Merchandise - Related party', 'Sales', 10, FALSE, 'Sales'),
('45000', 'Sales - Services', 'Sales', 20, FALSE, 'Sales'),
('46000', 'Sales - Others', 'Sales', 30, FALSE, 'Sales'),
-- Cost of Goods Sold
('51000', 'Cost of Goods Sold - Finished Goods', 'Cost of Goods Sold', 40, FALSE, 'Cost of Goods Sold'),
('52000', 'COGS - Merchandise', 'Cost of Goods Sold', 40, FALSE, 'Cost of Goods Sold'),
('53000', 'COGS - Services', 'Cost of Goods Sold', 50, FALSE, 'Cost of Goods Sold'),
('54000', 'COGS - Others', 'Cost of Goods Sold', 60, FALSE, 'Cost of Goods Sold'),
-- Selling and Administration Expense
('60001', 'Executive Compensations', 'Selling and Administration Expense', 80, FALSE, 'Selling and Administration Expense'),
('60002', 'Salaries & Wages', 'Selling and Administration Expense', 81, FALSE, 'Selling and Administration Expense'),
('60003', 'Miscellaneous Benefits', 'Selling and Administration Expense', 82, FALSE, 'Selling and Administration Expense'),
('60004', 'Sundry allowances', 'Selling and Administration Expense', 83, FALSE, 'Selling and Administration Expense'),
('60005', 'Bonus', 'Selling and Administration Expense', 84, FALSE, 'Selling and Administration Expense'),
('60006', 'Retirement Benefits', 'Selling and Administration Expense', 85, FALSE, 'Selling and Administration Expense'),
('60007', 'Welfare Expense', 'Selling and Administration Expense', 86, FALSE, 'Selling and Administration Expense'),
('60008', 'Travel Expense', 'Selling and Administration Expense', 87, FALSE, 'Selling and Administration Expense'),
('60009', 'Telecom Expense', 'Selling and Administration Expense', 88, FALSE, 'Selling and Administration Expense'),
('60010', 'Utilities Expense', 'Selling and Administration Expense', 89, FALSE, 'Selling and Administration Expense'),
('60011', 'Taxes and Dues', 'Selling and Administration Expense', 90, FALSE, 'Selling and Administration Expense'),
('60012', 'Rent & Lease Expense', 'Selling and Administration Expense', 91, FALSE, 'Selling and Administration Expense'),
('60013', 'Insurance Expense', 'Selling and Administration Expense', 92, FALSE, 'Selling and Administration Expense'),
('60014', 'Reception Expense', 'Selling and Administration Expense', 93, FALSE, 'Selling and Administration Expense'),
('60015', 'Advertising Expense', 'Selling and Administration Expense', 94, FALSE, 'Selling and Administration Expense'),
('60016', 'Vehicles Repairs & Maintenance', 'Selling and Administration Expense', 95, FALSE, 'Selling and Administration Expense'),
('60017', 'Transportation Expense', 'Selling and Administration Expense', 96, FALSE, 'Selling and Administration Expense'),
('60018', 'Commission & Service Charges', 'Selling and Administration Expense', 97, FALSE, 'Selling and Administration Expense'),
('60019', 'Ordinary Research & Development Expense', 'Selling and Administration Expense', 98, FALSE, 'Selling and Administration Expense'),
('60020', 'Consumable Expense', 'Selling and Administration Expense', 99, FALSE, 'Selling and Administration Expense'),
('60021', 'Depreciation Expense', 'Selling and Administration Expense', 100, FALSE, 'Selling and Administration Expense'),
('60022', 'Bad Debt Expense', 'Selling and Administration Expense', 101, FALSE, 'Selling and Administration Expense'),
('60023', 'Electricity Expense', 'Selling and Administration Expense', 102, FALSE, 'Selling and Administration Expense'),
('60024', 'Publishing & Book Expense', 'Selling and Administration Expense', 103, FALSE, 'Selling and Administration Expense'),
('60025', 'Education & Training Expense', 'Selling and Administration Expense', 104, FALSE, 'Selling and Administration Expense'),
('60026', 'Repairs Expenses', 'Selling and Administration Expense', 105, FALSE, 'Selling and Administration Expense'),
('60027', 'Sales Commission', 'Selling and Administration Expense', 106, FALSE, 'Selling and Administration Expense'),
('60028', 'Conference expenses', 'Selling and Administration Expense', 107, FALSE, 'Selling and Administration Expense'),
('60029', 'Amortization Expense', 'Selling and Administration Expense', 108, FALSE, 'Selling and Administration Expense'),
('60030', 'Sales guarantee fee', 'Selling and Administration Expense', 109, FALSE, 'Selling and Administration Expense'),
('60031', 'Membership Dues', 'Selling and Administration Expense', 110, FALSE, 'Selling and Administration Expense'),
('60032', 'Miscellaneous Expenses', 'Selling and Administration Expense', 111, FALSE, 'Selling and Administration Expense'),
('60033', 'Depreciation Expense of Right-of-use Assets', 'Selling and Administration Expense', 112, FALSE, 'Selling and Administration Expense'),
('60034', 'Executive Bonus', 'Selling and Administration Expense', 113, FALSE, 'Selling and Administration Expense'),
-- Other Revenue
('71001', 'Foreign Exchange Gain', 'Other Revenue', 180, FALSE, 'Other Revenue'),
('71002', 'Foreign Exchange Gain - Unrealized', 'Other Revenue', 181, FALSE, 'Other Revenue'),
('71003', 'Reverse of Other Bad Debt Allowance', 'Other Revenue', 182, FALSE, 'Other Revenue'),
('71004', 'Gain on Disposal of Waste', 'Other Revenue', 183, FALSE, 'Other Revenue'),
('71005', 'Gain on Disposal of Tangible Assets', 'Other Revenue', 184, FALSE, 'Other Revenue'),
('71006', 'Gain on Disposal of Intangible Assets', 'Other Revenue', 185, FALSE, 'Other Revenue'),
('71007', 'Dividends income', 'Other Revenue', 186, FALSE, 'Other Revenue'),
('71008', 'Miscellaneous Income', 'Other Revenue', 187, FALSE, 'Other Revenue'),
('71009', 'Gains on disposition of Investment Securities - Subsidiaries', 'Other Revenue', 188, FALSE, 'Other Revenue'),
-- Other Expense
('72001', 'Foreign Exchange Loss', 'Other Expense', 200, FALSE, 'Other Expense'),
('72002', 'Foreign Exchange Loss - Unrealized', 'Other Expense', 201, FALSE, 'Other Expense'),
('72003', 'Other Bad Debt Expense', 'Other Expense', 202, FALSE, 'Other Expense'),
('72004', 'Loss on Disposal of A/R - Trade', 'Other Expense', 203, FALSE, 'Other Expense'),
('72005', 'Loss from Valuation of Inventory', 'Other Expense', 204, FALSE, 'Other Expense'),
('72006', 'Loss on Disposal of Tangible Assets', 'Other Expense', 205, FALSE, 'Other Expense'),
('72007', 'Loss on Disposal of Intangible Assets', 'Other Expense', 206, FALSE, 'Other Expense'),
('72008', 'Impairment loss on Tangible Assets', 'Other Expense', 207, FALSE, 'Other Expense'),
('72009', 'Impairment loss on Intangle Assets', 'Other Expense', 208, FALSE, 'Other Expense'),
('72010', 'Loss on Disposal of Investment stock', 'Other Expense', 209, FALSE, 'Other Expense'),
('72011', 'Donations', 'Other Expense', 210, FALSE, 'Other Expense'),
('72012', 'Impaired Loss on Investment Securities - Subsidiaries', 'Other Expense', 211, FALSE, 'Other Expense'),
('72013', 'Miscellaneous Expense', 'Other Expense', 212, FALSE, 'Other Expense'),
-- Financial Revenue
('73001', 'Interest Income', 'Financial Revenue', 220, FALSE, 'Financial Revenue'),
('73002', 'Foreign Exchange Gain', 'Financial Revenue', 221, FALSE, 'Financial Revenue'),
('73003', 'Foreign Exchange Gain - Unrealized', 'Financial Revenue', 222, FALSE, 'Financial Revenue'),
('73004', 'Dividend Income', 'Financial Revenue', 223, FALSE, 'Financial Revenue'),
('73005', 'Gain on Valuation by FVPL', 'Financial Revenue', 224, FALSE, 'Financial Revenue'),
-- Financial Expense
('74001', 'Interest Expense', 'Financial Expense', 240, FALSE, 'Financial Expense'),
('74002', 'Foreign Exchange Loss', 'Financial Expense', 241, FALSE, 'Financial Expense'),
('74003', 'Foreign Exchange Loss - Unrealized', 'Financial Expense', 242, FALSE, 'Financial Expense'),
('74004', 'Loss on Valuation by FVPL', 'Financial Expense', 243, FALSE, 'Financial Expense'),
-- Corporate Income Tax
('80001', 'Corporate Income Tax Expense', 'Corporate Income Tax', 260, FALSE, 'Corporate Income Tax')
ON CONFLICT (pl_code) DO NOTHING;

-- ============================================
-- 표준 BS 마스터 데이터 삽입 (PRD 3.2.1.2 기반)
-- ============================================
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
('21301', 'Short-term Borrowings', 'Current Liabilities', 313, FALSE, 'Liability', FALSE, 'Current Liabilities'),
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

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tb_uploads_entity ON tb_uploads(entity_code);
CREATE INDEX IF NOT EXISTS idx_tb_uploads_period ON tb_uploads(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_tb_uploads_status ON tb_uploads(status);
CREATE INDEX IF NOT EXISTS idx_tb_raw_data_upload ON tb_raw_data(upload_id);
CREATE INDEX IF NOT EXISTS idx_tb_raw_data_account ON tb_raw_data(account_code);
CREATE INDEX IF NOT EXISTS idx_coa_mapping_entity ON coa_mapping(entity_code);
CREATE INDEX IF NOT EXISTS idx_coa_mapping_account ON coa_mapping(entity_code, local_account_code);
CREATE INDEX IF NOT EXISTS idx_coa_mapping_statement_type ON coa_mapping(statement_type);
CREATE INDEX IF NOT EXISTS idx_coa_mapping_std_code ON coa_mapping(std_code);
CREATE INDEX IF NOT EXISTS idx_pl_results_upload ON pl_results(upload_id);
CREATE INDEX IF NOT EXISTS idx_pl_results_entity_period ON pl_results(entity_code, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_pl_results_pl_code ON pl_results(std_pl_code);
CREATE INDEX IF NOT EXISTS idx_bs_results_upload ON bs_results(upload_id);
CREATE INDEX IF NOT EXISTS idx_bs_results_entity_period ON bs_results(entity_code, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_bs_results_bs_code ON bs_results(std_bs_code);

-- ============================================
-- RLS 정책
-- ============================================
ALTER TABLE tb_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tb_raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE coa_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE pl_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE bs_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE std_pl_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE std_bs_master ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있는 경우)
DROP POLICY IF EXISTS "Allow all for tb_uploads" ON tb_uploads;
DROP POLICY IF EXISTS "Allow all for tb_raw_data" ON tb_raw_data;
DROP POLICY IF EXISTS "Allow all for coa_mapping" ON coa_mapping;
DROP POLICY IF EXISTS "Allow all for pl_results" ON pl_results;
DROP POLICY IF EXISTS "Allow all for bs_results" ON bs_results;
DROP POLICY IF EXISTS "Allow all for exchange_rates" ON exchange_rates;
DROP POLICY IF EXISTS "Allow all for std_pl_master" ON std_pl_master;
DROP POLICY IF EXISTS "Allow all for std_bs_master" ON std_bs_master;

-- 정책 생성
CREATE POLICY "Allow all for tb_uploads" ON tb_uploads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for tb_raw_data" ON tb_raw_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for coa_mapping" ON coa_mapping FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for pl_results" ON pl_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for bs_results" ON bs_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for exchange_rates" ON exchange_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for std_pl_master" ON std_pl_master FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for std_bs_master" ON std_bs_master FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 코멘트
-- ============================================
COMMENT ON TABLE tb_uploads IS 'Trial Balance 업로드 기록';
COMMENT ON TABLE tb_raw_data IS 'TB 원장 데이터 (업로드된 원본)';
COMMENT ON TABLE std_pl_master IS '표준 P&L 마스터 (P&L Code 참조 테이블)';
COMMENT ON TABLE std_bs_master IS '표준 BS 마스터 (BS Code 참조 테이블)';
COMMENT ON TABLE coa_mapping IS 'COA 매핑 테이블 (로컬 계정 → 표준 P&L/BS Code)';
COMMENT ON TABLE pl_results IS 'P&L 결과 (매핑 후 생성된 손익계산서, P&L Code 기반)';
COMMENT ON TABLE bs_results IS 'BS 결과 (매핑 후 생성된 재무상태표, BS Code 기반)';
COMMENT ON TABLE exchange_rates IS '환율 데이터';
