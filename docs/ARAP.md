# Product Requirements Document (PRD)
## Intercompany AR-AP Balance Reconciliation System

---

### 문서 정보
| 항목 | 내용 |
|------|------|
| **문서명** | Intercompany AR-AP Balance Reconciliation System PRD |
| **버전** | 1.0 |
| **작성자** | [작성자명] |
| **작성일** | 2025-01-20 |
| **최종수정일** | 2025-01-20 |
| **승인자** | [승인자명] |
| **상태** | Draft / Under Review / Approved |

---

## 1. 프로젝트 개요

### 1.1 배경 및 목적
- **배경**: 글로벌 법인 간 채권채무 대사 프로세스가 수작업 및 이메일 기반으로 진행되어 비효율적이고 오류 발생 가능성이 높음
- **목적**: 
  - 월별/분기별 Intercompany 간 채권채무 대사를 자동화하여 업무 효율성 향상
  - 실시간 매칭 상태 확인으로 마감 프로세스 가속화
  - 데이터 정확성 향상 및 감사 추적성(Audit Trail) 확보

### 1.2 프로젝트 범위
- **In Scope**:
  - 월별/분기별 Intercompany AR-AP 대사 시스템
  - 권한별 페이지 접근 제어 (본사 관리자 vs 해외법인)
  - 데이터 입력/업로드 기능 (직접 입력 및 Excel 파일 업로드)
  - 실시간 매칭 상태 시각화
  - 제출 이력 관리 및 다운로드
  
- **Out of Scope**:
  - ERP 시스템과의 자동 연동 (향후 Phase 2)
  - 자동 이메일 알림 기능 (향후 Phase 2)
  - 다국어 지원 (현재는 한/영 혼용)

### 1.3 성공 지표 (Success Metrics)
- 월말 마감 프로세스 소요 시간 30% 단축
- 대사 오류율 50% 감소
- 사용자 만족도 80% 이상
- 시스템 가동률 99% 이상

---

## 2. 사용자 정의

### 2.1 사용자 페르소나

#### Persona 1: 본사 관리자 (HQ Administrator)
- **역할**: 전체 법인의 AR-AP 대사 현황 모니터링 및 관리
- **니즈**: 
  - 모든 법인의 제출 현황을 한눈에 확인
  - 매칭되지 않는 항목에 대한 빠른 식별 및 조치
  - 과거 데이터 조회 및 다운로드
- **권한**: 모든 법인 데이터 조회, 다운로드, 수동 매칭 조정

#### Persona 2: 해외법인 담당자 (Entity User)
- **역할**: 본인 법인의 AR-AP 데이터 입력 및 확인
- **니즈**:
  - 빠르고 직관적인 데이터 입력
  - 상대 법인과의 매칭 상태 실시간 확인
  - 과거 제출 이력 조회
- **권한**: 본인 법인 데이터만 입력/조회

---

## 3. 기능 요구사항

### 3.1 권한 확인 페이지 (Authentication)

#### 3.1.1 초기 로그인
```
[팝업 화면]
┌─────────────────────────────────┐
│  Intercompany AR-AP System      │
├─────────────────────────────────┤
│  Select Entity: [Dropdown ▼]    │
│                                 │
│  Password: [______________]     │
│                                 │
│          [Login Button]         │
└─────────────────────────────────┘
```

**기능 명세**:
- Entity 선택 시 비밀번호 입력란 활성화
- 비밀번호 검증 실패 시: "Please enter your password" 메시지 표시 (빨간색)
- 성공 시: 해당 Entity 페이지로 이동
- InBody HQ 선택 시: 관리자 페이지로 이동

**검증 규칙**:
- Entity 선택 필수
- 비밀번호 3회 오류 시 5분간 접근 제한
- 세션 타임아웃: 30분 (활동 없을 시)

**데이터 구조**:
```sql
-- entities 테이블
CREATE TABLE entities (
  id UUID PRIMARY KEY,
  entity_name TEXT NOT NULL UNIQUE,
  entity_code TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 3.2 관리자 페이지 (Administrator View)

#### 3.2.1 Main Page - Monthly View

**화면 구성**:
```
┌──────────────────────────────────────────────────────────┐
│ Intercompany AR-AP Balance     Year: [2024 ▼]           │
├──────────────────────────────────────────────────────────┤
│ [Monthly] [Entity]                                       │
├──────────────────────────────────────────────────────────┤
│ Entity      │ Jan │ Feb │ Mar │ ... │ Dec │             │
├─────────────┼─────┼─────┼─────┼─────┼─────┤             │
│ ⋮ Korea HQ  │  🔴 │  🔵 │  🔵 │ ... │  🔴 │ [Drag]      │
│ ⋮ US Corp   │  🔵 │  🔵 │  🟢 │ ... │  🔴 │ [Drag]      │
│ ⋮ EU NL     │  🔴 │  🟢 │  🔵 │ ... │  🔴 │ [Drag]      │
└──────────────────────────────────────────────────────────┘

