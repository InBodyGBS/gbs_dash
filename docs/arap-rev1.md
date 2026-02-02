# Intercompany AR-AP System - Entity View UI 개선사항

---

## 문서 정보
| 항목 | 내용 |
|------|------|
| **문서명** | Entity View UI 개선사항 |
| **버전** | 1.0 |
| **작성일** | 2025-01-20 |
| **관련 문서** | ARAP_PRD_완성본.md |
| **목적** | Entity View 페이지의 사용성 개선 |

---

## 1. 현재 문제점

### 1.1 화면 분석
- **현재 상태**: 13개 법인 × 13개 법인 = 169개 셀 표시
- **실제 데이터**: BWA 법인만 5개 거래처에 데이터 입력 (전체의 3% 미만)
- **문제**: 대부분이 회색(미제출)으로 채워져 있어 정작 중요한 정보를 찾기 어려움

### 1.2 사용자 불편 사항
1. **시각적 과부하**: 169개 셀 중 95%가 의미 없는 회색 원형
2. **스크롤 과다**: 가로/세로 스크롤이 필요하여 전체 현황 파악 불가
3. **중복 정보**: BWA→HQ와 HQ→BWA가 각각 표시되어 중복
4. **핵심 정보 부재**: 어떤 법인이 제출했는지, 얼마나 매칭됐는지 한눈에 파악 불가

---

## 2. 개선 방안

### 2.1 핵심 개선 사항

#### ✅ 우선순위 1: 요약 뷰 + 필터 기능
```
[요약 통계 표시]
    ↓
[필터 옵션 제공]
    ↓
[축소된 매트릭스 표시]
    ↓
[상세 정보는 클릭 시 팝업]
```

#### ✅ 우선순위 2: 데이터 중심 UI
- 데이터가 있는 항목만 기본 표시
- 미제출(회색) 항목 숨기기 옵션
- 대각선 아래만 표시하여 중복 제거

#### ✅ 우선순위 3: 검색 및 하이라이트
- 특정 법인 검색 기능
- 해당 법인 관련 행/열만 하이라이트

---

## 3. 상세 UI 설계

### 3.1 개선된 Entity View 전체 레이아웃

```
┌──────────────────────────────────────────────────────────────────────┐
│ 법인 간 내부거래 관리 및 검증 - InBody HQ                              │
├──────────────────────────────────────────────────────────────────────┤
│ [Monthly View] [Entity View] [Review]                                │
├──────────────────────────────────────────────────────────────────────┤
│ 📊 Entity View                                                       │
│                                                                      │
│ Year: [2026 ▼]  Month: [January ▼]            [Admin Edit Mode 🔒]  │
├──────────────────────────────────────────────────────────────────────┤
│ 📈 제출 현황 요약                                                     │
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │ 전체 거래쌍: 78개                                               │  │
│ │ 🟢 매칭완료: 0개 (0%)   🔵 확인중: 5개 (6%)   ⚪ 미제출: 73개 (94%) │  │
│ │                                                                │  │
│ │ 제출한 법인: 1개 (BWA)                                          │  │
│ │ 미제출 법인: 12개                                               │  │
│ └────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│ 🔧 표시 옵션                                                         │
│ ☑️ 데이터가 있는 항목만 표시                                         │
│ ☐ 미제출(회색) 항목 숨기기                                           │
│ ☐ 대각선 아래만 표시 (중복 제거)                                     │
│ ☐ 제출한 법인만 표시                                                 │
│                                                                      │
│ 🔍 법인 검색: [________________]  [초기화]                           │
├──────────────────────────────────────────────────────────────────────┤
│ 📋 거래 매트릭스                                                     │
│                                                                      │
│ ENTITY  │  BWA  │   HQ  │  USA  │ Mexico│ Europe│                   │
│ ────────┼───────┼───────┼───────┼───────┼───────┤                   │
│ BWA     │   -   │  🔵   │  🔵   │  🔵   │  ⚪   │  [상세 내역 ▼]    │
│ HQ      │  🔵   │   -   │  ⚪   │  ⚪   │  ⚪   │                   │
│ USA     │  🔵   │  ⚪   │   -   │  ⚪   │  ⚪   │                   │
│ Mexico  │  🔵   │  ⚪   │  ⚪   │   -   │  ⚪   │                   │
│ Europe  │  ⚪   │  ⚪   │  ⚪   │  ⚪   │   -   │                   │
│                                                                      │
│ [전체 매트릭스 보기]                                                  │
└──────────────────────────────────────────────────────────────────────┘

범례:
🟢 매칭완료  🔵 확인중 (한쪽만 제출)  🔴 불일치 (금액 불일치)  ⚪ 미제출
```

