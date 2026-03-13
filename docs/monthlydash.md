# PRD: Monthly Closing Dashboard - Trial Balance to P&L Conversion System

## 1. Overview

### 1.1 Product Summary
해외법인의 Trial Balance를 수집하여 표준화된 손익계산서(P&L)로 자동 전환하고, 재무 인사이트를 제공하는 대시보드 시스템입니다. 각 법인은 자체 COA(Chart of Accounts) 구조의 TB를 업로드하며, 백엔드에서 매핑 로직을 통해 통일된 P&L 포맷으로 변환합니다.

### 1.2 Target Users
- **Primary**: GBS Team (재무팀 담당자)
- **Secondary**: 해외법인 담당자 (TB 업로드 권한)
- **Stakeholders**: 경영진 (Dashboard 조회)

### 1.3 Business Goals
- 월마감 프로세스 자동화 및 소요시간 50% 단축
- 다국적 법인 재무데이터 표준화 및 비교 가능성 확보
- 실시간 재무 인사이트 제공으로 의사결정 속도 향상

---

## 2. User Stories & Use Cases

### 2.1 해외법인 담당자
```
AS A 해외법인 담당자
I WANT TO 우리 법인의 Trial Balance를 업로드하고
SO THAT 본사에 월마감 자료를 제출할 수 있다
```

**Acceptance Criteria:**
- Excel/CSV 파일 업로드 가능
- 업로드 시 entity, 연도, 월 선택 필수
- 파일 형식 검증 (계정코드, 계정명, 차변, 대변 컬럼 필수)
- 업로드 성공/실패 피드백 제공
- 재업로드 시 기존 데이터 overwrite 확인

### 2.2 GBS Team 담당자
```
AS A GBS 담당자
I WANT TO COA 매핑 룰을 관리하고 P&L 변환 결과를 검증하며
SO THAT 정확한 재무제표가 생성되도록 보장할 수 있다
```

**Acceptance Criteria:**
- Entity별 COA 매핑 테이블 조회/수정 가능
- Unmapped 계정 리스트 확인 및 매핑 규칙 추가
- P&L 라인별 drill-down하여 원장 계정 확인
- Manual adjustment 입력 가능 (reclassification 등)
- Audit trail 로그 확인

### 2.3 경영진
```
AS A 경영진
I WANT TO 전체 법인의 재무성과를 한눈에 비교하고
SO THAT 신속한 경영 의사결정을 할 수 있다
```

**Acceptance Criteria:**
- Entity별 P&L 요약 비교 (YoY, MoM)
- Key metrics visualization (Revenue, GP%, EBIT, Net Income)
- 필터: Entity, Period, Currency
- Export to Excel/PDF

---

## 3. Feature Requirements

### 3.1 File Upload Module
**Priority: P0**

#### 3.1.1 Upload Interface
- **Entity 선택 드롭다운**
  - 법인 리스트: InBody Turkey, Australia, Mexico, Germany, UK, India, Malaysia, Vietnam, Netherlands, Japan, China, etc.
  - 다중 선택 불가 (1개 entity당 1개 파일)
  
- **Period 선택**
  - 연도: 2020년~현재년도
  - 월: 1월~12월
  - Default: 현재년도, 전월

- **File Upload**
  - Accepted formats: .xlsx, .xls, .csv
  - Max file size: 10MB
  - Drag & drop + Browse button
  - Progress indicator

#### 3.1.2 File Validation
**Frontend Validation:**
- File extension check
- File size limit
- Duplicate upload prevention (same entity + period)

**Backend Validation:**
- Required columns check:
  - `Account Code` (계정코드)
  - `Account Name` (계정명)
  - `Debit` (차변)
  - `Credit` (대변)
  - Optional: `Balance`, `Description`
- Data type validation (numeric for debit/credit)
- Debit-Credit balance check (선택적 경고)
- UTF-8 encoding support (다국어 계정명)

#### 3.1.3 Error Handling
| Error Type | User Message | Action |
|-----------|-------------|--------|
| Missing columns | "필수 컬럼이 누락되었습니다: [컬럼명]" | 파일 재업로드 안내 |
| Invalid data type | "행 [N]의 차변/대변에 숫자가 아닌 값이 있습니다" | 해당 행 하이라이트 |
| Duplicate submission | "2025년 1월 자료가 이미 제출되었습니다. 덮어쓰시겠습니까?" | Confirm dialog |
| File too large | "파일 크기는 10MB를 초과할 수 없습니다" | - |

### 3.2 COA Mapping Engine
**Priority: P0**

#### 3.2.1 Mapping Table Structure
```sql
CREATE TABLE coa_mapping (
    id SERIAL PRIMARY KEY,
    entity_code VARCHAR(10),
    local_account_code VARCHAR(50),
    local_account_name VARCHAR(200),
    std_code VARCHAR(10),              -- 표준 코드 (P&L Code 또는 BS Code)
    std_line VARCHAR(100),             -- 표준 라인명
    std_category VARCHAR(50),          -- P&L Category 또는 BS Category
    statement_type VARCHAR(5),         -- 'PL' 또는 'BS'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_by VARCHAR(50),
    UNIQUE(entity_code, local_account_code)
);
```

#### 3.2.1.1 표준 P&L 구조 (Standard P&L Lines)