Legend:
🔴 Red: 미제출 (No submission)
🔵 Blue: 제출완료 (Submitted)
🟢 Green: 매칭완료 (Matched)
```

**기능 명세**:
- **조회 기준**: 연도 (Dropdown, 2020~현재년도)
- **Entity 순서 조정**: 드래그 앤 드롭으로 순서 변경 가능 (저장 기능 포함)
- **원형 색상 규칙**:
  - 🔴 빨간색: 해당 연도/월에 제출한 자료 없음
  - 🔵 파란색: 해당 연도/월에 1개 이상 Entity가 제출
  - 🟢 초록색: 모든 관련 Entity가 제출하고 금액 매칭 완료
- **클릭 이벤트**: 원형 클릭 시 해당 연도/월의 상세 내역으로 이동

**데이터 쿼리 로직**:
```sql
-- 월별 제출 현황 조회
SELECT 
  e.entity_name,
  EXTRACT(MONTH FROM s.submission_date) as month,
  COUNT(s.id) as submission_count,
  CASE 
    WHEN COUNT(s.id) = 0 THEN 'red'
    WHEN SUM(CASE WHEN s.match_status = 'matched' THEN 1 ELSE 0 END) = COUNT(s.id) THEN 'green'
    ELSE 'blue'
  END as status_color
FROM entities e
LEFT JOIN submissions s ON e.id = s.entity_id 
  AND EXTRACT(YEAR FROM s.submission_date) = ?
GROUP BY e.entity_name, EXTRACT(MONTH FROM s.submission_date)
ORDER BY e.display_order, month;
```

---

#### 3.2.2 Main Page - Entity View

**화면 구성**:
```
┌──────────────────────────────────────────────────────────┐
│ Intercompany AR-AP Balance                               │
│ Year: [2024 ▼]  Month: [January ▼]                      │
├──────────────────────────────────────────────────────────┤
│ [Monthly] [Entity]                    [Admin Edit Mode]  │
├──────────────────────────────────────────────────────────┤
│         │ Korea │  US  │  EU  │ Turkey│ Japan│ China│   │
├─────────┼───────┼──────┼──────┼───────┼──────┼──────┤   │
│ Korea   │   -   │  🟢  │  🔵  │  🔴   │  🟢  │  🔵  │   │
│ US      │  🟢   │   -  │  🟢  │  🟢   │  🔴  │  🔵  │   │
│ EU      │  🔵   │  🟢  │   -  │  🔵   │  🔵  │  🟢  │   │
│ Turkey  │  🔴   │  🟢  │  🔵  │   -   │  🔴  │  🔴  │   │
└──────────────────────────────────────────────────────────┘
```

**기능 명세**:
- **조회 기준**: 연도, 월 (Dropdown)
- **원형 색상 규칙**:
  - 🔴 빨간색: 양쪽 모두 미제출
  - 🔵 파란색 (확인중): 
    - 한쪽만 제출
    - 양쪽 제출했으나 금액 불일치
  - 🟢 초록색: 양쪽 제출 + 금액 매칭 완료
- **관리자 수정 권한**: 
  - 우측 상단 "Admin Edit Mode" 토글 버튼
  - 활성화 시: 빨간색 원형 클릭하여 파란색으로 수동 변경 가능 (AR/AP 없는 경우)
  - 변경 이력 기록 (audit log)

**매칭 로직 예시**:
```
예시 1: Korea HQ ↔ US Corp
- Korea 입력: US Corp에 대한 AR $100,000
- US 입력: Korea HQ에 대한 AP $100,000
→ 금액 일치 → 🟢 초록색

예시 2: EU NL ↔ Turkey
- EU 입력: Turkey에 대한 AR €50,000
- Turkey 입력: EU NL에 대한 AP €45,000
→ 금액 불일치 → 🔵 파란색

예시 3: Japan ↔ China
- Japan: 미제출
- China: 미제출
→ 양쪽 미제출 → 🔴 빨간색
```

---

#### 3.2.3 Review Page

**화면 구성**:
```
┌──────────────────────────────────────────────────────────┐
│ Review Submissions                                       │
│ Year: [2024 ▼]  Month: [January ▼]  Entity: [US ▼]     │
├──────────────────────────────────────────────────────────┤
│ Submission History                                       │
├──────────────────────────────────────────────────────────┤
│ Date       │ Entity  │ Type │ Items │ Status  │ Action  │
├────────────┼─────────┼──────┼───────┼─────────┼─────────┤
│ 2024-01-15 │ US Corp │ File │  45   │ Matched │ [📥]    │
│ 2024-01-14 │ US Corp │ Manual│  12  │ Pending │ [📥]    │
│ 2024-01-10 │ US Corp │ File │  38   │ Matched │ [📥]    │
└──────────────────────────────────────────────────────────┘

