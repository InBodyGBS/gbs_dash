# System 페이지 PRD

**작성일:** 2026년 1월 13일  
**버전:** 1.0  
**프로젝트:** InBody 해외법인 대시보드 - System 관리

---

## 📋 목차

1. [개요](#개요)
2. [페이지 구조](#페이지-구조)
3. [1. System (시스템 현황)](#1-system-시스템-현황)
4. [2. 프로젝트](#2-프로젝트)
5. [3. 프로세스](#3-프로세스)
6. [데이터베이스 스키마](#데이터베이스-스키마)
7. [기술 스택](#기술-스택)
8. [개발 우선순위](#개발-우선순위)

---

## 개요

### 목적
InBody 해외법인의 IT 시스템, 프로젝트, 업무 프로세스를 통합 관리하는 페이지

### 핵심 기능
- **System**: 법인별 IT 시스템 현황 그리드 관리
- **프로젝트**: 시스템 구축/개선 프로젝트 WBS 관리
- **프로세스**: 업무 프로세스 플로우차트 시각화 및 편집

---

## 페이지 구조

```
/system
  ├── /system (시스템 현황)
  ├── /project (프로젝트 관리)
  └── /process (프로세스 관리)
```

**네비게이션:**
- 상단 탭: `시스템 현황 | 프로젝트 | 프로세스`
- URL: `/system`, `/system/project`, `/system/process`

---

## 1. System (시스템 현황)

### 1.1 페이지 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  System Overview                    [Export Excel] [+]  │
├─────────────────────────────────────────────────────────┤
│  [전체 ▼] [검색...]                                      │
├───────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┤
│ Entity│ ERP │ CRM │생산 │물류 │회계 │ CS  │급여 │기타 │
├───────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  HQ   │D365 │SF   │MES  │WMS  │더존 │ZD   │더존 │     │
│ USA   │D365 │SF   │     │     │QBO  │ZD   │ADP  │Sho..│
│ JPN   │     │SF   │     │     │弥生 │     │     │     │
│ ...   │     │     │     │     │     │     │     │     │
└───────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

### 1.2 그리드 구조

**행 (Rows):** 법인 (Entity)
- HQ, USA, JPN, CHN, NLD, DEU, IND, MEX, TUR, VNM, MYS, AUS, BWA, Healthcare, KOROT

**열 (Columns):** 시스템 카테고리
1. **ERP** (Enterprise Resource Planning)
2. **CRM** (Customer Relationship Management)
3. **생산관리** (Manufacturing Execution System)
4. **물류** (Warehouse Management System)
5. **회계** (Accounting)
6. **CS** (Customer Service)
7. **Payroll** (급여)
8. **기타** (Others)

### 1.3 셀 편집 기능

**인라인 편집:**
- 셀 클릭 → 텍스트 입력 모드
- Enter: 저장 및 다음 행 이동
- Tab: 저장 및 다음 열 이동
- Esc: 취소
- 자동 저장 (debounce 500ms)

**입력 예시:**
```
D365 Finance
Salesforce
더존 iCube
QuickBooks Online
弥生会計
```

### 1.4 기능

#### 필터링
- **지역별:** Americas, Europe, Asia-Pacific, All
- **시스템별:** ERP만, CRM만, 회계만 등

#### 검색
- 시스템명으로 검색
- 법인명으로 검색
- 실시간 하이라이트

#### 내보내기
- Excel 다운로드 (전체 그리드)
- PDF 다운로드

#### 뷰 모드
- **Compact**: 텍스트만
- **Detailed**: 시스템명 + 버전 + 담당자

---

## 2. 프로젝트

### 2.1 페이지 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  System Projects              [+ New Project] [Filter]  │
├─────────────────────────────────────────────────────────┤
│  [진행중 ▼] [검색...] [담당자: All ▼]                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │ 🚀 인도 D365 구축 프로젝트                    │      │
│  │ India | ERP Implementation | 진행중           │      │
│  │ PM: 조승현 | Due: 2026-03-31 | D-75          │      │
│  │                                               │      │
│  │ WBS Progress: ████████░░░░ 65%              │      │
│  │                                               │      │
│  │ Tasks (8/12):                                │      │
│  │ ✅ 요구사항 분석                              │      │
│  │ ✅ 시스템 설계                                │      │
│  │ 🔄 개발 진행중 (김팀장, D-10)                │      │
│  │ ⏸️ UAT 대기 (이과장, D-30)                   │      │
│  │ ...                                          │      │
│  └──────────────────────────────────────────────┘      │
│                                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │ 📊 터키 회계시스템 전환                       │      │
│  │ Turkey | Accounting | 계획중                 │      │
│  │ ...                                          │      │
│  └──────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

### 2.2 프로젝트 카드 구조

**헤더:**
- 프로젝트명 (Icon + Title)
- 법인 | 카테고리 | 상태
- PM | Due Date | D-DAY

**진행률:**
- Progress Bar (완료 Task / 전체 Task)
- 퍼센트 표시

**Task 리스트:**
- ✅ 완료
- 🔄 진행중
- ⏸️ 대기
- ❌ 지연

### 2.3 프로젝트 상세 뷰

**Dialog 형태:**

```
┌───────────────────────────────────────────────────┐
│  인도 D365 구축 프로젝트                   [✕]    │
├───────────────────────────────────────────────────┤
│  [개요] [WBS] [일정] [리소스] [문서]              │
├───────────────────────────────────────────────────┤
│                                                    │
│  📋 WBS (Work Breakdown Structure)                │
│                                                    │
│  1. 프로젝트 착수 ✅                              │
│     1.1 킥오프 미팅 ✅ (조승현, 2025-12-01)       │
│     1.2 PM 팀 구성 ✅ (조승현, 2025-12-05)        │
│                                                    │
│  2. 요구사항 분석 🔄                              │
│     2.1 현행 시스템 분석 ✅ (김팀장, 2026-01-15)  │
│     2.2 To-Be 설계 🔄 (이과장, 2026-02-01, D-18) │
│     2.3 Gap 분석 ⏸️ (박대리, 2026-02-10)         │
│                                                    │
│  3. 시스템 구축 ⏸️                                │
│     3.1 개발환경 구축 ⏸️ (최과장, 2026-02-15)    │
│     3.2 커스터마이징 ⏸️ (개발팀, 2026-03-01)     │
│     ...                                           │
│                                                    │
│  [+ Add Task] [Export Gantt Chart]               │
└───────────────────────────────────────────────────┘
```

### 2.4 Task 속성

**필수 필드:**
- Task 번호 (1.1, 1.2, 2.1 등)
- Task 명
- 담당자
- Due Date
- 상태 (계획중, 진행중, 완료, 지연, 보류)

**선택 필드:**
- 상세 기술 (Description)
- 첨부파일
- 선행 Task
- 진행률 (%)
- 예상 공수 (Man-days)

### 2.5 뷰 옵션

- **카드 뷰** (기본)
- **간트 차트 뷰**
- **테이블 뷰**

---

## 3. 프로세스

### 3.1 페이지 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  Process Flow                                            │
├─────────────────────────────────────────────────────────┤
│  Category: [회계 ▼]  Entity: [USA ▼]  [+ New] [Edit]   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  USA | 회계 | 월마감 프로세스                            │
│                                                          │
│  ┌────────────┬─────────────────────────────────────┐  │
│  │            │   Week 1    │   Week 2    │ Week 3  │  │
│  ├────────────┼─────────────┼─────────────┼─────────┤  │
│  │ 경리팀     │ ┌─────────┐ │             │         │  │
│  │ (김과장)   │ │ 전표입력 │→│             │         │  │
│  │            │ └─────────┘ │             │         │  │
│  ├────────────┼─────────────┼─────────────┼─────────┤  │
│  │ 회계팀     │             │ ┌─────────┐ │         │  │
│  │ (이부장)   │             │ │ 검토승인 │→│         │  │
│  │            │             │ └─────────┘ │         │  │
│  ├────────────┼─────────────┼─────────────┼─────────┤  │
│  │ CFO        │             │             │┌───────┐│  │
│  │ (박CFO)    │             │             ││최종승인││  │
│  │            │             │             │└───────┘│  │
│  └────────────┴─────────────┴─────────────┴─────────┘  │
│                                                          │
│  [도형 도구] ▢ ◯ ◇ → ↓ ↔ ↕                          │
└─────────────────────────────────────────────────────────┘
```

### 3.2 프로세스 카테고리

1. **회계** (Accounting)
2. **구매** (Purchasing)
3. **판매** (Sales)
4. **비용** (Expense)
5. **자금** (Treasury)
6. **FOC** (Free of Charge)
7. **결산** (Closing)

### 3.3 Swimming Lane 구조

**행 (Swimlanes):** 담당자/부서
- 각 행은 역할별 담당자
- 예: 경리팀, 회계팀, CFO, 외부감사

**열 (Timeline):** 시간 순서
- Week 1, Week 2, Week 3, Week 4
- 또는 Day 1, Day 2, Day 3 등
- 사용자 정의 가능

### 3.4 도형 도구

**기본 도형:**
- ▢ 프로세스 (사각형)
- ◇ 의사결정 (다이아몬드)
- ◯ 시작/종료 (원형)
- ⬬ 문서 (파일 아이콘)

**화살표:**
- → 진행 방향
- ↓ 하위 단계
- ↔ 양방향
- ⤴ 반복/되돌림

### 3.5 편집 기능

#### 드래그 앤 드롭
```javascript
// 도형 추가
1. 왼쪽 도형 팔레트에서 선택
2. 캔버스에 드래그
3. 크기 조정

// 연결선 추가
1. 도형 클릭
2. 연결점 드래그
3. 다음 도형에 연결

// 텍스트 입력
1. 도형 더블클릭
2. 텍스트 입력
3. Enter 또는 바깥 클릭으로 저장
```

#### 편집 모드
- **뷰 모드**: 읽기 전용, 줌/팬만 가능
- **편집 모드**: 도형 추가/수정/삭제 가능

#### 도형 속성
- 텍스트 내용
- 배경색
- 테두리 색
- 담당자 (할당 가능)
- 예상 소요 시간

### 3.6 협업 기능

- **버전 관리**: 수정 이력 저장
- **댓글**: 도형별 코멘트
- **승인 플로우**: 작성 → 검토 → 승인
- **Export**: PNG, PDF, SVG

---

## 데이터베이스 스키마

### 1. systems (시스템 현황)

```sql
CREATE TABLE systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('ERP', 'CRM', '생산관리', '물류', '회계', 'CS', 'Payroll', '기타')
  ),
  system_name TEXT,
  version TEXT,
  vendor TEXT,
  implementation_date DATE,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(entity_id, category)
);

CREATE INDEX idx_systems_entity ON systems(entity_id);
CREATE INDEX idx_systems_category ON systems(category);
```

### 2. projects (프로젝트)

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  entity_id UUID NOT NULL REFERENCES subsidiaries(id),
  category TEXT NOT NULL CHECK (
    category IN ('ERP', 'CRM', '생산관리', '물류', '회계', 'CS', 'Payroll', '기타')
  ),
  status TEXT NOT NULL DEFAULT '계획중' CHECK (
    status IN ('계획중', '진행중', '완료', '보류', '취소')
  ),
  pm TEXT NOT NULL,
  start_date DATE,
  due_date DATE,
  completion_date DATE,
  description TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_entity ON projects(entity_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_pm ON projects(pm);
```

### 3. tasks (프로젝트 태스크)

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '계획중' CHECK (
    status IN ('계획중', '진행중', '완료', '지연', '보류')
  ),
  due_date DATE,
  completed_date DATE,
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  estimated_hours DECIMAL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(project_id, task_number)
);

CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
```

### 4. processes (프로세스)

```sql
CREATE TABLE processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  entity_id UUID NOT NULL REFERENCES subsidiaries(id),
  category TEXT NOT NULL CHECK (
    category IN ('회계', '구매', '판매', '비용', '자금', 'FOC', '결산')
  ),
  description TEXT,
  flowchart_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT '작성중' CHECK (
    status IN ('작성중', '검토중', '승인완료', '보관')
  ),
  created_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_processes_entity ON processes(entity_id);
CREATE INDEX idx_processes_category ON processes(category);
CREATE INDEX idx_processes_status ON processes(status);
```

**flowchart_data JSONB 구조:**
```json
{
  "swimlanes": [
    {
      "id": "lane1",
      "name": "경리팀",
      "assignee": "김과장",
      "order": 1
    }
  ],
  "columns": [
    {"id": "col1", "name": "Week 1", "order": 1},
    {"id": "col2", "name": "Week 2", "order": 2}
  ],
  "shapes": [
    {
      "id": "shape1",
      "type": "process",
      "text": "전표입력",
      "x": 100,
      "y": 50,
      "width": 120,
      "height": 60,
      "swimlane": "lane1",
      "column": "col1",
      "backgroundColor": "#3b82f6",
      "assignee": "김과장",
      "estimatedHours": 2
    }
  ],
  "connections": [
    {
      "id": "conn1",
      "from": "shape1",
      "to": "shape2",
      "type": "arrow",
      "label": ""
    }
  ]
}
```

---

## 기술 스택

### Frontend
- **Next.js 15**: App Router
- **React**: 상태 관리
- **TypeScript**: 타입 안정성
- **Tailwind CSS**: 스타일링
- **shadcn/ui**: UI 컴포넌트

### 그리드 & 테이블
- **AG Grid** 또는 **TanStack Table**: System 그리드
- 인라인 편집, 필터링, 정렬

### 플로우차트 (프로세스)
- **React Flow**: 노드 기반 플로우차트
- 또는 **Excalidraw**: 자유로운 그리기
- 또는 **Mermaid.js**: 텍스트 기반 다이어그램

### 간트 차트 (프로젝트)
- **DHTMLX Gantt** (무료 버전)
- 또는 **Frappe Gantt**
- 또는 직접 구현 (SVG)

### 데이터베이스
- **Supabase**: PostgreSQL
- JSONB로 플로우차트 데이터 저장

### 상태 관리
- **Zustand** 또는 **React Context**
- 편집 상태, 필터 상태 관리

---

## 개발 우선순위

### Phase 1: System 현황 (2-3시간)
1. ✅ 데이터베이스 테이블 생성
2. ✅ 그리드 기본 레이아웃
3. ✅ 인라인 편집 기능
4. ✅ 필터링 및 검색

### Phase 2: 프로젝트 기본 (3-4시간)
1. ✅ 프로젝트 카드 리스트
2. ✅ 프로젝트 생성/수정 Dialog
3. ✅ Task 관리 (CRUD)
4. ✅ 진행률 계산
5. ✅ D-DAY 표시

### Phase 3: 프로젝트 고급 (4-5시간)
1. ✅ WBS 트리 구조
2. ✅ 간트 차트 뷰
3. ✅ 담당자 필터링
4. ✅ Export 기능

### Phase 4: 프로세스 기본 (5-6시간)
1. ✅ Swimlane 그리드 렌더링
2. ✅ 도형 팔레트
3. ✅ 드래그 앤 드롭
4. ✅ 기본 도형 (사각형, 원, 다이아몬드)
5. ✅ 연결선 그리기

### Phase 5: 프로세스 고급 (4-5시간)
1. ✅ 텍스트 편집
2. ✅ 도형 속성 (색상, 크기)
3. ✅ 버전 관리
4. ✅ Export (PNG, PDF)
5. ✅ 협업 기능 (댓글)

---

## 금요일 데모용 최소 기능 (3-4시간)

### System 현황
- ✅ 법인 × 시스템 카테고리 그리드
- ✅ 인라인 텍스트 편집
- ✅ 자동 저장

### 프로젝트
- ✅ 프로젝트 카드 리스트
- ✅ Task 목록 표시
- ✅ 진행률 표시
- ✅ 생성/수정 기능

### 프로세스
- ✅ 카테고리/Entity 선택
- ✅ Swimlane 그리드 표시
- ✅ 기본 도형 드래그 (시연용)

---

## UI/UX 가이드

### System 현황
- **그리드**: 밝은 배경, 명확한 구분선
- **편집 모드**: 셀에 파란 테두리
- **저장 중**: 셀 오른쪽에 작은 스피너

### 프로젝트
- **카드**: 그림자, 호버 효과
- **상태 색상**:
  - 계획중: 회색
  - 진행중: 파란색
  - 완료: 초록색
  - 지연: 빨간색
  - 보류: 주황색
- **D-DAY**: 음수면 빨간색 (지연)

### 프로세스
- **Swimlane**: 교대로 밝은/어두운 배경
- **도형 색상**:
  - 프로세스: 파란색
  - 의사결정: 노란색
  - 시작/종료: 초록색
  - 문서: 흰색
- **선택 시**: 파란 테두리 + 핸들 표시
- **연결선**: 회색, 호버 시 파란색

---

## API 엔드포인트

### System
- `GET /api/systems` - 전체 시스템 현황
- `GET /api/systems?entity=USA` - 특정 법인
- `POST /api/systems` - 새 시스템 추가
- `PUT /api/systems/:id` - 시스템 수정
- `DELETE /api/systems/:id` - 시스템 삭제

### Project
- `GET /api/projects` - 프로젝트 목록
- `GET /api/projects/:id` - 프로젝트 상세
- `POST /api/projects` - 프로젝트 생성
- `PUT /api/projects/:id` - 프로젝트 수정
- `DELETE /api/projects/:id` - 프로젝트 삭제
- `GET /api/projects/:id/tasks` - Task 목록
- `POST /api/projects/:id/tasks` - Task 생성

### Process
- `GET /api/processes` - 프로세스 목록
- `GET /api/processes/:id` - 프로세스 상세
- `POST /api/processes` - 프로세스 생성
- `PUT /api/processes/:id` - 프로세스 수정 (flowchart_data 포함)
- `DELETE /api/processes/:id` - 프로세스 삭제
- `POST /api/processes/:id/export` - Export (PNG/PDF)

---

## 참고 라이브러리

### 그리드
- [AG Grid](https://www.ag-grid.com/) - Enterprise 기능
- [TanStack Table](https://tanstack.com/table) - 무료, 경량

### 플로우차트
- [React Flow](https://reactflow.dev/) - 추천! ⭐
- [Excalidraw](https://github.com/excalidraw/excalidraw) - 손그림 스타일
- [Mermaid.js](https://mermaid.js.org/) - 텍스트 기반

### 간트 차트
- [Frappe Gantt](https://frappe.io/gantt) - 무료, 간단
- [DHTMLX Gantt](https://dhtmlx.com/docs/products/dhtmlxGantt/) - 기능 많음

---

## 성공 지표

### System 현황
- ✅ 14개 법인 × 8개 시스템 = 112개 셀 정상 작동
- ✅ 편집 후 자동 저장 성공률 > 99%
- ✅ 로딩 속도 < 1초

### 프로젝트
- ✅ 프로젝트 CRUD 정상 작동
- ✅ Task 계층 구조 (3단계) 지원
- ✅ 진행률 자동 계산 정확도 100%

### 프로세스
- ✅ 10개 이상 도형 배치 가능
- ✅ 드래그 앤 드롭 부드러움 (60fps)
- ✅ JSONB 저장/로드 정상 작동

---

## 부록: Cursor 구현 프롬프트

### Phase 1: System 현황 그리드

```
System 페이지의 시스템 현황 그리드를 만들어줘.

요구사항:
1. TanStack Table 사용
2. 행: subsidiaries 테이블의 14개 법인
3. 열: ERP, CRM, 생산관리, 물류, 회계, CS, Payroll, 기타 (8개)
4. 각 셀은 인라인 편집 가능 (클릭 → input 모드)
5. 500ms debounce로 자동 저장
6. 상단에 지역 필터, 검색바
7. "Export Excel" 버튼

데이터베이스:
- systems 테이블 사용 (entity_id, category, system_name)

파일 구조:
- app/(dashboard)/system/page.tsx
- components/system/SystemGrid.tsx
- lib/services/systemService.ts

shadcn/ui 컴포넌트 사용, Tailwind로 스타일링해줘.
```

### Phase 2: 프로젝트 카드 리스트

```
프로젝트 관리 페이지를 만들어줘.

요구사항:
1. 프로젝트 카드 그리드 레이아웃
2. 각 카드 내용:
   - 프로젝트명, 법인, 카테고리, 상태
   - PM, Due Date, D-DAY 계산
   - Progress Bar (완료 Task / 전체 Task)
   - Task 리스트 (최대 3-5개 미리보기)
3. 카드 클릭 → 상세 Dialog
4. "+ New Project" 버튼
5. 상태/PM 필터링, 검색

데이터베이스:
- projects, tasks 테이블

파일:
- app/(dashboard)/system/project/page.tsx
- components/system/ProjectCard.tsx
- components/system/ProjectDetailDialog.tsx

shadcn/ui Card, Dialog, Progress 사용해줘.
```

### Phase 3: 프로세스 플로우차트

```
프로세스 플로우차트 에디터를 만들어줘.

요구사항:
1. React Flow 사용
2. Swimlane 레이아웃 (행: 담당자, 열: 시간 순서)
3. 왼쪽 도형 팔레트 (사각형, 원, 다이아몬드, 화살표)
4. 드래그 앤 드롭으로 도형 추가
5. 도형 연결선 그리기
6. 도형 더블클릭 → 텍스트 편집
7. JSONB로 저장 (flowchart_data)

데이터베이스:
- processes 테이블

파일:
- app/(dashboard)/system/process/page.tsx
- components/system/ProcessFlowEditor.tsx
- components/system/ShapePalette.tsx

React Flow 공식 문서 참고해서 구현해줘.
```