| P&L Category | P&L Code | P&L Line |
|-------------|----------|----------|
| **Sales** | 43000 | Sales - Merchandise |
| Sales | 45000 | Sales - Services |
| Sales | 46000 | Sales - Others |
| **Cost of Goods Sold** | 52000 | COGS - Merchandise |
| Cost of Goods Sold | 53000 | COGS - Services |
| Cost of Goods Sold | 54000 | COGS - Others |
| **Selling and Administration Expense** | 60001 | Executive Compensations |
| Selling and Administration Expense | 60002 | Salaries & Wages |
| Selling and Administration Expense | 60003 | Miscellaneous Benefits |
| Selling and Administration Expense | 60004 | Sundry allowances |
| Selling and Administration Expense | 60005 | Bonus |
| Selling and Administration Expense | 60006 | Retirement Benefits |
| Selling and Administration Expense | 60007 | Welfare Expense |
| Selling and Administration Expense | 60008 | Travel Expense |
| Selling and Administration Expense | 60009 | Telecom Expense |
| Selling and Administration Expense | 60010 | Utilities Expense |
| Selling and Administration Expense | 60011 | Taxes and Dues |
| Selling and Administration Expense | 60012 | Rent & Lease Expense |
| Selling and Administration Expense | 60013 | Insurance Expense |
| Selling and Administration Expense | 60014 | Reception Expense |
| Selling and Administration Expense | 60015 | Advertising Expense |
| Selling and Administration Expense | 60016 | Vehicles Repairs & Maintenance |
| Selling and Administration Expense | 60017 | Transportation Expense |
| Selling and Administration Expense | 60018 | Commission & Service Charges |
| Selling and Administration Expense | 60019 | Ordinary Research & Development Expense |
| Selling and Administration Expense | 60020 | Consumable Expense |
| Selling and Administration Expense | 60021 | Depreciation Expense |
| Selling and Administration Expense | 60022 | Bad Debt Expense |
| Selling and Administration Expense | 60023 | Electricity Expense |
| Selling and Administration Expense | 60024 | Publishing & Book Expense |
| Selling and Administration Expense | 60025 | Education & Training Expense |
| Selling and Administration Expense | 60026 | Repairs Expenses |
| Selling and Administration Expense | 60027 | Sales Commission |
| Selling and Administration Expense | 60028 | Conference expenses |
| Selling and Administration Expense | 60029 | Amortization Expense |
| Selling and Administration Expense | 60030 | Sales guarantee fee |
| Selling and Administration Expense | 60031 | Membership Dues |
| Selling and Administration Expense | 60032 | Miscellaneous Expenses |
| Selling and Administration Expense | 60033 | Depreciation Expense of Right-of-use Assets |
| Selling and Administration Expense | 60034 | Executive Bonus |
| **Other Revenue** | 71001 | Foreign Exchange Gain |
| Other Revenue | 71002 | Foreign Exchange Gain - Unrealized |
| Other Revenue | 71003 | Reverse of Other Bad Debt Allowance |
| Other Revenue | 71004 | Gain on Disposal of Waste |
| Other Revenue | 71005 | Gain on Disposal of Tangible Assets |
| Other Revenue | 71006 | Gain on Disposal of Intangible Assets |
| Other Revenue | 71007 | Dividends income |
| Other Revenue | 71008 | Miscellaneous Income |
| Other Revenue | 71009 | Gains on disposition of Investment Securities - Subsidiaries |
| **Other Expense** | 72001 | Foreign Exchange Loss |
| Other Expense | 72002 | Foreign Exchange Loss - Unrealized |
| Other Expense | 72003 | Other Bad Debt Expense |
| Other Expense | 72004 | Loss on Disposal of A/R - Trade |
| Other Expense | 72005 | Loss from Valuation of Inventory |
| Other Expense | 72006 | Loss on Disposal of Tangible Assets |
| Other Expense | 72007 | Loss on Disposal of Intangible Assets |
| Other Expense | 72008 | Impairment loss on Tangible Assets |
| Other Expense | 72009 | Impairment loss on Intangle Assets |
| Other Expense | 72010 | Loss on Disposal of Investment stock |
| Other Expense | 72011 | Donations |
| Other Expense | 72012 | Impaired Loss on Investment Securities - Subsidiaries |
| Other Expense | 72013 | Miscellaneous Expense |
| **Financial Revenue** | 73001 | Interest Income |
| Financial Revenue | 73002 | Foreign Exchange Gain |
| Financial Revenue | 73003 | Foreign Exchange Gain - Unrealized |
| Financial Revenue | 73004 | Dividend Income |
| Financial Revenue | 73005 | Gain on Valuation by FVPL |
| **Financial Expense** | 74001 | Interest Expense |
| Financial Expense | 74002 | Foreign Exchange Loss |
| Financial Expense | 74003 | Foreign Exchange Loss - Unrealized |
| Financial Expense | 74004 | Loss on Valuation by FVPL |
| **Corporate Income Tax** | 80001 | Corporate Income Tax Expense |

**P&L Display Structure (Calculated Fields):**
```
Sales (합계: 43000 + 45000 + 46000)
Cost of Goods Sold (합계: 52000 + 53000 + 54000)
─────────────────────────────────
Gross Profit (Sales - COGS)
  GP Margin % (Gross Profit / Sales * 100)

Selling and Administration Expense (합계: 60001~60034)
─────────────────────────────────
Operating Income (Gross Profit - SG&A)
  Operating Margin % (Operating Income / Sales * 100)

Other Revenue (합계: 71001~71009)
Other Expense (합계: 72001~72013)
Financial Revenue (합계: 73001~73005)
Financial Expense (합계: 74001~74004)
─────────────────────────────────
Income before Tax (Operating Income + Other Revenue - Other Expense + Financial Revenue - Financial Expense)

Corporate Income Tax (80001)
─────────────────────────────────
Net Income (Income before Tax - Corporate Income Tax)
  Net Margin % (Net Income / Sales * 100)
```

#### 3.2.1.2 표준 BS 구조 (Standard Balance Sheet Lines)