📥 Download Details (Excel)
```

**기능 명세**:
- **조회 필터**: 연도, 월, Entity (다중 선택 가능)
- **표시 정보**:
  - 제출 일시
  - 제출 방식 (File Upload / Manual Entry)
  - 제출 항목 수
  - 매칭 상태
- **다운로드 기능**:
  - Excel 형식으로 제출된 원본 데이터 다운로드
  - 다운로드 버튼 클릭 시 signed URL 생성하여 파일 제공

**데이터 구조**:
```sql
-- submissions 테이블
CREATE TABLE submissions (
  id UUID PRIMARY KEY,
  entity_id UUID REFERENCES entities(id),
  fiscal_year INTEGER NOT NULL,
  fiscal_month INTEGER NOT NULL,
  submission_type TEXT CHECK (submission_type IN ('file', 'manual')),
  submission_date TIMESTAMP DEFAULT NOW(),
  file_path TEXT,
  total_items INTEGER,
  match_status TEXT CHECK (match_status IN ('pending', 'matched', 'mismatched')),
  submitted_by UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- submission_details 테이블
CREATE TABLE submission_details (
  id UUID PRIMARY KEY,
  submission_id UUID REFERENCES submissions(id),
  invoice_date DATE,
  counterparty_entity_id UUID REFERENCES entities(id),
  account_type TEXT CHECK (account_type IN ('AR', 'AP', 'Others')),
  invoice_no TEXT,
  currency TEXT NOT NULL,
  amount DECIMAL(18, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### 3.3 해외법인 페이지 (Entity View)

#### 3.3.1 Main Page

**화면 구성**:
```
┌──────────────────────────────────────────────────────────┐
│ US Corp - Intercompany Balance                           │
│ Year: [2024 ▼]  Month: [January ▼]                      │
├──────────────────────────────────────────────────────────┤
│ Counterparty │   AR    │   AP    │ Others │ Match       │
├──────────────┼─────────┼─────────┼────────┼─────────────┤
│ Korea HQ     │ 100,000 │  50,000 │      - │ 🟢 Matched  │
│ EU NL        │  75,000 │ 120,000 │  5,000 │ 🔵 Pending  │
│ Turkey       │       - │  30,000 │      - │ 🔴 No Data  │
│ Japan        │  20,000 │       - │      - │ 🔵 Pending  │
├──────────────┼─────────┼─────────┼────────┼─────────────┤
│ Total        │ 195,000 │ 200,000 │  5,000 │             │
└──────────────────────────────────────────────────────────┘
```

**기능 명세**:
- **조회 기준**: 연도, 월
- **데이터 표시**:
  - AR: 상대방 Entity가 본인을 counterparty로 지정하고 AR로 입력한 금액의 합
  - AP: 상대방 Entity가 본인을 counterparty로 지정하고 AP로 입력한 금액의 합
  - Others: 기타 항목 (매칭 대상 아님)
- **Match 상태**:
  - 🟢 초록색: AR ↔ AP 금액 일치
  - 🔵 파란색: 한쪽만 제출 또는 금액 불일치
  - 🔴 빨간색: 양쪽 모두 미제출

**매칭 검증 로직**:
```javascript
// 예시: US Corp와 Korea HQ 간 매칭 검증
function validateMatch(usCorpData, koreaHQData) {
  // US Corp가 입력한 Korea HQ에 대한 AR
  const usAR = usCorpData.find(d => 
    d.counterparty === 'Korea HQ' && d.type === 'AR'
  )?.amount || 0;
  
  // Korea HQ가 입력한 US Corp에 대한 AP
  const koreaAP = koreaHQData.find(d => 
    d.counterparty === 'US Corp' && d.type === 'AP'
  )?.amount || 0;
  
  // US Corp가 입력한 Korea HQ에 대한 AP
  const usAP = usCorpData.find(d => 
    d.counterparty === 'Korea HQ' && d.type === 'AP'
  )?.amount || 0;
  
  // Korea HQ가 입력한 US Corp에 대한 AR
  const koreaAR = koreaHQData.find(d => 
    d.counterparty === 'US Corp' && d.type === 'AR'
  )?.amount || 0;
  
  // 매칭 검증: AR ↔ AP 쌍방향 일치
  const isMatched = (usAR === koreaAP) && (usAP === koreaAR);
  
  return {
    isMatched,
    usAR,
    koreaAP,
    usAP,
    koreaAR,
    difference: Math.abs(usAR - koreaAP) + Math.abs(usAP - koreaAR)
  };
}
```

---

#### 3.3.2 Submission Page

**화면 구성**:
```
┌──────────────────────────────────────────────────────────┐
│ US Corp - Submit Balance                                │
│ Year: [2024 ▼]  Month: [January ▼]                      │
├──────────────────────────────────────────────────────────┤
│ [📥 Download Template] [📤 Upload File] [➕ Add Line]   │
├──────────────────────────────────────────────────────────┤
│ Invoice  │ Counter- │ Account│ Invoice │ Curr-  │ Amount │
│ Date     │ party    │ Type   │ No      │ ency   │        │
├──────────┼──────────┼────────┼─────────┼────────┼────────┤
│2024-01-15│Korea HQ ▼│ AR ▼   │INV-001  │  USD   │100,000 │
│2024-01-20│EU NL ▼   │ AP ▼   │INV-002  │  EUR   │ 75,000 │
│          │          │        │         │        │ [🗑️]   │
└──────────────────────────────────────────────────────────┘
                               [Save] [Cancel]
```

**기능 명세**:

**1) 직접 입력 (Manual Entry)**
- **추가 버튼**: "➕ Add Line" 클릭 시 빈 행 추가
- **컬럼 구성**:
  | 컬럼명 | 타입 | 필수 | 제약사항 |
  |--------|------|------|----------|
  | Invoice Date | Date Picker | ❌ | 과거 날짜만 선택 가능 |
  | Counterparty | Dropdown | ✅ | Entity 리스트에서 선택 |
  | Account Type | Dropdown | ✅ | AR / AP / Others |
  | Invoice No | Text Input | ❌ | 최대 50자 |
  | Currency | Text Input | ✅ | 3자리 통화 코드 (USD, EUR, KRW 등) |
  | Amount | Number Input | ✅ | 소수점 둘째 자리, 천 단위 구분 기호 |
  | Description | Text Area | ❌ | 최대 500자 |

- **삭제 기능**: 각 행 우측 🗑️ 아이콘 클릭 시 해당 행 삭제
- **검증 규칙**:
  - 필수값 누락 시: "필수값을 모두 입력하시기 바랍니다" 팝업
  - Counterparty가 Entity 리스트에 없는 경우: "유효하지 않은 Entity입니다" 팝업
  - Amount가 0 이하인 경우: "금액은 0보다 커야 합니다" 팝업
  - Currency가 3자리가 아닌 경우: "통화 코드는 3자리여야 합니다" 팝업

**2) 파일 업로드 (File Upload)**
- **템플릿 다운로드**: "📥 Download Template" 클릭 시 Excel 양식 다운로드
  ```
  Excel Template 구조:
  | Invoice Date | Counterparty | Account Type | Invoice No | Currency | Amount | Description |
  |--------------|--------------|--------------|------------|----------|--------|-------------|
  | 2024-01-15   | Korea HQ     | AR           | INV-001    | USD      | 100000 | Payment for... |
  ```

- **파일 업로드**: "📤 Upload File" 클릭
  - 지원 형식: .xlsx, .xls
  - 최대 파일 크기: 10MB
  - 최대 행 수: 1,000개
  
- **파일 검증 로직**:
  ```javascript
  async function validateUploadedFile(file) {
    const errors = [];
    
    // 1. 파일 형식 검증
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      errors.push('Only .xlsx or .xls files are allowed');
    }
    
    // 2. 파일 크기 검증
    if (file.size > 10 * 1024 * 1024) {
      errors.push('File size must be less than 10MB');
    }
    
    // 3. 데이터 파싱
    const data = await parseExcel(file);
    
    // 4. 필수 컬럼 존재 확인
    const requiredColumns = ['Counterparty', 'Account Type', 'Currency', 'Amount'];
    const missingColumns = requiredColumns.filter(col => !data.columns.includes(col));
    if (missingColumns.length > 0) {
      errors.push(`Missing required columns: ${missingColumns.join(', ')}`);
    }
    
    // 5. 각 행 검증
    data.rows.forEach((row, index) => {
      // Counterparty 검증
      if (!validEntities.includes(row.Counterparty)) {
        errors.push(`Row ${index + 2}: Invalid counterparty "${row.Counterparty}"`);
      }
      
      // Account Type 검증
      if (!['AR', 'AP', 'Others'].includes(row['Account Type'])) {
        errors.push(`Row ${index + 2}: Invalid account type "${row['Account Type']}"`);
      }
      
      // Currency 검증
      if (!row.Currency || row.Currency.length !== 3) {
        errors.push(`Row ${index + 2}: Invalid currency code "${row.Currency}"`);
      }
      
      // Amount 검증
      if (!row.Amount || isNaN(row.Amount) || row.Amount <= 0) {
        errors.push(`Row ${index + 2}: Invalid amount "${row.Amount}"`);
      }
    });
    
    return errors;
  }
  ```

- **오류 처리**:
  - 검증 실패 시: 오류 목록을 팝업으로 표시
  - 성공 시: 데이터 미리보기 화면으로 이동 → 확인 후 저장

**3) 저장 프로세스**
```
[저장 버튼 클릭]
    ↓
[필수값 검증]
    ↓
[중복 데이터 확인]
    ↓
[Submission 레코드 생성]
    ↓
[Submission Details 레코드 생성]
    ↓
[매칭 상태 재계산]
    ↓
[Main Page 데이터 업데이트]
    ↓
[관리자 페이지 상태 업데이트]
    ↓
[성공 메시지 표시]
```

