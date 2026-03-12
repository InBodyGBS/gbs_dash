/**
 * Monthly Closing 관련 타입 정의
 * Trial Balance → P&L / BS 전환 시스템
 * PRD v1.1 기반 (P&L Code + BS Code 구조)
 */

// ============================================
// Statement Type
// ============================================
export type StatementType = 'PL' | 'BS';

// ============================================
// TB Upload
// ============================================
export interface TBUpload {
  id: string;
  entity_code: string;
  subsidiary_id: string | null;
  period_year: number;
  period_month: number;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string | null;
  status: TBUploadStatus;
  unmapped_count: number;
  created_at: string;
  updated_at: string;
}

export type TBUploadStatus = 'uploaded' | 'mapped' | 'partial' | 'error';

export interface TBUploadWithSubsidiary extends TBUpload {
  subsidiaries: {
    id: string;
    name: string;
    code: string;
  } | null;
}

// ============================================
// TB Raw Data (원장 데이터)
// ============================================
export interface TBRawData {
  id: string;
  upload_id: string;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
  description: string | null;
  created_at: string;
}

// ============================================
// Standard P&L Master
// ============================================
export interface StdPLMaster {
  pl_code: string;
  pl_line: string;
  pl_category: string;
  display_order: number;
  is_calculated: boolean;
  parent_category: string | null;
}

// ============================================
// Standard BS Master (PRD 3.2.1.2 기반)
// ============================================
export interface StdBSMaster {
  bs_code: string;
  bs_line: string;
  bs_category: string;
  display_order: number;
  is_calculated: boolean;
  account_type: 'Asset' | 'Liability' | 'Equity';
  is_contra: boolean;
  parent_category: string | null;
}

// ============================================
// COA Mapping (PRD 3.2.1 기반)
// ============================================
export interface COAMapping {
  id: string;
  entity_code: string;
  local_account_code: string;
  local_account_name: string | null;
  statement_type: StatementType; // 'PL' or 'BS'
  std_code: string; // P&L Code or BS Code
  is_active: boolean;
  created_at: string;
  updated_by: string | null;
  // Join with master tables
  std_pl_master?: StdPLMaster;
  std_bs_master?: StdBSMaster;
}

export interface COAMappingInput {
  entity_code: string;
  local_account_code: string;
  local_account_name?: string;
  statement_type: StatementType;
  std_code: string; // P&L Code or BS Code
}

// ============================================
// P&L Results
// ============================================
export interface PLResult {
  id: string;
  upload_id: string;
  entity_code: string;
  subsidiary_id: string | null;
  period_year: number;
  period_month: number;
  std_pl_code: string;
  amount: number;
  currency: string;
  created_at: string;
  // Join with std_pl_master
  std_pl_master?: StdPLMaster;
}

// ============================================
// BS Results
// ============================================
export interface BSResult {
  id: string;
  upload_id: string;
  entity_code: string;
  subsidiary_id: string | null;
  period_year: number;
  period_month: number;
  std_bs_code: string;
  amount: number;
  currency: string;
  created_at: string;
  // Join with std_bs_master
  std_bs_master?: StdBSMaster;
}

// ============================================
// Unmapped Account (매핑되지 않은 계정)
// ============================================
export interface UnmappedAccount {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
  entity_code: string;
  upload_id: string;
  // 추천 statement_type (Balance 부호 기반)
  suggested_statement_type?: StatementType;
}

// ============================================
// P&L 뷰 데이터 (표시용)
// ============================================
export interface PLLineItem {
  pl_code: string;
  pl_line: string;
  pl_category: string;
  amount: number;
  isCalculated: boolean;   // 계산 항목 여부 (Gross Profit, Operating Income 등)
  isSubtotal: boolean;      // 소계 여부
  indent: number;            // 들여쓰기 레벨
  displayOrder: number;
  children?: PLLineItem[];  // drill-down 자식
}

export interface PLSummary {
  entityCode: string;
  entityName: string;
  periodYear: number;
  periodMonth: number;
  sales: number;              // 43000 + 45000 + 46000
  costOfSales: number;        // 52000 + 53000 + 54000
  grossProfit: number;        // 계산값
  gpMargin: number;           // %
  sellingAndAdminExpense: number; // 60001~60034 합계
  operatingIncome: number;    // 계산값 (Gross Profit - SG&A)
  operatingMargin: number;    // %
  otherRevenue: number;       // 71001~71009 합계
  otherExpense: number;       // 72001~72013 합계
  financialRevenue: number;   // 73001~73005 합계
  financialExpense: number;   // 74001~74004 합계
  incomeBeforeTax: number;    // 계산값
  corporateIncomeTax: number; // 80001
  netIncome: number;          // 계산값
  netMargin: number;          // %
  currency: string;
}