| BS Category | BS Code | BS Line |
|------------|---------|---------|
| **Current Assets** | 11101 | Cash |
| Current Assets | 11102 | Checking Account |
| Current Assets | 11103 | Foreign Currency Deposits |
| Current Assets | 11201 | Accounts Receivable |
| Current Assets | 11202 | Accounts Receivable - Allowance for Bad Debts |
| Current Assets | 11203 | A/R Nontrade |
| Current Assets | 11204 | A/R Nontrade - Allowance for Bad Debts |
| Current Assets | 11205 | Accrued Income |
| Current Assets | 11206 | Accrued Income - Allowance for Bad Debt |
| Current Assets | 11301 | Short-term Financial Instruments |
| Current Assets | 11302 | Short-term Loans |
| Current Assets | 11303 | Allowance for Short-term Loans |
| Current Assets | 11304 | Other Deposits Provided - Current |
| Current Assets | 11305 | Other Deposits Provided - Current - Allowance for Bad Debt |
| Current Assets | 11401 | Advance Payments |
| Current Assets | 11402 | Allowance for Advance Payments |
| Current Assets | 11403 | Prepaid Expense - General |
| Current Assets | 11404 | Advance tax |
| Current Assets | 11405 | SST input |
| Current Assets | 11406 | Prepaid Tax - Corporate Tax - Current |
| Current Assets | 11407 | Current Tax Assets |
| Current Assets | 11501 | Merchandise |
| Current Assets | 11502 | Merchandise - Valuation Allowance |
| Current Assets | 11511 | Materials in Transit |
| **Non-Current Assets** | 12101 | Land |
| Non-Current Assets | 12102 | Land - State Aid |
| Non-Current Assets | 12103 | Buildings |
| Non-Current Assets | 12104 | Buildings - Accumulated Depreciation |
| Non-Current Assets | 12111 | Machinery |
| Non-Current Assets | 12112 | Machinery - Accumulated Depreciation |
| Non-Current Assets | 12119 | Vehicles |
| Non-Current Assets | 12120 | Vehicles - Accumulated Depreciation |
| Non-Current Assets | 12122 | Fixtures & Furniture |
| Non-Current Assets | 12123 | Fixtures & Furniture - Accumulated Depreciation |
| Non-Current Assets | 12130 | Construction in Progress |
| Non-Current Assets | 12201 | Right-of-use Assets |
| Non-Current Assets | 12202 | Right-of-use Assets - Accumulated Depreciation |
| Non-Current Assets | 12301 | Goodwill |
| Non-Current Assets | 12303 | Industrial rights|
| Non-Current Assets | 12304 | Industrial rights - Accumulated Depreciation |
| Non-Current Assets | 12309 | Computer Software |
| Non-Current Assets | 12310 | Computer Software - Accumulated Amortisation |
| Non-Current Assets | 12316 | Other intangible assets |
| Non-Current Assets | 12317 | Construction in Progress - Intangle Assets |
| Non-Current Assets | 12403 | Investment in real properties - Buildings |
| Non-Current Assets | 12404 | Investment in real properties - Buildings - Accumulated Depreciation |
| Non-Current Assets | 12501 | Investment Securities - Subsidiaries |
| Non-Current Assets | 12601 | Long-term Loans |
| Non-Current Assets | 12602 | Long-term Loans - Allowance for bad debt |
| Non-Current Assets | 12603 | Deposits Provided - Non Current |
| Non-Current Assets | 12604 | Deposits provided - Non Current - Present value discount |
| Non-Current Assets | 12605 | Long-term Financial Instruments |
| Non-Current Assets | 12606 | Long-term Financial Instruments - Present value discount |
| Non-Current Assets | 12607 | Financial assets at FVOCI |
| Non-Current Assets | 12608 | Long-term Trade Receivables |
| Non-Current Assets | 12609 | Long-term Trade Receivables - Allowance for Bad Debt |
| Non-Current Assets | 12610 | Financial assets at FVPL |
| Non-Current Assets | 12701 | Deferred Tax Assets - Noncurrent |
| **Current Liabilities** | 21100 | Accounts Payable |
| Current Liabilities | 21201 | A/P Nontrade |
| Current Liabilities | 21202 | Accrued Expense |
| Current Liabilities | 21203 | Guarantee Deposits Received |
| Current Liabilities | 21401 | Advance Received |
| Current Liabilities | 21402 | Unearned Income |
| Current Liabilities | 21403 | Withholdings |
| Current Liabilities | 21404 | SST Output (Service Tax) |
| Current Liabilities | 21407 | Dividends Payable |
| Current Liabilities | 21406 | Accrued Expense - Salaries & Wages |
| Current Liabilities | 21409 | Other Current Liabilities |
| Current Liabilities | 21501 | Lease Liabilities - Current |
| Current Liabilities | 21601 | Accrued Tax Expense |
| **Non Current Liabilities** | 22101 | Long-term Borrowings |
| Non Current Liabilities | 22102 | Long-term Borrowings - Present Value Discounts |
| Non Current Liabilities | 22103 | Debentures |
| Non Current Liabilities | 22201 | Accrued Severance & Retirement Benefits |
| Non Current Liabilities | 22202 | Deposits for Severance Benefits |
| Non Current Liabilities | 22203 | Retirement pension asset |
| Non Current Liabilities | 22301 | Long-term A/P Nontrade |
| Non Current Liabilities | 22302 | Long-term Advance Payment |
| Non Current Liabilities | 22303 | Long-term Accrued Expense |
| Non Current Liabilities | 22304 | Long-term Unearned Income |
| Non Current Liabilities | 22305 | Reserve for repairs |
| Non Current Liabilities | 22306 | Long Term Accrued Expense - Salaries & Wages |
| Non Current Liabilities | 22401 | Leasehold deposits received |
| Non Current Liabilities | 22501 | Deferred Tax Liabilities - Noncurrent |
| Non Current Liabilities | 22601 | Finance Lease Liabilities - Non Current |
| **Shareholders of the Parent Company** 
| Shareholders of the Parent Company | 31101 | Capital Stock - Common Stock |
| Shareholders of the Parent Company | 31201 | Paid-In Capital in Excess of Par |
| Shareholders of the Parent Company | 31202 | Other Additional Capital |
| Shareholders of the Parent Company | 31308 | Overseas operations translation credit(debit) |
| Shareholders of the Parent Company | 31403 | Retained Earnings - Carried Forward |
| Shareholders of the Parent Company | 31505 | Other Capital Adjustments |