**저장 트랜잭션 예시**:
```sql
BEGIN;

-- 1. Submission 메인 레코드 생성
INSERT INTO submissions (
  entity_id, 
  fiscal_year, 
  fiscal_month, 
  submission_type,
  total_items
) VALUES (
  'entity-uuid',
  2024,
  1,
  'manual', -- or 'file'
  10
) RETURNING id INTO submission_id;

-- 2. Submission Details 생성
INSERT INTO submission_details (
  submission_id,
  invoice_date,
  counterparty_entity_id,
  account_type,
  invoice_no,
  currency,
  amount,
  description
) VALUES
  (submission_id, '2024-01-15', 'counterparty-uuid', 'AR', 'INV-001', 'USD', 100000, 'Payment'),
  (submission_id, '2024-01-20', 'counterparty-uuid', 'AP', 'INV-002', 'EUR', 75000, 'Purchase');

-- 3. 매칭 상태 재계산
UPDATE submissions 
SET match_status = calculate_match_status(submission_id)
WHERE id = submission_id;

COMMIT;
```

---

### 3.4 중요 기능: 자동 매칭 로직

**매칭 규칙**:
1. **양방향 검증**: A의 AR = B의 AP AND A의 AP = B의 AR
2. **통화 일치**: 같은 통화끼리만 매칭 (USD ↔ USD, EUR ↔ EUR)
3. **금액 허용 오차**: ±0.01 범위 내 일치 (부동소수점 오차 고려)
4. **Others 제외**: Account Type이 "Others"인 항목은 매칭 대상에서 제외