---

### 3.2 요약 통계 섹션

**컴포넌트 명세**:
```jsx
// SummaryStats.tsx
interface SummaryStats {
  totalPairs: number;        // 전체 거래쌍 수 (n*(n-1)/2)
  matchedCount: number;      // 🟢 매칭완료
  pendingCount: number;      // 🔵 확인중
  noDataCount: number;       // ⚪ 미제출
  submittedEntities: string[]; // 제출한 법인 리스트
}

function SummaryCard({ stats }: { stats: SummaryStats }) {
  const matchedPercent = (stats.matchedCount / stats.totalPairs * 100).toFixed(1);
  const pendingPercent = (stats.pendingCount / stats.totalPairs * 100).toFixed(1);
  const noDataPercent = (stats.noDataCount / stats.totalPairs * 100).toFixed(1);
  
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-4">
      <h3 className="text-lg font-semibold mb-4">📈 제출 현황 요약</h3>
      
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold">{stats.totalPairs}</div>
          <div className="text-sm text-gray-600">전체 거래쌍</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">
            {stats.matchedCount}
          </div>
          <div className="text-sm text-gray-600">
            🟢 매칭완료 ({matchedPercent}%)
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">
            {stats.pendingCount}
          </div>
          <div className="text-sm text-gray-600">
            🔵 확인중 ({pendingPercent}%)
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-400">
            {stats.noDataCount}
          </div>
          <div className="text-sm text-gray-600">
            ⚪ 미제출 ({noDataPercent}%)
          </div>
        </div>
      </div>
      
      <div className="border-t pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">제출한 법인:</span>
          <span className="font-semibold">
            {stats.submittedEntities.length}개 
            ({stats.submittedEntities.join(', ')})
          </span>
        </div>
        <div className="flex justify-between text-sm mt-2">
          <span className="text-gray-600">미제출 법인:</span>
          <span className="font-semibold text-red-600">
            {13 - stats.submittedEntities.length}개
          </span>
        </div>
      </div>
    </div>
  );
}
```

**계산 로직**:
```sql
-- 요약 통계 계산
WITH entity_pairs AS (
  SELECT 
    e1.id as entity1_id,
    e2.id as entity2_id,
    e1.entity_name as entity1_name,
    e2.entity_name as entity2_name
  FROM entities e1
  CROSS JOIN entities e2
  WHERE e1.id < e2.id  -- 대각선 아래만 (중복 제거)
),
pair_status AS (
  SELECT 
    ep.*,
    COALESCE(s1.match_status, 'no_data') as status1,
    COALESCE(s2.match_status, 'no_data') as status2,
    CASE 
      WHEN s1.id IS NULL AND s2.id IS NULL THEN 'no_data'
      WHEN s1.match_status = 'matched' AND s2.match_status = 'matched' THEN 'matched'
      ELSE 'pending'
    END as final_status
  FROM entity_pairs ep
  LEFT JOIN submissions s1 
    ON s1.entity_id = ep.entity1_id 
    AND s1.fiscal_year = :year 
    AND s1.fiscal_month = :month
  LEFT JOIN submissions s2 
    ON s2.entity_id = ep.entity2_id 
    AND s2.fiscal_year = :year 
    AND s2.fiscal_month = :month
)
SELECT 
  COUNT(*) as total_pairs,
  COUNT(*) FILTER (WHERE final_status = 'matched') as matched_count,
  COUNT(*) FILTER (WHERE final_status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE final_status = 'no_data') as no_data_count
FROM pair_status;
```