// ============================================
// BS 뷰 데이터 (표시용)
// ============================================
export interface BSLineItem {
  bs_code: string;
  bs_line: string;
  bs_category: string;
  amount: number;
  isCalculated: boolean;
  isSubtotal: boolean;
  isContra: boolean;
  accountType: 'Asset' | 'Liability' | 'Equity';
  indent: number;
  displayOrder: number;
  children?: BSLineItem[];
}

export interface BSSummary {
  entityCode: string;
  entityName: string;
  periodYear: number;
  periodMonth: number;
  // Assets
  currentAssets: number;
  nonCurrentAssets: number;
  totalAssets: number;
  // Liabilities
  currentLiabilities: number;
  nonCurrentLiabilities: number;
  totalLiabilities: number;
  // Equity
  totalEquity: number;
  // Validation
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean; // totalAssets === totalLiabilitiesAndEquity
  currency: string;
}

// ============================================
// Dashboard
// ============================================
export interface DashboardSummary {
  totalSales: number;
  totalGrossProfit: number;
  gpPercent: number;
  totalOperatingIncome: number;
  opPercent: number;
  totalNetIncome: number;
  salesMoM: number | null;     // %
  gpPercentMoM: number | null; // pp
  netIncomeMoM: number | null;  // %
}

export interface EntityComparison {
  entityCode: string;
  entityName: string;
  sales: number;
  grossProfit: number;
  gpPercent: number;
  operatingIncome: number;
  opPercent: number;
  netIncome: number;
  netMargin: number;
}

// ============================================
// TB 파일 파싱 결과
// ============================================
export interface TBParsedRow {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
  description?: string;
}

// ============================================
// P&L Code 상수 (PRD 기반)
// ============================================
export const PL_CODE_CATEGORIES = {
  SALES: ['43000', '45000', '46000'],
  COGS: ['52000', '53000', '54000'],
  SG_A: Array.from({ length: 34 }, (_, i) => `600${String(i + 1).padStart(2, '0')}`),
  OTHER_REVENUE: Array.from({ length: 9 }, (_, i) => `710${String(i + 1).padStart(2, '0')}`),
  OTHER_EXPENSE: Array.from({ length: 13 }, (_, i) => `720${String(i + 1).padStart(2, '0')}`),
  FINANCIAL_REVENUE: Array.from({ length: 5 }, (_, i) => `730${String(i + 1).padStart(2, '0')}`),
  FINANCIAL_EXPENSE: Array.from({ length: 4 }, (_, i) => `740${String(i + 1).padStart(2, '0')}`),
  CORPORATE_TAX: ['80001'],
} as const;

// BS Code 범위 (PRD 기반)
export const BS_CODE_CATEGORIES = {
  CURRENT_ASSETS: { prefix: '11', range: [11101, 11511] },
  NON_CURRENT_ASSETS: { prefix: '12', range: [12101, 12701] },
  CURRENT_LIABILITIES: { prefix: '21', range: [21100, 21601] },
  NON_CURRENT_LIABILITIES: { prefix: '22', range: [22101, 22601] },
  EQUITY: { prefix: '31', range: [31101, 31505] },
} as const;

// 계산된 항목 (P&L Code 없음)
export const CALCULATED_ITEMS = {
  GROSS_PROFIT: 'GROSS_PROFIT',
  OPERATING_INCOME: 'OPERATING_INCOME',
  INCOME_BEFORE_TAX: 'INCOME_BEFORE_TAX',
  NET_INCOME: 'NET_INCOME',
  // BS 계산 항목
  TOTAL_CURRENT_ASSETS: 'TOTAL_CURRENT_ASSETS',
  TOTAL_NON_CURRENT_ASSETS: 'TOTAL_NON_CURRENT_ASSETS',
  TOTAL_ASSETS: 'TOTAL_ASSETS',
  TOTAL_CURRENT_LIABILITIES: 'TOTAL_CURRENT_LIABILITIES',
  TOTAL_NON_CURRENT_LIABILITIES: 'TOTAL_NON_CURRENT_LIABILITIES',
  TOTAL_LIABILITIES: 'TOTAL_LIABILITIES',
  TOTAL_EQUITY: 'TOTAL_EQUITY',
  TOTAL_LIABILITIES_AND_EQUITY: 'TOTAL_LIABILITIES_AND_EQUITY',
} as const;