**매칭 알고리즘 Pseudo Code**:
```python
def calculate_match_status(entity_a, entity_b, year, month):
    # 1. Entity A가 입력한 Entity B에 대한 AR/AP 합계
    a_to_b_ar = sum_amount(
        entity=entity_a, 
        counterparty=entity_b, 
        account_type='AR',
        year=year,
        month=month
    )
    
    a_to_b_ap = sum_amount(
        entity=entity_a, 
        counterparty=entity_b, 
        account_type='AP',
        year=year,
        month=month
    )
    
    # 2. Entity B가 입력한 Entity A에 대한 AR/AP 합계
    b_to_a_ar = sum_amount(
        entity=entity_b, 
        counterparty=entity_a, 
        account_type='AR',
        year=year,
        month=month
    )
    
    b_to_a_ap = sum_amount(
        entity=entity_b, 
        counterparty=entity_a, 
        account_type='AP',
        year=year,
        month=month
    )
    
    # 3. 매칭 검증 (허용 오차 ±0.01)
    ar_ap_matched = abs(a_to_b_ar - b_to_a_ap) <= 0.01
    ap_ar_matched = abs(a_to_b_ap - b_to_a_ar) <= 0.01
    
    # 4. 상태 결정
    if a_to_b_ar == 0 and a_to_b_ap == 0 and b_to_a_ar == 0 and b_to_a_ap == 0:
        return 'no_data'  # 🔴 빨간색
    elif ar_ap_matched and ap_ar_matched:
        return 'matched'  # 🟢 초록색
    else:
        return 'pending'  # 🔵 파란색
```

**통화별 매칭 예시**:
```
Korea HQ → US Corp:
  - AR: USD 100,000
  - AP: USD 50,000

US Corp → Korea HQ:
  - AR: USD 50,000
  - AP: USD 100,000

✅ 매칭 성공: 
  - Korea AR (100,000) = US AP (100,000)
  - Korea AP (50,000) = US AR (50,000)
```

---

## 4. 비기능 요구사항

### 4.1 성능 요구사항
- **페이지 로딩 시간**: 3초 이내
- **파일 업로드 처리 시간**: 1,000행 기준 10초 이내
- **동시 사용자**: 최소 50명 동시 접속 지원
- **데이터베이스 쿼리**: 단일 쿼리 1초 이내 응답

### 4.2 보안 요구사항
- **인증**: Entity별 비밀번호 인증 (향후 SSO 연동 고려)
- **세션 관리**: JWT 토큰 기반, 30분 타임아웃
- **권한 제어**: Row Level Security (RLS) 적용
- **데이터 암호화**: 
  - 전송 중: HTTPS/TLS 1.3
  - 저장 중: 비밀번호 bcrypt 해싱
- **감사 로그**: 모든 데이터 변경 이력 기록

**Supabase RLS 정책 예시**:
```sql
-- 해외법인은 본인 Entity 데이터만 조회
CREATE POLICY "Entity users can only view own data"
ON submission_details
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM submissions s
    JOIN entities e ON s.entity_id = e.id
    WHERE s.id = submission_details.submission_id
    AND e.id = auth.uid()::uuid
  )
);

-- 관리자는 모든 데이터 조회 가능
CREATE POLICY "Admins can view all data"
ON submission_details
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM entities
    WHERE id = auth.uid()::uuid
    AND is_admin = TRUE
  )
);
```

### 4.3 사용성 요구사항
- **반응형 디자인**: 데스크톱, 태블릿 지원 (모바일 우선순위 낮음)
- **브라우저 호환성**: Chrome, Edge, Safari 최신 2개 버전
- **접근성**: WCAG 2.1 Level AA 준수
- **다국어**: 한국어, 영어 지원 (UI 라벨, 오류 메시지)