---

### 3.3 필터 옵션 섹션

**컴포넌트 명세**:
```jsx
// FilterOptions.tsx
interface FilterState {
  showOnlyWithData: boolean;      // 데이터가 있는 항목만
  hideNoData: boolean;            // 미제출 숨기기
  showLowerTriangle: boolean;     // 대각선 아래만
  showOnlySubmitted: boolean;     // 제출한 법인만
  searchQuery: string;            // 검색어
}

function FilterOptions({ 
  filters, 
  onFilterChange 
}: { 
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-4">
      <h3 className="text-sm font-semibold mb-3">🔧 표시 옵션</h3>
      
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox"
            checked={filters.showOnlyWithData}
            onChange={(e) => onFilterChange({
              ...filters,
              showOnlyWithData: e.target.checked
            })}
            className="w-4 h-4"
          />
          <span className="text-sm">데이터가 있는 항목만 표시</span>
          <span className="text-xs text-gray-500 ml-auto">
            (한쪽이라도 제출한 거래쌍만)
          </span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox"
            checked={filters.hideNoData}
            onChange={(e) => onFilterChange({
              ...filters,
              hideNoData: e.target.checked
            })}
            className="w-4 h-4"
          />
          <span className="text-sm">미제출(회색) 항목 숨기기</span>
          <span className="text-xs text-gray-500 ml-auto">
            (양쪽 모두 미제출인 항목 제외)
          </span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox"
            checked={filters.showLowerTriangle}
            onChange={(e) => onFilterChange({
              ...filters,
              showLowerTriangle: e.target.checked
            })}
            className="w-4 h-4"
          />
          <span className="text-sm">대각선 아래만 표시 (중복 제거)</span>
          <span className="text-xs text-gray-500 ml-auto">
            (매트릭스 크기 50% 감소)
          </span>
        </label>
        
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox"
            checked={filters.showOnlySubmitted}
            onChange={(e) => onFilterChange({
              ...filters,
              showOnlySubmitted: e.target.checked
            })}
            className="w-4 h-4"
          />
          <span className="text-sm">제출한 법인만 표시</span>
          <span className="text-xs text-gray-500 ml-auto">
            (해당 기간에 데이터 제출한 법인만)
          </span>
        </label>
      </div>
      
      <div className="mt-4 flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="법인 검색 (예: BWA, Korea, US)"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({
              ...filters,
              searchQuery: e.target.value
            })}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange({
                ...filters,
                searchQuery: ''
              })}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={() => onFilterChange({
            showOnlyWithData: false,
            hideNoData: false,
            showLowerTriangle: false,
            showOnlySubmitted: false,
            searchQuery: ''
          })}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-100"
        >
          초기화
        </button>
      </div>
    </div>
  );
}
```