**BS Display Structure (Calculated Fields):**
```
ASSETS
  Current Assets (합계: 11101~11511)
    Cash and Cash Equivalents (11101 + 11102 + 11103)
    Trade Receivables (11201 + 11202 - net)
    Other Receivables (11203 + 11204 + 11205 + 11206 - net)
    Short-term Financial Assets (11301~11305 - net)
    Prepaid Assets (11401~11407 - net)
    Inventories (11501 + 11502 + 11511 - net)
  
  Non-Current Assets (합계: 12101~12701)
    Property, Plant & Equipment (12101~12130 - net)
    Right-of-use Assets (12201 + 12202 - net)
    Intangible Assets (12301~12317 - net)
    Investment Properties (12403 + 12404 - net)
    Long-term Financial Assets (12501~12610 - net)
    Deferred Tax Assets (12701)
  
  Total Assets

LIABILITIES
  Current Liabilities (합계: 21100~21601)
    Trade Payables (21100)
    Other Payables (21201~21203)
    Advances and Unearned (21401~21409)
    Lease Liabilities - Current (21501)
    Tax Payables (21601)
  
  Non-Current Liabilities (합계: 22101~22601)
    Long-term Borrowings (22101~22103 - net)
    Retirement Benefits (22201~22203 - net)
    Other Long-term Liabilities (22301~22401)
    Deferred Tax Liabilities (22501)
    Lease Liabilities - Non Current (22601)
  
  Total Liabilities

EQUITY
  Shareholders of the Parent Company (합계: 31101~31505)
    Capital Stock (31101)
    Additional Paid-In Capital (31201 + 31202)
    Accumulated Other Comprehensive Income (31308)
    Retained Earnings (31403)
    Other Capital Adjustments (31505)
  
  Total Equity

Total Liabilities and Equity
```

#### 3.2.2 Mapping Logic

1. **Automatic Mapping**
   - 업로드된 TB의 계정코드를 `coa_mapping` 테이블과 매칭
   - Match rule: `entity_code` + `local_account_code`
   - Matched 계정은 해당 `std_code` (P&L Code 또는 BS Code)로 분류
   - `statement_type` 필드로 P&L 계정과 BS 계정 구분

2. **Account Classification Logic**
   - TB 업로드 시 각 계정의 Balance (차변-대변) 부호와 계정 성격으로 P&L vs BS 자동 판별
   - P&L 계정: 수익/비용 계정 (당기 발생액)
   - BS 계정: 자산/부채/자본 계정 (누적 잔액)
   - 매핑 시 `statement_type` 필수 지정

3. **Unmapped Account Handling**
   - Unmapped 계정은 별도 리스트에 표시 (P&L 계정과 BS 계정 구분)
   - GBS 담당자가 매핑 규칙 추가 시 statement_type 선택 필수
   - 추가 후 재처리 버튼으로 P&L 및 BS 재생성

4. **Mapping Priority**
   - Entity-specific mapping (최우선)
   - Global mapping rule (공통 규칙)
   - Keyword-based suggestion (AI/ML 활용 가능 - future)

5. **Cross-Statement Validation**
   - P&L 계정의 당기순이익 = BS의 Retained Earnings 증감
   - Depreciation/Amortization Expense (P&L) = Accumulated Depreciation/Amortisation 증가 (BS)
   - 불일치 시 경고 메시지 표시

#### 3.2.3 Mapping UI (Admin)

- **Unmapped Accounts Queue**
  - Tabs: P&L Accounts | BS Accounts
  - Table: Entity | Account Code | Account Name | Balance | Statement Type | Actions
  - Action: Assign to Standard Code (드롭다운 - Code + Line + Category 표시)
  - Statement Type 자동 추천 (Balance 부호 및 계정명 키워드 기반)
  - Bulk assignment 지원

- **Mapping History**
  - Entity별 매핑 테이블 조회
  - Search/Filter by:
    - Account code, name
    - Standard code (P&L Code or BS Code)
    - Standard line, category
    - Statement type (P&L / BS)
  - Edit/Delete mapping rules
  - Export to Excel
  - Import from Excel (bulk upload)

- **Mapping Statistics Dashboard**
  - Entity별 매핑 완료율 (%)
  - P&L vs BS 계정 매핑 현황
  - Most frequently unmapped account patterns
  - Mapping quality score (validation pass rate)

#### 3.2.4 Standard Code Master Tables
```sql
-- Standard P&L Master
CREATE TABLE std_pl_master (
    pl_code VARCHAR(10) PRIMARY KEY,
    pl_line VARCHAR(100),
    pl_category VARCHAR(50),
    display_order INT,
    is_calculated BOOLEAN DEFAULT FALSE, -- TRUE for Gross Profit, Operating Income, etc.
    parent_category VARCHAR(50)
);

-- Standard BS Master
CREATE TABLE std_bs_master (
    bs_code VARCHAR(10) PRIMARY KEY,
    bs_line VARCHAR(100),
    bs_category VARCHAR(50),
    display_order INT,
    is_calculated BOOLEAN DEFAULT FALSE, -- TRUE for subtotals
    account_type VARCHAR(20), -- 'Asset', 'Liability', 'Equity'
    is_contra BOOLEAN DEFAULT FALSE, -- TRUE for allowances, accumulated depreciation
    parent_category VARCHAR(50)
);
```

#### 3.2.5 Mapping Validation Rules

**Critical Validations:**
1. **Single Statement Type**: 각 local account는 하나의 statement type (P&L 또는 BS)에만 매핑 가능
2. **Code-Category Consistency**: P&L Code는 반드시 P&L Category에, BS Code는 BS Category에 매핑
3. **Contra Account Handling**: 
   - Allowance, Accumulated Depreciation 계정은 `is_contra = TRUE`
   - Display 시 차감 표시 (예: A/R - Allowance)
4. **Balance Sign Check**:
   - Asset 계정: 차변 잔액 (+)
   - Liability/Equity 계정: 대변 잔액 (-)
   - Revenue 계정: 대변 발생액 (-)
   - Expense 계정: 차변 발생액 (+)
   - 부호 불일치 시 경고 (데이터 오류 가능성)