### 4.4 데이터 요구사항
- **데이터 보존**: 최소 7년 (감사 목적)
- **백업**: 일 1회 자동 백업, 30일 보관
- **복구 시간 목표 (RTO)**: 4시간
- **복구 시점 목표 (RPO)**: 24시간

---

## 5. 기술 스택

### 5.1 프론트엔드
- **프레임워크**: Next.js 14 (App Router)
- **언어**: TypeScript
- **UI 라이브러리**: 
  - Tailwind CSS
  - shadcn/ui (Button, Dialog, Dropdown, Table 등)
- **상태 관리**: React Context API + Zustand (필요시)
- **데이터 페칭**: Supabase Client + SWR
- **파일 처리**: SheetJS (xlsx)
- **드래그 앤 드롭**: @dnd-kit/core

### 5.2 백엔드
- **Database**: Supabase (PostgreSQL)
- **인증**: Supabase Auth + Custom Entity Authentication
- **스토리지**: Supabase Storage (파일 업로드용)
- **API**: Supabase Database Functions + Edge Functions

### 5.3 배포 및 인프라
- **호스팅**: Vercel
- **데이터베이스**: Supabase Cloud
- **모니터링**: Vercel Analytics + Supabase Dashboard
- **에러 추적**: Sentry (선택사항)

---

## 6. 데이터 모델

### 6.1 ERD (Entity Relationship Diagram)
```
┌─────────────────┐
│    entities     │
├─────────────────┤
│ id (PK)         │
│ entity_name     │
│ entity_code     │
│ password_hash   │
│ is_admin        │
│ display_order   │
└─────────────────┘
        │
        │ 1:N
        ↓
┌─────────────────┐
│  submissions    │
├─────────────────┤
│ id (PK)         │
│ entity_id (FK)  │
│ fiscal_year     │
│ fiscal_month    │
│ submission_type │
│ file_path       │
│ total_items     │
│ match_status    │
└─────────────────┘
        │
        │ 1:N
        ↓
┌──────────────────────┐
│ submission_details   │
├──────────────────────┤
│ id (PK)              │
│ submission_id (FK)   │
│ invoice_date         │
│ counterparty_id (FK) │
│ account_type         │
│ invoice_no           │
│ currency             │
│ amount               │
│ description          │
└──────────────────────┘

┌─────────────────┐
│  audit_logs     │
├─────────────────┤
│ id (PK)         │
│ entity_id (FK)  │
│ action_type     │
│ target_id       │
│ old_value       │
│ new_value       │
│ changed_at      │
└─────────────────┘
```

### 6.2 전체 SQL 스키마
```sql
-- Entities 테이블
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_name TEXT NOT NULL UNIQUE,
  entity_code TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Submissions 테이블
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL CHECK (fiscal_year >= 2020),
  fiscal_month INTEGER NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
  submission_type TEXT NOT NULL CHECK (submission_type IN ('file', 'manual')),
  submission_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_path TEXT,
  total_items INTEGER DEFAULT 0,
  match_status TEXT DEFAULT 'pending' CHECK (match_status IN ('pending', 'matched', 'mismatched', 'no_data')),
  submitted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 복합 인덱스
  CONSTRAINT unique_submission UNIQUE (entity_id, fiscal_year, fiscal_month)
);

-- Submission Details 테이블
CREATE TABLE submission_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  invoice_date DATE,
  counterparty_entity_id UUID NOT NULL REFERENCES entities(id),
  account_type TEXT NOT NULL CHECK (account_type IN ('AR', 'AP', 'Others')),
  invoice_no TEXT,
  currency TEXT NOT NULL CHECK (LENGTH(currency) = 3),
  amount DECIMAL(18, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs 테이블
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id),
  action_type TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_submissions_entity_date ON submissions(entity_id, fiscal_year, fiscal_month);
CREATE INDEX idx_submission_details_submission ON submission_details(submission_id);
CREATE INDEX idx_submission_details_counterparty ON submission_details(counterparty_entity_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_id, changed_at DESC);

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

---

## 7. UI/UX 설계

### 7.1 색상 체계
- **Primary**: Blue (#3B82F6) - 제출 완료
- **Success**: Green (#10B981) - 매칭 완료
- **Warning**: Yellow (#F59E0B) - 확인 중
- **Danger**: Red (#EF4444) - 미제출/오류
- **Neutral**: Gray (#6B7280) - 기본 텍스트

### 7.2 타이포그래피
- **제목 (H1)**: 24px, Bold
- **부제목 (H2)**: 20px, SemiBold
- **본문**: 16px, Regular
- **캡션**: 14px, Regular

### 7.3 컴포넌트 디자인 가이드

**원형 상태 아이콘**:
```jsx
// 상태별 원형 컴포넌트
<StatusCircle status="matched" />   // 🟢 초록색
<StatusCircle status="pending" />   // 🔵 파란색
<StatusCircle status="no_data" />   // 🔴 빨간색

