-- ============================================
-- std_pl_master 테이블 업데이트
-- 새로운 P&L 코드 추가 및 기존 데이터 정리
-- ============================================

-- 1. 기존 데이터 전체 삭제 후 새로 삽입 (깔끔한 방법)
-- 주의: coa_mapping에서 참조하는 std_code가 있으면 FK 에러 발생 가능
-- 그래서 UPSERT 방식 사용

-- 2. UPSERT 방식으로 새 데이터 삽입/업데이트
INSERT INTO std_pl_master (pl_code, pl_line, pl_category, display_order, is_calculated, parent_category) VALUES
-- Sales (4xxxx)
('41000', 'Sales - Finished Goods', 'Sales', 10, FALSE, 'Sales'),
('42000', 'Sales - Finished Goods - Related party', 'Sales', 11, FALSE, 'Sales'),
('43000', 'Sales - Merchandise', 'Sales', 12, FALSE, 'Sales'),
('44000', 'Sales - Merchandise - Related party', 'Sales', 13, FALSE, 'Sales'),
('45000', 'Sales - Services', 'Sales', 20, FALSE, 'Sales'),
('46000', 'Sales - Others', 'Sales', 30, FALSE, 'Sales'),

-- Cost of Goods Sold (5xxxx)
('51000', 'Cost of Goods Sold - Finished Goods', 'Cost of Goods Sold', 40, FALSE, 'Cost of Goods Sold'),
('52000', 'COGS - Merchandise', 'Cost of Goods Sold', 41, FALSE, 'Cost of Goods Sold'),
('53000', 'COGS - Services', 'Cost of Goods Sold', 50, FALSE, 'Cost of Goods Sold'),
('54000', 'COGS - Others', 'Cost of Goods Sold', 60, FALSE, 'Cost of Goods Sold'),

-- Selling and Administration Expense (6xxxx)
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

-- Other Revenue (71xxx)
('71001', 'Foreign Exchange Gain', 'Other Revenue', 180, FALSE, 'Other Revenue'),
('71002', 'Foreign Exchange Gain - Unrealized', 'Other Revenue', 181, FALSE, 'Other Revenue'),
('71003', 'Reverse of Other Bad Debt Allowance', 'Other Revenue', 182, FALSE, 'Other Revenue'),
('71004', 'Gain on Disposal of Waste', 'Other Revenue', 183, FALSE, 'Other Revenue'),
('71005', 'Gain on Disposal of Tangible Assets', 'Other Revenue', 184, FALSE, 'Other Revenue'),
('71006', 'Gain on Disposal of Intangible Assets', 'Other Revenue', 185, FALSE, 'Other Revenue'),
('71007', 'Dividends income', 'Other Revenue', 186, FALSE, 'Other Revenue'),
('71008', 'Miscellaneous Income', 'Other Revenue', 187, FALSE, 'Other Revenue'),
('71009', 'Gains on disposition of Investment Securities - Subsidiaries', 'Other Revenue', 188, FALSE, 'Other Revenue'),

-- Other Expense (72xxx)
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

-- Financial Revenue (73xxx)
('73001', 'Interest Income', 'Financial Revenue', 220, FALSE, 'Financial Revenue'),
('73002', 'Foreign Exchange Gain', 'Financial Revenue', 221, FALSE, 'Financial Revenue'),
('73003', 'Foreign Exchange Gain - Unrealized', 'Financial Revenue', 222, FALSE, 'Financial Revenue'),
('73004', 'Dividend Income', 'Financial Revenue', 223, FALSE, 'Financial Revenue'),
('73005', 'Gain on Valuation by FVPL', 'Financial Revenue', 224, FALSE, 'Financial Revenue'),

-- Financial Expense (74xxx)
('74001', 'Interest Expense', 'Financial Expense', 240, FALSE, 'Financial Expense'),
('74002', 'Foreign Exchange Loss', 'Financial Expense', 241, FALSE, 'Financial Expense'),
('74003', 'Foreign Exchange Loss - Unrealized', 'Financial Expense', 242, FALSE, 'Financial Expense'),
('74004', 'Loss on Valuation by FVPL', 'Financial Expense', 243, FALSE, 'Financial Expense'),

-- Corporate Income Tax (8xxxx)
('80001', 'Corporate Income Tax Expense', 'Corporate Income Tax', 260, FALSE, 'Corporate Income Tax')

ON CONFLICT (pl_code) DO UPDATE SET
  pl_line = EXCLUDED.pl_line,
  pl_category = EXCLUDED.pl_category,
  display_order = EXCLUDED.display_order,
  is_calculated = EXCLUDED.is_calculated,
  parent_category = EXCLUDED.parent_category;

-- 3. 결과 확인
SELECT pl_code, pl_line, pl_category, display_order 
FROM std_pl_master 
ORDER BY display_order, pl_code;