**Warning-level Validations:**
1. Similar account names mapped to different standard codes across entities
2. Unusual balance amounts (outliers) in specific standard codes
3. Missing pairs (예: Accumulated Depreciation 있는데 대응 Asset 계정 없음)
### 3.3 P&L Generation & Display
**Priority: P0**

#### 3.3.1 Result Page
**Current State (Screenshot Analysis):**
- Entity 미선택 시: "Entity를 선택하여 월별 손익계산서 대시보드가 표시됩니다"
- 필터: Entity, 연도, 월

**Required Display:**

**Option 1: Single Entity View**
```
┌─────────────────────────────────────────────┐
│ Entity: InBody Turkey    2025년 1월        │
├─────────────────────────────────────────────┤
│ Sales                              $1,234,567│
│   Sales - Merchandise        $980,000        │
│   Sales - Services           $200,000        │
│   Sales - Others             $54,567         │
│                                              │
│ Cost of Goods Sold                ($678,901)│
│   COGS - Merchandise         ($540,000)      │
│   COGS - Services            ($120,000)      │
│   COGS - Others              ($18,901)       │
│                                              │
│ Gross Profit                       $555,666 │
│   GP Margin                          45.0%  │
│                                              │
│ Selling and Administration Expense ($234,567)│
│   Salaries & Wages           ($120,000)      │
│   Advertising Expense        ($45,000)       │
│   Depreciation Expense       ($30,000)       │
│   [... other SG&A items]                     │
│                                              │
│ Operating Income                   $321,099 │
│   Operating Margin                   26.0%  │
│                                              │
│ Other Revenue                      $15,000  │
│ Other Expense                      ($8,500) │
│ Financial Revenue                  $3,200   │
│ Financial Expense                  ($22,045)│
│                                              │
│ Income before Tax                  $308,754 │
│ Corporate Income Tax               ($61,751)│
│                                              │
│ Net Income                         $246,003 │
│   Net Margin                         19.9%  │
└─────────────────────────────────────────────┘
```

**Option 2: Multi-Entity Comparison**
| P&L Line | Turkey | Australia | Mexico | Total |
|----------|--------|-----------|--------|-------|
| Sales | $1.2M | $2.3M | $0.8M | $4.3M |
| COGS | ($0.7M) | ($1.2M) | ($0.5M) | ($2.4M) |
| Gross Profit | $0.5M | $1.1M | $0.3M | $1.9M |
| GP% | 45% | 48% | 38% | 44% |
| SG&A | ($0.2M) | ($0.5M) | ($0.2M) | ($0.9M) |
| Operating Income | $0.3M | $0.6M | $0.1M | $1.0M |
| Op. Margin% | 26% | 26% | 13% | 23% |
| ... | ... | ... | ... | ... |

#### 3.3.2 Drill-Down Feature
- P&L 라인 클릭 시 → 해당 P&L Code에 매핑된 원장 계정 리스트 표시
- Modal/Expandable row 형태
- Columns: Account Code | Account Name | Debit | Credit | Balance | Mapped to P&L Code

#### 3.3.3 Currency Handling
- **Display Currency 선택**: KRW, USD, EUR, TRY, etc.
- **Conversion Logic**:
  - 각 Entity의 functional currency 저장
  - 월말 환율 자동 조회 (API 연동 or 수동 입력)
  - Conversion rate 표시
- **Mixed Currency Warning**: 
  - Multi-entity view 시 환율 적용 여부 명시

### 3.4 Dashboard & Analytics
**Priority: P1**

#### 3.4.1 Summary Cards (Top)
```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Total Sales      │ │ Gross Profit %   │ │ Net Income       │
│ $4,567,890       │ │ 44.2%            │ │ $567,890         │
│ ↑ 12.3% MoM      │ │ ↓ 1.2pp MoM      │ │ ↑ 8.5% MoM       │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

#### 3.4.2 Charts
1. **Sales Trend (Line Chart)**
   - X-axis: Month (last 12 months)
   - Y-axis: Sales
   - Lines: Each entity (color-coded)

2. **Profitability Comparison (Bar Chart)**
   - X-axis: Entity
   - Y-axis: GP%, Operating Margin%, Net Margin%
   - Grouped bars

3. **SG&A Breakdown (Stacked Bar or Treemap)**
   - Major categories: Salaries, Marketing, Depreciation, etc.
   - Entity별 또는 전체

#### 3.4.3 Insights Panel
**Auto-generated insights based on:**
- MoM/YoY variance > ±10%
- GP% drop below historical average
- Loss-making entities
- Top 3 growing/declining entities
- Unusual SG&A spikes

**Example:**
```
⚠️ Turkey: Sales decreased 15% MoM - review Sales - Merchandise breakdown
✅ Australia: GP% improved to 48%, highest in 6 months
📊 Mexico: SG&A spiked 25% due to Advertising Expense increase
💡 India: Operating margin turned positive for first time this year
```

### 3.5 Export & Reporting
**Priority: P1**

#### 3.5.1 Export Options
- **Excel Export**:
  - Multi-sheet: 
    - Summary Dashboard
    - Each Entity P&L (detailed with all P&L codes)
    - Mapping Details (COA to P&L Code mapping)
    - Raw TB Data
  - Formatting: Headers, borders, number format, freeze panes
  
- **PDF Export**:
  - Executive summary format
  - Charts embedded
  - Landscape orientation
  - P&L statements per entity

- **CSV Export**:
  - Raw data for further analysis
  - Separate files: TB Raw, Mapping Table, P&L Results

#### 3.5.2 Scheduled Reports
- 매월 5일 자동 생성 (전월 데이터)
- Email distribution list 관리
- Attachment or link to dashboard

---

## 4. Technical Specifications

### 4.1 Tech Stack
**Frontend:**
- Framework: Next.js 14 (App Router)
- UI: Tailwind CSS + shadcn/ui
- Charts: Recharts or Chart.js
- State Management: Zustand or React Context
- File Upload: react-dropzone

**Backend:**
- Runtime: Next.js API Routes or separate Node.js/Python backend
- Database: PostgreSQL (Supabase)
- File Storage: AWS S3 or Supabase Storage
- File Parsing: SheetJS (xlsx) or pandas (Python)

**Deployment:**
- Vercel (Frontend + API)
- Supabase (Database + Storage + RPC functions)

### 4.2 Database Schema
```sql
-- Entities
CREATE TABLE entities (
    entity_code VARCHAR(10) PRIMARY KEY,
    entity_name VARCHAR(100),
    functional_currency VARCHAR(3),
    country VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE
);