// CSS
.status-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.status-circle.matched { background-color: #10B981; }
.status-circle.pending { background-color: #3B82F6; }
.status-circle.no_data { background-color: #EF4444; }

.status-circle:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
```

**데이터 테이블**:
- 헤더: 회색 배경 (#F9FAFB)
- 행 구분선: 얇은 회색 (#E5E7EB)
- Hover 효과: 연한 파란색 배경 (#EFF6FF)
- 정렬 가능한 컬럼: 화살표 아이콘 표시

---

## 8. 예외 처리 및 에러 핸들링

### 8.1 오류 유형 및 처리 방안

| 오류 유형 | 예시 상황 | 사용자 메시지 | 시스템 처리 |
|-----------|-----------|---------------|-------------|
| 인증 실패 | 잘못된 비밀번호 | "Please enter your password" | 3회 실패 시 5분 잠금 |
| 필수값 누락 | Amount 미입력 | "필수값을 모두 입력하시기 바랍니다" | 저장 중단, 해당 필드 하이라이트 |
| 파일 형식 오류 | .pdf 업로드 | "Only .xlsx or .xls files are allowed" | 업로드 거부 |
| 파일 크기 초과 | 15MB 파일 | "File size must be less than 10MB" | 업로드 거부 |
| 네트워크 오류 | API 타임아웃 | "네트워크 오류가 발생했습니다. 다시 시도해주세요" | 자동 재시도 3회 |
| 서버 오류 | 500 에러 | "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요" | 에러 로그 기록, 개발팀 알림 |
| 중복 제출 | 같은 연도/월 재제출 | "이미 제출된 데이터가 있습니다. 덮어쓰시겠습니까?" | 확인 후 기존 데이터 업데이트 |

### 8.2 에러 메시지 설계
```typescript
// 에러 메시지 상수 정의
export const ERROR_MESSAGES = {
  AUTH_FAILED: {
    ko: "비밀번호가 올바르지 않습니다",
    en: "Please enter your password"
  },
  REQUIRED_FIELDS: {
    ko: "필수값을 모두 입력하시기 바랍니다",
    en: "Please fill in all required fields"
  },
  INVALID_ENTITY: {
    ko: "유효하지 않은 Entity입니다",
    en: "Invalid entity selected"
  },
  FILE_FORMAT_ERROR: {
    ko: ".xlsx 또는 .xls 파일만 업로드 가능합니다",
    en: "Only .xlsx or .xls files are allowed"
  },
  FILE_SIZE_ERROR: {
    ko: "파일 크기는 10MB 이하여야 합니다",
    en: "File size must be less than 10MB"
  },
  NETWORK_ERROR: {
    ko: "네트워크 오류가 발생했습니다. 다시 시도해주세요",
    en: "Network error occurred. Please try again"
  },
  SERVER_ERROR: {
    ko: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요",
    en: "Temporary error occurred. Please try again later"
  }
};
```

### 8.3 에러 로깅
```typescript
// Supabase Edge Function으로 에러 로깅
export async function logError(error: Error, context: any) {
  await supabase.from('error_logs').insert({
    error_message: error.message,
    error_stack: error.stack,
    context: JSON.stringify(context),
    user_agent: navigator.userAgent,
    timestamp: new Date().toISOString()
  });
}
```

---

## 9. 테스트 계획

### 9.1 단위 테스트 (Unit Test)
- **매칭 로직**: calculate_match_status 함수
- **파일 검증 로직**: validateUploadedFile 함수
- **데이터 변환**: Excel 파싱, 데이터 정규화

### 9.2 통합 테스트 (Integration Test)
- **API 엔드포인트**: Submission 생성, 조회, 업데이트
- **데이터베이스 트랜잭션**: 저장 시 RLS 정책 적용 확인
- **파일 업로드**: Storage 연동 테스트

### 9.3 E2E 테스트 (End-to-End Test)
- **시나리오 1**: 관리자 로그인 → Monthly View 조회 → Entity View 전환
- **시나리오 2**: 해외법인 로그인 → 데이터 직접 입력 → 저장 → Main Page 확인
- **시나리오 3**: 해외법인 로그인 → 파일 업로드 → 검증 오류 → 수정 후 재업로드
- **시나리오 4**: 양쪽 법인이 데이터 입력 → 매칭 상태 변화 확인

### 9.4 사용자 수용 테스트 (UAT)
- **참여자**: 본사 재무팀, 주요 해외법인 담당자 3~5명
- **기간**: 2주
- **평가 항목**:
  - 사용 편의성
  - 매칭 정확도
  - 응답 속도
  - 오류 처리 적절성

---

## 10. 릴리스 계획

### 10.1 개발 일정

| 단계 | 작업 내용 | 기간 | 담당자 |
|------|-----------|------|--------|
| Phase 1 | 요구사항 확정, 디자인 | 1주 | PM, Designer |
| Phase 2 | DB 스키마 설계, 인프라 구축 | 1주 | Backend Dev |
| Phase 3 | 인증/권한 시스템 구현 | 1주 | Backend Dev |
| Phase 4 | 관리자 페이지 개발 | 2주 | Frontend Dev |
| Phase 5 | 해외법인 페이지 개발 | 2주 | Frontend Dev |
| Phase 6 | 매칭 로직 구현 | 1주 | Backend Dev |
| Phase 7 | 파일 업로드 기능 구현 | 1주 | Full Stack Dev |
| Phase 8 | 통합 테스트 | 1주 | QA |
| Phase 9 | UAT | 2주 | All |
| Phase 10 | 버그 수정 및 배포 준비 | 1주 | All |
| **총 기간** | | **13주 (약 3개월)** | |

### 10.2 마일스톤

- **M1 (Week 3)**: DB 스키마 완료, 인프라 구축 완료
- **M2 (Week 6)**: 관리자 페이지 MVP 완료
- **M3 (Week 9)**: 해외법인 페이지 MVP 완료, 매칭 로직 완료
- **M4 (Week 12)**: 전체 기능 통합 완료, UAT 시작
- **M5 (Week 13)**: 프로덕션 배포

### 10.3 롤아웃 전략
1. **Soft Launch (Week 13)**: 본사 + 주요 해외법인 3곳 (US, EU, China)
2. **Full Launch (Week 14)**: 전체 해외법인 확대
3. **모니터링**: 첫 2주간 집중 모니터링, 일일 버그 리뷰 회의

---

## 11. 유지보수 및 향후 계획

### 11.1 모니터링 지표
- **시스템 가동률**: 99% 이상
- **평균 응답 시간**: 2초 이내
- **일일 활성 사용자**: 목표 30명
- **월별 제출 완료율**: 목표 95%
- **매칭 정확도**: 목표 98%

### 11.2 향후 개선 사항 (Phase 2)
1. **ERP 연동**: SAP, Oracle 등 ERP 시스템과 자동 데이터 동기화
2. **자동 알림**: 
   - 제출 기한 임박 시 이메일/슬랙 알림
   - 매칭 불일치 발견 시 담당자 알림
3. **대시보드 고도화**:
   - 트렌드 분석 (월별 AR/AP 변화 추이)
   - 법인별 제출 준수율 리포트
4. **모바일 앱**: 간단한 승인 및 조회 기능
5. **AI 기반 이상거래 탐지**: 비정상적인 금액 패턴 자동 감지

### 11.3 기술 부채 관리
- **코드 리뷰**: 모든 PR에 대해 2명 이상 리뷰 필수
- **리팩토링**: 분기당 1주 리팩토링 스프린트
- **문서화**: API 문서, 사용자 가이드 지속 업데이트

---

## 12. 부록

### 12.1 용어 정의
- **AR (Accounts Receivable)**: 외상 매출금, 채권
- **AP (Accounts Payable)**: 외상 매입금, 채무
- **Intercompany**: 계열사 간, 그룹사 간
- **Reconciliation**: 대사, 대조
- **Entity**: 법인, 계열사
- **Match**: 매칭, 일치 확인
- **RLS (Row Level Security)**: 행 수준 보안

### 12.2 참고 자료
- Supabase 공식 문서: https://supabase.com/docs
- Next.js 공식 문서: https://nextjs.org/docs
- shadcn/ui 컴포넌트: https://ui.shadcn.com
- SheetJS 문서: https://docs.sheetjs.com

### 12.3 FAQ

**Q1: 같은 연도/월에 여러 번 제출할 수 있나요?**
A: 네, 가능합니다. 기존 데이터를 덮어쓰거나 추가할 수 있습니다. 단, 기존 데이터는 이력으로 보관됩니다.

**Q2: 통화가 다른 경우 자동 환산되나요?**
A: 현재 버전에서는 지원하지 않습니다. 각 법인이 동일한 통화로 입력해야 매칭됩니다.

**Q3: 파일 업로드 시 최대 몇 개까지 입력할 수 있나요?**
A: 한 번에 최대 1,000개 행까지 가능합니다.

**Q4: 관리자가 수동으로 매칭 상태를 변경할 수 있나요?**
A: 네, "Admin Edit Mode"를 활성화하면 빨간색을 파란색으로 변경할 수 있습니다 (AR/AP 없는 경우에 한함).

**Q5: 데이터 삭제가 가능한가요?**
A: 관리자는 삭제 가능하며, 삭제 시 감사 로그에 기록됩니다. 해외법인 사용자는 본인이 입력한 데이터만 삭제 가능합니다.

---

## 13. 승인

| 역할 | 이름 | 서명 | 날짜 |
|------|------|------|------|
| Product Manager | [이름] | | |
| Engineering Lead | [이름] | | |
| Finance Director | [이름] | | |
| CFO | [이름] | | |

---

**변경 이력**

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 1.0 | 2025-01-20 | 초안 작성 | [작성자명] |
| | | | |