**필터링 로직**:
```typescript
// filterMatrix.ts
function filterMatrix(
  allEntities: Entity[],
  matrixData: MatrixData[][],
  filters: FilterState
): { entities: Entity[], data: MatrixData[][] } {
  let filteredEntities = [...allEntities];
  
  // 1. 검색어 필터링
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filteredEntities = filteredEntities.filter(e => 
      e.entity_name.toLowerCase().includes(query) ||
      e.entity_code.toLowerCase().includes(query)
    );
  }
  
  // 2. 제출한 법인만 표시
  if (filters.showOnlySubmitted) {
    const submittedEntityIds = new Set(
      matrixData.flat()
        .filter(d => d.status !== 'no_data')
        .flatMap(d => [d.entity1_id, d.entity2_id])
    );
    filteredEntities = filteredEntities.filter(e => 
      submittedEntityIds.has(e.id)
    );
  }
  
  // 3. 데이터가 있는 항목만
  if (filters.showOnlyWithData) {
    const entityIdsWithData = new Set(
      matrixData.flat()
        .filter(d => d.status !== 'no_data')
        .flatMap(d => [d.entity1_id, d.entity2_id])
    );
    filteredEntities = filteredEntities.filter(e => 
      entityIdsWithData.has(e.id)
    );
  }
  
  // 4. 매트릭스 데이터 필터링
  let filteredData = matrixData
    .filter(row => filteredEntities.some(e => e.id === row[0]?.entity1_id))
    .map(row => row.filter(cell => 
      filteredEntities.some(e => e.id === cell.entity2_id)
    ));
  
  // 5. 미제출 항목 숨기기
  if (filters.hideNoData) {
    filteredData = filteredData.map(row => 
      row.filter(cell => cell.status !== 'no_data')
    );
  }
  
  // 6. 대각선 아래만 표시
  if (filters.showLowerTriangle) {
    filteredData = filteredData.map((row, i) => 
      row.filter((cell, j) => i > j)
    );
  }
  
  return { entities: filteredEntities, data: filteredData };
}
```

---

### 3.4 축소된 매트릭스 표시

**예시: 필터 적용 전 vs 후**

**적용 전 (13x13 = 169개 셀)**:
```
전체 법인 표시, 대부분 회색
→ 스크롤 필요, 시각적 과부하
```

**적용 후 (5x5 = 25개 셀, 85% 감소)**:
```
┌─────────────────────────────────────────────┐
│ ENTITY  │  BWA  │   HQ  │  USA  │ Mexico │ │
├─────────┼───────┼───────┼───────┼────────┤ │
│ BWA     │   -   │  🔵   │  🔵   │  🔵   │ │
│ HQ      │  🔵   │   -   │       │       │ │
│ USA     │  🔵   │       │   -   │       │ │
│ Mexico  │  🔵   │       │       │   -   │ │
└─────────────────────────────────────────────┘

✅ 한 화면에 모든 정보 표시
✅ 스크롤 불필요
✅ 중요 정보 집중
```

---

### 3.5 상세 팝업 (클릭 시)