-- TB Uploads
CREATE TABLE tb_uploads (
    upload_id SERIAL PRIMARY KEY,
    entity_code VARCHAR(10) REFERENCES entities(entity_code),
    period_year INT,
    period_month INT,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    upload_timestamp TIMESTAMP DEFAULT NOW(),
    uploaded_by VARCHAR(50),
    status VARCHAR(20), -- 'uploaded', 'mapped', 'error'
    UNIQUE(entity_code, period_year, period_month)
);

-- TB Raw Data
CREATE TABLE tb_raw_data (
    id SERIAL PRIMARY KEY,
    upload_id INT REFERENCES tb_uploads(upload_id),
    account_code VARCHAR(50),
    account_name VARCHAR(200),
    debit DECIMAL(18,2),
    credit DECIMAL(18,2),
    balance DECIMAL(18,2),
    description TEXT
);

-- Standard P&L Master (Reference table)
CREATE TABLE std_pl_master (
    pl_code VARCHAR(10) PRIMARY KEY,
    pl_line VARCHAR(100),
    pl_category VARCHAR(50),
    display_order INT,
    is_calculated BOOLEAN DEFAULT FALSE, -- TRUE for Gross Profit, Operating Income, etc.
    parent_category VARCHAR(50) -- For grouping
);

-- COA Mapping
CREATE TABLE coa_mapping (
    id SERIAL PRIMARY KEY,
    entity_code VARCHAR(10),
    local_account_code VARCHAR(50),
    local_account_name VARCHAR(200),
    std_pl_code VARCHAR(10) REFERENCES std_pl_master(pl_code),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR(50),
    UNIQUE(entity_code, local_account_code)
);

-- P&L Results
CREATE TABLE pl_results (
    id SERIAL PRIMARY KEY,
    upload_id INT REFERENCES tb_uploads(upload_id),
    pl_code VARCHAR(10) REFERENCES std_pl_master(pl_code),
    amount DECIMAL(18,2),
    functional_currency VARCHAR(3),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Exchange Rates
CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    from_currency VARCHAR(3),
    to_currency VARCHAR(3),
    rate_date DATE,
    rate DECIMAL(10,6),
    UNIQUE(from_currency, to_currency, rate_date)
);

-- Audit Log
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    upload_id INT REFERENCES tb_uploads(upload_id),
    action VARCHAR(50), -- 'upload', 'mapping_added', 'mapping_updated', 'pl_generated'
    details JSONB,
    user_id VARCHAR(50),
    timestamp TIMESTAMP DEFAULT NOW()
);
```

### 4.3 API Endpoints

#### Upload
```
POST /api/upload
Body: FormData {
  entity_code: string,
  period_year: number,
  period_month: number,
  file: File
}
Response: {
  success: boolean,
  upload_id: number,
  message: string,
  validation_errors?: array,
  unmapped_count?: number
}
```

#### Get P&L
```
GET /api/pl?entity={code}&year={yyyy}&month={mm}&currency={code}
Response: {
  entity_code: string,
  period: string,
  pl_data: [
    { 
      pl_code: string,
      pl_line: string, 
      pl_category: string, 
      amount: number,
      is_calculated: boolean,
      display_order: number 
    }
  ],
  calculated_metrics: {
    gross_profit: number,
    gp_margin: number,
    operating_income: number,
    op_margin: number,
    income_before_tax: number,
    net_income: number,
    net_margin: number
  },
  unmapped_accounts: number,
  currency: string,
  exchange_rate?: number
}
```

#### Get Dashboard Summary
```
GET /api/dashboard?entities[]={codes}&year={yyyy}&month={mm}&currency={code}
Response: {
  summary: { 
    total_sales: number,
    total_gp: number,
    gp_percent: number,
    total_operating_income: number,
    op_percent: number,
    net_income: number,
    net_percent: number
  },
  entities: [ 
    { 
      entity_code: string,
      sales: number,
      gp: number,
      gp_percent: number,
      operating_income: number,
      op_percent: number,
      net_income: number,
      net_percent: number
    } 
  ],
  trends: [ 
    { 
      month: string,
      entity_code: string,
      sales: number,
      gp: number,
      operating_income: number,
      net_income: number 
    } 
  ],
  insights: [
    {
      type: 'warning' | 'success' | 'info',
      entity_code: string,
      message: string
    }
  ]
}
```

#### Manage Mapping
```
POST /api/mapping
Body: {
  entity_code: string,
  local_account_code: string,
  local_account_name: string,
  std_pl_code: string
}
Response: {
  success: boolean,
  mapping_id: number
}

GET /api/mapping/unmapped?upload_id={id}
Response: {
  unmapped: [
    { 
      account_code: string,
      account_name: string,
      balance: number
    }
  ]
}

GET /api/mapping/list?entity_code={code}
Response: {
  mappings: [
    {
      local_account_code: string,
      local_account_name: string,
      std_pl_code: string,
      pl_line: string,
      pl_category: string
    }
  ]
}

PUT /api/mapping/{id}
Body: {
  std_pl_code: string
}

DELETE /api/mapping/{id}
```

#### Get P&L Drill-Down
```
GET /api/pl/drilldown?upload_id={id}&pl_code={code}
Response: {
  pl_code: string,
  pl_line: string,
  total_amount: number,
  accounts: [
    {
      account_code: string,
      account_name: string,
      debit: number,
      credit: number,
      balance: number
    }
  ]
}
```

### 4.4 Processing Flow
```
User uploads TB file
    ↓
