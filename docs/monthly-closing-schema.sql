-- ============================================
-- Monthly Closing - Database Schema
-- Trial Balance → P&L 전환 시스템
-- PRD v1.1 기반 (P&L Code 구조)
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

-- 4. COA 매핑 테이블 (계정과목 → P&L Code 매핑)
CREATE TABLE IF NOT EXISTS coa_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_code VARCHAR(10) NOT NULL,
  local_account_code VARCHAR(50) NOT NULL,
  local_account_name VARCHAR(200),
  std_pl_code VARCHAR(10) NOT NULL REFERENCES std_pl_master(pl_code),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(100),
  UNIQUE(entity_code, local_account_code)
);

-- 5. P&L 결과 (매핑 후 생성된 손익계산서)
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

-- 6. 환율 테이블
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
('43000', 'Sales - Merchandise', 'Sales', 10, FALSE, 'Sales'),
('45000', 'Sales - Services', 'Sales', 20, FALSE, 'Sales'),
('46000', 'Sales - Others', 'Sales', 30, FALSE, 'Sales'),
-- Cost of Goods Sold
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
-- 인덱스
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tb_uploads_entity ON tb_uploads(entity_code);
CREATE INDEX IF NOT EXISTS idx_tb_uploads_period ON tb_uploads(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_tb_uploads_status ON tb_uploads(status);
CREATE INDEX IF NOT EXISTS idx_tb_raw_data_upload ON tb_raw_data(upload_id);
CREATE INDEX IF NOT EXISTS idx_tb_raw_data_account ON tb_raw_data(account_code);
CREATE INDEX IF NOT EXISTS idx_coa_mapping_entity ON coa_mapping(entity_code);
CREATE INDEX IF NOT EXISTS idx_coa_mapping_account ON coa_mapping(entity_code, local_account_code);
CREATE INDEX IF NOT EXISTS idx_coa_mapping_pl_code ON coa_mapping(std_pl_code);
CREATE INDEX IF NOT EXISTS idx_pl_results_upload ON pl_results(upload_id);
CREATE INDEX IF NOT EXISTS idx_pl_results_entity_period ON pl_results(entity_code, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_pl_results_pl_code ON pl_results(std_pl_code);

-- ============================================
-- RLS 정책
-- ============================================
ALTER TABLE tb_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tb_raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE coa_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE pl_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE std_pl_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for tb_uploads" ON tb_uploads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for tb_raw_data" ON tb_raw_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for coa_mapping" ON coa_mapping FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for pl_results" ON pl_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for exchange_rates" ON exchange_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for std_pl_master" ON std_pl_master FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 코멘트
-- ============================================
COMMENT ON TABLE tb_uploads IS 'Trial Balance 업로드 기록';
COMMENT ON TABLE tb_raw_data IS 'TB 원장 데이터 (업로드된 원본)';
COMMENT ON TABLE std_pl_master IS '표준 P&L 마스터 (P&L Code 참조 테이블)';
COMMENT ON TABLE coa_mapping IS 'COA 매핑 테이블 (로컬 계정 → 표준 P&L Code)';
COMMENT ON TABLE pl_results IS 'P&L 결과 (매핑 후 생성된 손익계산서, P&L Code 기반)';
COMMENT ON TABLE exchange_rates IS '환율 데이터';