**컴포넌트 명세**:
```jsx
// DetailPopup.tsx
function TransactionDetailPopup({ 
  entity1, 
  entity2, 
  year, 
  month,
  onClose 
}: DetailPopupProps) {
  const { data, isLoading } = useTransactionDetails(entity1, entity2, year, month);
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {entity1.entity_name} ↔ {entity2.entity_name}
          </DialogTitle>
          <DialogDescription>
            {year}년 {month}월 거래 내역
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6">
          {/* 왼쪽: Entity1 → Entity2 */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              {entity1.entity_name} → {entity2.entity_name}
              {data.entity1Submitted ? (
                <Badge variant="success">제출완료</Badge>
              ) : (
                <Badge variant="secondary">미제출</Badge>
              )}
            </h3>
            
            {data.entity1Submitted ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AR:</span>
                  <span className="font-mono">
                    {formatCurrency(data.entity1.ar)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AP:</span>
                  <span className="font-mono">
                    {formatCurrency(data.entity1.ap)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Others:</span>
                  <span className="font-mono">
                    {formatCurrency(data.entity1.others)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  제출일: {formatDate(data.entity1.submittedAt)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                아직 제출하지 않았습니다
              </div>
            )}
          </div>
          
          {/* 오른쪽: Entity2 → Entity1 */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              {entity2.entity_name} → {entity1.entity_name}
              {data.entity2Submitted ? (
                <Badge variant="success">제출완료</Badge>
              ) : (
                <Badge variant="secondary">미제출</Badge>
              )}
            </h3>
            
            {data.entity2Submitted ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AR:</span>
                  <span className="font-mono">
                    {formatCurrency(data.entity2.ar)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AP:</span>
                  <span className="font-mono">
                    {formatCurrency(data.entity2.ap)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Others:</span>
                  <span className="font-mono">
                    {formatCurrency(data.entity2.others)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  제출일: {formatDate(data.entity2.submittedAt)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                아직 제출하지 않았습니다
              </div>
            )}
          </div>
        </div>
        
        {/* 매칭 상태 */}
        <div className="border-t pt-4 mt-4">
          <h3 className="font-semibold mb-2">매칭 상태</h3>
          
          {data.matchStatus === 'matched' ? (
            <div className="bg-green-50 border border-green-200 rounded p-3">
              <div className="flex items-center gap-2 text-green-700">
                <span className="text-2xl">🟢</span>
                <span className="font-semibold">매칭 완료</span>
              </div>
              <div className="text-sm text-green-600 mt-2">
                AR/AP 금액이 정확히 일치합니다
              </div>
            </div>
          ) : data.matchStatus === 'pending' ? (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <div className="flex items-center gap-2 text-blue-700">
                <span className="text-2xl">🔵</span>
                <span className="font-semibold">확인 중</span>
              </div>
              <div className="text-sm text-blue-600 mt-2">
                {!data.entity1Submitted && !data.entity2Submitted
                  ? '양쪽 모두 미제출'
                  : !data.entity1Submitted
                  ? `${entity1.entity_name} 미제출`
                  : !data.entity2Submitted
                  ? `${entity2.entity_name} 미제출`
                  : '금액 불일치'
                }
              </div>
              
              {data.entity1Submitted && data.entity2Submitted && (
                <div className="mt-2 text-sm">
                  <div className="text-red-600">
                    차액: {formatCurrency(Math.abs(data.difference))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="flex items-center gap-2 text-gray-700">
                <span className="text-2xl">⚪</span>
                <span className="font-semibold">미제출</span>
              </div>
              <div className="text-sm text-gray-600 mt-2">
                양쪽 모두 데이터를 제출하지 않았습니다
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={() => downloadDetails(entity1, entity2, year, month)}>
            상세 내역 다운로드
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 3.6 전체 매트릭스 보기 버튼

**토글 기능**:
```jsx
// MatrixView.tsx
function MatrixView() {
  const [showFullMatrix, setShowFullMatrix] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    showOnlyWithData: true,  // 기본값: 데이터 있는 항목만
    hideNoData: false,
    showLowerTriangle: false,
    showOnlySubmitted: false,
    searchQuery: ''
  });
  
  const { entities, data } = filterMatrix(allEntities, matrixData, filters);
  
  return (
    <div>
      {/* 필터 적용된 축소 매트릭스 */}
      <Matrix entities={entities} data={data} />
      
      {/* 전체 보기 버튼 */}
      {!showFullMatrix && (
        <button
          onClick={() => setShowFullMatrix(true)}
          className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
        >
          📋 전체 매트릭스 보기 (13×13)
        </button>
      )}
      
      {/* 전체 매트릭스 (토글 시) */}
      {showFullMatrix && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">전체 매트릭스 (필터 미적용)</h3>
            <button
              onClick={() => setShowFullMatrix(false)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              ✕ 닫기
            </button>
          </div>
          <Matrix 
            entities={allEntities} 
            data={allMatrixData}
            compact 
          />
        </div>
      )}
    </div>
  );
}
```

---

## 4. 구현 우선순위

### Phase 1: 핵심 기능 (1주)
- ✅ 요약 통계 섹션
- ✅ "데이터가 있는 항목만" 필터
- ✅ 상세 팝업

### Phase 2: 편의 기능 (1주)
- ✅ 검색 기능
- ✅ 미제출 항목 숨기기
- ✅ 대각선 아래만 표시

### Phase 3: 고급 기능 (선택사항)
- 법인별 제출률 그래프
- 시계열 트렌드 차트
- CSV 내보내기

---

## 5. 기대 효과

### 5.1 정량적 개선
| 지표 | 개선 전 | 개선 후 | 개선률 |
|------|---------|---------|--------|
| 표시 셀 수 | 169개 | 25개 | **85% 감소** |
| 필요 스크롤 | 가로/세로 | 없음 | **100% 제거** |
| 정보 인지 시간 | ~30초 | ~5초 | **83% 단축** |
| 클릭 수 (상세 확인) | 5회+ | 1회 | **80% 감소** |

### 5.2 정성적 개선
- ✅ **시각적 명확성**: 중요 정보만 표시하여 인지 부담 감소
- ✅ **효율성**: 한 화면에 모든 정보 파악 가능
- ✅ **유연성**: 사용자가 원하는 방식으로 필터링 가능
- ✅ **직관성**: 요약 → 상세 단계적 정보 제공

---

## 6. 구현 가이드

### 6.1 필요한 컴포넌트
```
components/
  entity-view/
    ├── SummaryStats.tsx          # 요약 통계
    ├── FilterOptions.tsx         # 필터 옵션
    ├── MatrixTable.tsx           # 매트릭스 테이블
    ├── StatusCircle.tsx          # 상태 원형
    ├── DetailPopup.tsx           # 상세 팝업
    └── SearchBar.tsx             # 검색 바