Frontend validation
    ↓
Upload to Storage (S3/Supabase)
    ↓
Parse Excel/CSV (SheetJS/pandas)
    ↓
Save to tb_raw_data
    ↓
Trigger COA Mapping Process
    ↓
Query coa_mapping table for entity
    ↓
Match local_account_code → std_pl_code
    ↓
All accounts mapped?
    ├─ Yes → Calculate P&L amounts by pl_code
    │         ↓
    │         Save to pl_results
    │         ↓
    │         Calculate derived metrics (GP, Op Income, etc.)
    │         ↓
    │         Display on Dashboard
    │
    └─ No → Flag unmapped accounts
            ↓
            Notify GBS admin
            ↓
            Admin assigns mappings via UI
            ↓
            Click "Re-process" button
            ↓
            Re-run mapping and P&L generation
```

---

## 5. User Flows

### 5.1 Happy Path: First-time Upload
1. 해외법인 담당자 로그인
2. "Upload TB" 버튼 클릭
3. Entity 선택 (e.g., InBody Turkey)
4. Period 선택 (2025년 1월)
5. 파일 업로드 (drag & drop)
6. 시스템이 자동 파싱 및 검증
7. "Upload Successful - All accounts mapped" 메시지
8. GBS 담당자에게 알림
9. GBS 담당자가 P&L 확인 (unmapped 0개)
10. Dashboard에서 P&L 조회 가능
11. Drill-down으로 세부 계정 확인

### 5.2 Edge Case: Unmapped Accounts
1. 파일 업로드 후 매핑 실행
2. 시스템이 10개 unmapped accounts 발견 (총 200개 중)
3. "Upload successful - 10 unmapped accounts require attention" 알림
4. GBS 담당자에게 이메일 알림
5. Admin이 "Unmapped Queue" 페이지 접근
6. 각 계정에 대해 P&L Code 할당
   - Account "400-NEW" → P&L Code 43000 (Sales - Merchandise)
   - Account "510-NEW" → P&L Code 52000 (COGS - Merchandise)
7. "Re-process P&L" 버튼 클릭
8. P&L 재생성 완료
9. 검증 후 Dashboard에 반영

### 5.3 Dashboard Review Flow
1. 경영진이 Dashboard 접근
2. 전체 Entity 선택 (또는 특정 region)
3. 2025년 1월 선택
4. Summary cards 확인: Total Sales ↑12%, Net Income ↑8%
5. Sales trend chart 확인: Turkey 하락, Australia 상승
6. Turkey P&L 클릭하여 상세 조회
7. "Sales - Merchandise" 라인 클릭 → Drill-down modal
8. 해당 라인에 매핑된 계정 리스트 확인 (Account 400-001, 400-005 등)
9. "Export to Excel" 클릭하여 상세 자료 다운로드

---

## 6. Non-Functional Requirements

### 6.1 Performance
- TB 파일 파싱: < 10초 (5,000 rows 기준)
- COA 매핑 실행: < 5초
- P&L 생성: < 3초 (all calculations)
- Dashboard 로딩: < 2초 (10개 entity 기준)
- Drill-down modal: < 1초

### 6.2 Scalability
- Concurrent uploads: 20 users
- Max entities: 50
- Max TB rows per file: 10,000
- Historical data retention: 5 years
- Max P&L codes in master: 500

### 6.3 Security
- Role-based access control (RBAC)
  - Entity User: Upload only for assigned entities
  - GBS Team: Upload + Mapping + Dashboard full access
  - Executive: Dashboard view only
- File upload virus scanning
- Encryption at rest (S3/Supabase)
- Audit logging for all mapping changes and uploads
- API authentication via JWT

### 6.4 Localization
- UI language: Korean, English (toggle)
- Number format: 천 단위 콤마, 소수점 2자리
- Date format: YYYY-MM-DD or locale-specific
- P&L line names: Support multilingual display (future)

### 6.5 Browser Support
- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+

---

## 7. Success Metrics

### 7.1 KPIs
- **Efficiency**: 월마감 소요시간 50% 감소 (baseline: 5일 → target: 2.5일)
- **Accuracy**: Mapping error rate < 1% (unmapped accounts requiring rework)
- **Adoption**: 80% of entities submit TB within 3 days of month-end
- **User Satisfaction**: NPS > 8/10
- **Data Quality**: < 5% unmapped accounts per upload (after initial setup)

### 7.2 Analytics to Track
- Upload completion rate by entity
- Average time from upload to P&L approval
- Most frequently unmapped account categories (for mapping rule improvement)
- Dashboard page views and export downloads
- Average number of drill-downs per session
- P&L variance alerts triggered per month

---

## 8. Future Enhancements (Out of Scope for MVP)

### 8.1 Phase 2
- Balance Sheet generation from TB
- Cash Flow Statement (indirect method)
- Variance analysis with budget/forecast
- Intercompany elimination automation
- AI-powered mapping suggestion based on account name keywords

### 8.2 Phase 3
- Natural language query (ChatGPT-like interface: "Show me entities with declining GP%")
- Predictive analytics (revenue forecast based on historical trends)
- Integration with ERP systems (Odoo, D365) for auto TB extraction
- Mobile app for on-the-go approval
- Multi-period comparison (QoQ, YoY side-by-side)

### 8.3 Phase 4
- Automated journal entry generation for reclassifications
- IFRS/GAAP reconciliation module
- Audit trail export for external auditors (SOX compliance)
- Real-time collaborative commenting on P&L lines
- Advanced analytics: profitability by product line, customer segment

---

## 9. Open Questions & Decisions Needed

1. **Currency Conversion**: 
   - 월말 환율 자동 조회 API (exchangerate-api.com, ECB, etc.) vs 수동 입력?
   - Historical rate 보정 로직 필요 여부?
   - **Decision needed by**: Week 2 of development

2. **Unmapped Account Alert**: 
   - Email notification vs in-app notification only?
   - Threshold: 즉시 vs daily digest (if > 5 unmapped)?
   - **Decision needed by**: Week 1 of development

3. **Data Retention**: 
   - Raw TB files 영구 보관 vs 1년 후 자동 삭제?
   - P&L results는 영구 보관?
   - **Decision needed by**: Before production deployment

4. **Access Control**: 
   - Entity user가 타 entity 데이터 조회 가능 여부?
   - Dashboard 필터에서 "All Entities" 권한을 Executive에게만?
   - **Decision needed by**: Week 2 of development

5. **Mapping Rule Versioning**: 
   - COA 매핑 변경 시 과거 P&L 재계산 여부?
   - Mapping rule change history 유지 및 rollback 기능?
   - **Decision needed by**: Week 3 of development

6. **P&L Code Hierarchy**:
   - 현재 flat structure (43000, 60001 등) vs hierarchical (4-Sales, 43-Product Sales, 43000-Merchandise)?
   - Sub-category 필요 여부 (예: SG&A를 Selling vs Admin으로 구분)?
   - **Decision needed by**: Week 1 of development

---

## 10. Appendix

### 10.1 Sample File Formats

**TB File (Excel/CSV):**
| Account Code | Account Name | Debit | Credit | Balance |
|--------------|--------------|-------|--------|---------|
| 400-001 | Product Sales - Domestic | 0 | 800,000 | -800,000 |
| 400-005 | Product Sales - Export | 0 | 180,000 | -180,000 |
| 500-001 | Raw Materials | 300,000 | 0 | 300,000 |
| 500-010 | Direct Labor | 120,000 | 0 | 120,000 |
| 600-010 | Salaries - Admin | 80,000 | 0 | 80,000 |
| 600-020 | Salaries - Sales | 70,000 | 0 | 70,000 |
| 700-010 | Rent Expense | 50,000 | 0 | 50,000 |
| 700-020 | Advertising | 45,000 | 0 | 45,000 |
| ... | ... | ... | ... | ... |

**Mapping Example (Turkey):**
| Local Account Code | Local Account Name | Std P&L Code | P&L Line | P&L Category |
|-------------------|-------------------|--------------|----------|--------------|
| 400-001 | Product Sales - Domestic | 43000 | Sales - Merchandise | Sales |
| 400-005 | Product Sales - Export | 43000 | Sales - Merchandise | Sales |
| 450-001 | Service Revenue | 45000 | Sales - Services | Sales |
| 500-001 | Raw Materials | 52000 | COGS - Merchandise | Cost of Goods Sold |
| 500-010 | Direct Labor | 52000 | COGS - Merchandise | Cost of Goods Sold |
| 600-010 | Salaries - Admin | 60002 | Salaries & Wages | Selling and Administration Expense |
| 600-020 | Salaries - Sales | 60002 | Salaries & Wages | Selling and Administration Expense |
| 700-010 | Rent Expense | 60012 | Rent & Lease Expense | Selling and Administration Expense |
| 700-020 | Advertising | 60015 | Advertising Expense | Selling and Administration Expense |

### 10.2 Standard P&L Code Reference
*(See section 3.2.1 for complete table)*

### 10.3 Entity List (as of 2025)
| Entity Code | Entity Name | Functional Currency | Country |
|------------|-------------|---------------------|---------|
| IBT | InBody Turkey | TRY | Turkey |
| IBA | InBody Australia | AUD | Australia |
| IBM | InBody Mexico | MXN | Mexico |
| IBD | InBody Germany | EUR | Germany |
| IBU | InBody UK | GBP | United Kingdom |
| IBI | InBody India | INR | India |
| IBMY | InBody Malaysia | MYR | Malaysia |
| IBV | InBody Vietnam | VND | Vietnam |
| IBN | InBody Netherlands | EUR | Netherlands |
| IBJ | InBody Japan | JPY | Japan |
| IBC | InBody China | CNY | China |

### 10.4 Sample P&L Output

**InBody Turkey - January 2025 (TRY)**
| P&L Code | P&L Line | Amount (TRY) |
|---------|----------|--------------|
| 43000 | Sales - Merchandise | 35,000,000 |
| 45000 | Sales - Services | 5,000,000 |
| 46000 | Sales - Others | 500,000 |
| **TOTAL SALES** | | **40,500,000** |
| 52000 | COGS - Merchandise | (18,000,000) |
| 53000 | COGS - Services | (2,000,000) |
| 54000 | COGS - Others | (200,000) |
| **TOTAL COGS** | | **(20,200,000)** |
| **GROSS PROFIT** | | **20,300,000** |
| **GP MARGIN** | | **50.1%** |
| 60002 | Salaries & Wages | (8,500,000) |
| 60015 | Advertising Expense | (2,000,000) |
| 60021 | Depreciation Expense | (1,200,000) |
| ... | ... | ... |
| **TOTAL SG&A** | | **(15,000,000)** |
| **OPERATING INCOME** | | **5,300,000** |
| **OPERATING MARGIN** | | **13.1%** |
| 71008 | Miscellaneous Income | 150,000 |
| 72013 | Miscellaneous Expense | (100,000) |
| 73001 | Interest Income | 50,000 |
| 74001 | Interest Expense | (800,000) |
| **INCOME BEFORE TAX** | | **4,600,000** |
| 80001 | Corporate Income Tax Expense | (1,150,000) |
| **NET INCOME** | | **3,450,000** |
| **NET MARGIN** | | **8.5%** |

---

## Document Control
- **Version**: 1.1
- **Created**: 2025-03-12
- **Last Updated**: 2025-03-12
- **Author**: Seunghyun Cho (GBS Team)
- **Stakeholders**: CFO, GBS Team Lead, IT Department
- **Status**: Draft for Review
- **Change Log**:
  - v1.1: Updated Standard P&L structure with specific P&L codes (43000, 60001, etc.)
  - Added std_pl_master reference table to database schema
  - Enhanced drill-down feature to show P&L code mapping
  - Updated API responses to include pl_code field