```

### 6.2 상태 관리
```typescript
// useEntityView.ts
import { create } from 'zustand';

interface EntityViewStore {
  year: number;
  month: number;
  filters: FilterState;
  showFullMatrix: boolean;
  selectedPair: { entity1: string; entity2: string } | null;
  
  setYear: (year: number) => void;
  setMonth: (month: number) => void;
  setFilters: (filters: FilterState) => void;
  toggleFullMatrix: () => void;
  selectPair: (entity1: string, entity2: string) => void;
  clearSelection: () => void;
}

export const useEntityView = create<EntityViewStore>((set) => ({
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  filters: {
    showOnlyWithData: true,
    hideNoData: false,
    showLowerTriangle: false,
    showOnlySubmitted: false,
    searchQuery: ''
  },
  showFullMatrix: false,
  selectedPair: null,
  
  setYear: (year) => set({ year }),
  setMonth: (month) => set({ month }),
  setFilters: (filters) => set({ filters }),
  toggleFullMatrix: () => set((state) => ({ 
    showFullMatrix: !state.showFullMatrix 
  })),
  selectPair: (entity1, entity2) => set({ 
    selectedPair: { entity1, entity2 } 
  }),
  clearSelection: () => set({ selectedPair: null })
}));
```

### 6.3 API 엔드포인트
```typescript
// API Routes
GET /api/entity-view/summary?year=2026&month=1
→ { totalPairs, matchedCount, pendingCount, noDataCount, submittedEntities }

GET /api/entity-view/matrix?year=2026&month=1
→ MatrixData[][]

GET /api/entity-view/details?entity1=uuid&entity2=uuid&year=2026&month=1
→ TransactionDetails
```

---

## 7. 테스트 시나리오

### 7.1 필터 기능 테스트
```
시나리오 1: 데이터가 있는 항목만 표시
1. BWA만 5개 법인에 데이터 제출
2. "데이터가 있는 항목만" 체크
3. 기대 결과: BWA + 5개 법인만 표시 (6×6 매트릭스)

시나리오 2: 검색 기능
1. 검색창에 "US" 입력
2. 기대 결과: USA 관련 행/열만 하이라이트

시나리오 3: 대각선 아래만 표시
1. "대각선 아래만 표시" 체크
2. 기대 결과: 매트릭스 크기 50% 감소, 중복 제거
```

### 7.2 성능 테스트
```
시나리오 1: 대량 데이터
- 조건: 13개 법인, 1,000개 거래 내역
- 기대 응답 시간: < 2초

시나리오 2: 필터 변경
- 조건: 필터 옵션 토글
- 기대 응답 시간: < 500ms
```

---

## 8. 문의 및 피드백

이 개선안에 대한 질문이나 추가 의견이 있으시면:
- 프로젝트 관리자: [이메일]
- 개발팀: [Slack 채널]

---

**변경 이력**

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 1.0 | 2025-01-20 | 초안 작성 | Claude |