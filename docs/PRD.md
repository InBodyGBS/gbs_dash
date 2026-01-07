# PRD: InBody 해외법인 관리 대시보드 (MVP)

## 📋 문서 정보

| 항목 | 내용 |
|------|------|
| **프로젝트명** | InBody Global Business Support Dashboard |
| **버전** | v0.1.0 (MVP) |
| **작성일** | 2026-01-07 |
| **담당자** | 조승현 (Global Business Support Team) |
| **데모 목표일** | 2026-01-10 (금요일) |
| **Repository** | `subsidiary-dashboard` |
| **배포 URL** | TBD (Vercel) |

---

## 📑 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기능 요구사항](#2-기능-요구사항)
3. [기술 사양](#3-기술-사양)
4. [데이터베이스 설계](#4-데이터베이스-설계)
5. [Cursor AI 개발 가이드](#5-cursor-ai-개발-가이드)
6. [개발 일정](#6-개발-일정)
7. [배포 및 테스트](#7-배포-및-테스트)
8. [트러블슈팅](#8-트러블슈팅)

---

## 1. 프로젝트 개요

### 1.1 배경 및 목적

**현재 문제점:**
- 17개 해외법인의 재무 데이터가 개별 엑셀로 분산 관리
- 통합 현황 파악이 어렵고 시간 소요
- 부사장님이 요청하는 실시간 현황 파악 불가

**솔루션:**
- 세계지도 기반 인터랙티브 대시보드
- 법인별 재무 실적 시각화
- 원클릭으로 핵심 지표 확인

**핵심 가치 제안:**
1. ⏱️ **시간 절약**: 엑셀 취합 작업 제거
2. 📊 **직관적 시각화**: 지도 + 차트로 한눈에 파악
3. 🌐 **웹 접근성**: 언제 어디서나 브라우저로 확인
4. 🔄 **확장 가능성**: 향후 추가 기능 통합 용이

### 1.2 사용자 페르소나

**Primary User: 부사장님**
- 목적: 경영진 보고용 현황 파악
- 사용 빈도: 주 2-3회
- 니즈: 전체 법인 실적 한눈에 보기, 목표 달성 여부

**Secondary User: GBS 팀 (본인)**
- 목적: 일상 업무 모니터링 및 데이터 관리
- 사용 빈도: 일 1-2회
- 니즈: 법인별 세부 데이터, 이상치 탐지

**Tertiary User: 재무/회계팀**
- 목적: 데이터 검증 및 분석
- 사용 빈도: 월 1-2회 (결산 시즌)
- 니즈: Export 기능, 히스토리 추적

### 1.3 성공 지표

**MVP (금요일 데모)**
- [ ] 부사장님이 "이 방향으로 계속 진행" 승인
- [ ] 14개 법인이 지도에 정확히 표시
- [ ] 법인 클릭 → 재무 데이터 1초 이내 표시
- [ ] 차트가 의미있는 추이 표시

**Phase 2 (3주 후)**
- [ ] 주 1회 이상 실제 업무에서 사용
- [ ] 엑셀 보고서 50% 대체
- [ ] 팀원 3명 이상 활용

---

## 2. 기능 요구사항

### 2.1 MVP 기능 (Phase 1)

#### F1. 세계지도 시각화 ⭐️⭐️⭐️

**Description:**
- 세계지도 배경에 14개 해외법인 위치를 마커로 표시
- 지역별 색상 구분 (Americas, Europe, Asia-Pacific)

**Requirements:**
- [ ] Mercator projection 사용
- [ ] 법인 마커는 원형 (radius: 8-12px)
- [ ] Hover 시 법인명 tooltip 표시
- [ ] 클릭 시 해당 법인 상세 정보 표시
- [ ] 선택된 마커는 크기 확대 및 강조

**Technical Details:**
```typescript
// 마커 위치 계산
interface SubsidiaryMarker {
  id: string;
  name: string;
  coordinates: [longitude, latitude]; // [-180 to 180, -90 to 90]
  region: 'Americas' | 'Europe' | 'Asia-Pacific';
}

// 지역별 색상
const REGION_COLORS = {
  'Americas': '#3B82F6',    // blue-500
  'Europe': '#10B981',      // green-500
  'Asia-Pacific': '#F59E0B' // amber-500
};
```

**Acceptance Criteria:**
- 14개 법인이 모두 올바른 위치에 표시됨
- 마커 hover 시 0.3초 내 tooltip 표시
- 마커 클릭 시 즉시 반응
- 모바일에서도 터치 인터랙션 작동

---

#### F2. 법인 정보 카드 ⭐️⭐️⭐️

**Description:**
- 법인 선택 시 우측 패널에 재무 정보 카드 표시
- 최근 분기 실적 및 핵심 지표 표시

**Requirements:**
- [ ] 법인 기본 정보 (이름, 국가, 도시)
- [ ] 최근 분기 매출액 (원화, 억원 단위)
- [ ] 최근 분기 영업이익 (원화, 억원 단위)
- [ ] 영업이익률 (%)
- [ ] 마지막 업데이트 시간

**UI Layout:**
```
┌─────────────────────────────────┐
│ InBody USA                   [X]│
│ Los Angeles, USA                │
├─────────────────────────────────┤
│ 2024 Q4 실적                    │
│                                 │
│ 매출액     │ 550억원            │
│ 영업이익   │ 60억원             │
│ 영업이익률 │ 10.9%              │
├─────────────────────────────────┤
│ 최근 4분기 추이 [차트]          │
└─────────────────────────────────┘
```

**Technical Details:**
```typescript
interface FinancialMetrics {
  revenue: number;           // 원화 (원)
  operatingProfit: number;   // 원화 (원)
  operatingMargin: number;   // % (소수점 1자리)
  lastUpdated: Date;
}

// 포맷팅 함수
function formatKRW(amount: number): string {
  const billion = amount / 100000000; // 억원 단위
  return `${billion.toFixed(0)}억원`;
}

function formatMargin(margin: number): string {
  return `${margin.toFixed(1)}%`;
}
```

**Acceptance Criteria:**
- 데이터 로딩 중 Skeleton UI 표시
- 숫자 포맷팅 정확 (억원 단위, 천단위 콤마)
- 영업이익 마이너스 시 빨간색 표시
- 닫기(X) 버튼 클릭 시 카드 닫힘

---

#### F3. 재무 실적 차트 ⭐️⭐️

**Description:**
- 최근 4분기 매출 추이를 막대그래프로 시각화

**Requirements:**
- [ ] X축: 분기 (예: 2024 Q1, Q2, Q3, Q4)
- [ ] Y축: 매출액 (억원 단위)
- [ ] Hover 시 정확한 금액 tooltip
- [ ] 반응형 (모바일에서도 읽기 쉽게)

**Chart Configuration:**
```typescript
// Recharts BarChart 설정
<BarChart
  data={chartData}
  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="quarter" />
  <YAxis 
    label={{ value: '매출액 (억원)', angle: -90, position: 'insideLeft' }}
  />
  <Tooltip formatter={(value) => `${value}억원`} />
  <Bar dataKey="revenue" fill="#3B82F6" />
</BarChart>
```

**Data Format:**
```typescript
interface ChartDataPoint {
  quarter: string;      // "2024 Q1"
  revenue: number;      // 500 (억원)
  year: number;         // 2024
  quarterNum: number;   // 1
}
```

**Acceptance Criteria:**
- 4개 분기 데이터 모두 표시
- 막대 간격 일정
- tooltip 정확한 값 표시
- 차트 높이 300px 이상

---

#### F4. 데이터 관리 (Backend) ⭐️⭐️

**Description:**
- Supabase를 통한 법인 및 재무 데이터 저장/조회
- 초기 데이터는 SQL로 직접 입력

**Requirements:**
- [ ] Supabase 프로젝트 생성 및 연동
- [ ] 2개 테이블 생성 (subsidiaries, financial_data)
- [ ] 14개 법인 데이터 입력
- [ ] 샘플 재무 데이터 입력 (최소 2분기)

**Performance:**
- 데이터 조회 응답 시간 < 500ms
- 페이지 로드 시간 < 2초

---

### 2.2 Phase 1에서 제외 (Phase 2 이후)

❌ **엑셀 업로드 기능**
- 이유: 3일 내 구현 불가
- 대안: 초기 데이터는 SQL로 입력

❌ **4개 카테고리 탭** (재무실적, 내부거래, 시스템, 일정표)
- 이유: 범위 초과
- 계획: Phase 2에서 구현

❌ **목표 대비 달성률 계산**
- 이유: 시간 부족
- 대안: 목표 데이터는 DB에 저장, 표시는 Phase 2

❌ **사용자 인증/권한 관리**
- 이유: MVP에서는 불필요
- 계획: Phase 3에서 Supabase Auth 추가

❌ **실시간 데이터 업데이트**
- 이유: 월 1회 업데이트면 충분
- 계획: Phase 2에서 수동 업로드 기능

---

## 3. 기술 사양

### 3.1 Technology Stack

| Layer | Technology | Version | 선택 이유 |
|-------|-----------|---------|----------|
| **Framework** | Next.js | 15.x | React SSR/SSG, API Routes |
| **Language** | TypeScript | 5.x | 타입 안전성, 개발 생산성 |
| **UI Library** | shadcn/ui | Latest | 고품질 컴포넌트, Tailwind 통합 |
| **Styling** | Tailwind CSS | 3.x | 빠른 스타일링, 일관성 |
| **Database** | Supabase | - | PostgreSQL + Auth + Storage |
| **Charts** | Recharts | 2.x | React 네이티브, 커스터마이징 용이 |
| **Maps** | react-simple-maps | 3.x | 가볍고 커스터마이징 가능 |
| **Date** | date-fns | 3.x | 날짜 포맷팅 |
| **Tooltip** | react-tooltip | 5.x | 간단한 tooltip 구현 |
| **AI Tool** | Cursor | - | AI 기반 코드 생성 |
| **Hosting** | Vercel | - | Next.js 최적화, 무료 tier |

### 3.2 프로젝트 구조

```
subsidiary-dashboard/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # 메인 대시보드
│   ├── globals.css             # Global styles
│   └── api/                    # API routes (Phase 2)
│       └── upload/
│           └── route.ts
├── components/
│   ├── ui/                     # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── skeleton.tsx
│   │   └── ...
│   ├── dashboard/
│   │   ├── WorldMap.tsx        # 세계지도 컴포넌트
│   │   ├── SubsidiaryCard.tsx  # 법인 정보 카드
│   │   ├── FinancialChart.tsx  # 재무 차트
│   │   └── Header.tsx          # 대시보드 헤더
│   └── layout/
│       └── DashboardLayout.tsx # 레이아웃 래퍼
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Supabase 클라이언트
│   │   └── types.ts            # Database types
│   ├── services/
│   │   └── financialService.ts # 재무 데이터 service
│   ├── utils/
│   │   ├── format.ts           # 포맷팅 함수
│   │   └── colors.ts           # 색상 유틸
│   └── constants/
│       └── regions.ts          # 지역 상수
├── types/
│   └── index.ts                # Global types
├── public/
│   └── world-map.json          # 지도 데이터 (optional)
├── .env.local                  # 환경 변수
├── .env.example                # 환경 변수 예시
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 3.3 핵심 Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.0.0",
    "@supabase/supabase-js": "^2.39.0",
    "recharts": "^2.10.0",
    "react-simple-maps": "^3.0.0",
    "date-fns": "^3.0.0",
    "react-tooltip": "^5.25.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0",
    "tailwindcss": "^3.4.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "^15.0.0"
  }
}
```

---

## 4. 데이터베이스 설계

### 4.1 Schema Overview

```
subsidiaries (법인 정보)
├── id (UUID, PK)
├── name (TEXT)
├── code (TEXT, UNIQUE)
├── country (TEXT)
├── city (TEXT)
├── latitude (DECIMAL)
├── longitude (DECIMAL)
├── region (TEXT)
└── created_at (TIMESTAMP)

financial_data (재무 데이터)
├── id (UUID, PK)
├── subsidiary_id (UUID, FK → subsidiaries)
├── fiscal_year (INTEGER)
├── quarter (INTEGER)
├── revenue_krw (BIGINT)
├── operating_profit_krw (BIGINT)
├── target_revenue_krw (BIGINT, nullable)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── UNIQUE(subsidiary_id, fiscal_year, quarter)
```

### 4.2 Supabase SQL Scripts

#### 4.2.1 테이블 생성

```sql
-- ============================================
-- 1. subsidiaries 테이블 생성
-- ============================================
CREATE TABLE subsidiaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  region TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_subsidiaries_code ON subsidiaries(code);
CREATE INDEX idx_subsidiaries_region ON subsidiaries(region);

-- 코멘트 추가
COMMENT ON TABLE subsidiaries IS '해외법인 기본 정보';
COMMENT ON COLUMN subsidiaries.code IS '법인 코드 (예: USA, JPN)';
COMMENT ON COLUMN subsidiaries.region IS 'Americas, Europe, Asia-Pacific';

-- ============================================
-- 2. financial_data 테이블 생성
-- ============================================
CREATE TABLE financial_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subsidiary_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL CHECK (fiscal_year >= 2020 AND fiscal_year <= 2100),
  quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  revenue_krw BIGINT NOT NULL CHECK (revenue_krw >= 0),
  operating_profit_krw BIGINT,
  target_revenue_krw BIGINT CHECK (target_revenue_krw >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(subsidiary_id, fiscal_year, quarter)
);

-- 인덱스 생성
CREATE INDEX idx_financial_subsidiary ON financial_data(subsidiary_id);
CREATE INDEX idx_financial_year_quarter ON financial_data(fiscal_year DESC, quarter DESC);
CREATE INDEX idx_financial_updated ON financial_data(updated_at DESC);

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_financial_data_updated_at
    BEFORE UPDATE ON financial_data
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 코멘트 추가
COMMENT ON TABLE financial_data IS '법인별 분기 재무 데이터';
COMMENT ON COLUMN financial_data.revenue_krw IS '매출액 (원화, 원 단위)';
COMMENT ON COLUMN financial_data.operating_profit_krw IS '영업이익 (원화, 원 단위)';
```

#### 4.2.2 법인 데이터 입력

```sql
-- ============================================
-- 3. 14개 해외법인 데이터 입력
-- ============================================
INSERT INTO subsidiaries (name, code, country, city, latitude, longitude, region) VALUES
-- Americas (4개)
('InBody USA', 'USA', 'USA', 'LA', 34.0522, -118.2437, 'Americas'),
('InBody BWA', 'BWA', 'BWA', 'New York', 40.7128, -74.0060, 'Americas'),
('InBody Mexico', 'MEX', 'Mexico', 'Mexico City', 19.4326, -99.1332, 'Americas'),
('InBody Oceania', 'AUS', 'Australia', 'Gold Coast', -28.0167, 153.4000, 'Asia-Pacific'),

-- Europe (2개)
('InBody Europe', 'NLD', 'Netherlands', 'Amsterdam', 52.3676, 4.9041, 'Europe'),
('InBody Turkey', 'TUR', 'Turkey', 'Istanbul', 41.0082, 28.9784, 'Europe'),

-- Asia-Pacific (8개)
('InBody Japan', 'JPN', 'Japan', 'Tokyo', 35.6762, 139.6503, 'Asia-Pacific'),
('InBody China', 'CHN', 'China', 'Shanghai', 31.2304, 121.4737, 'Asia-Pacific'),
('InBody India', 'IND', 'India', 'Mumbai', 19.0760, 72.8777, 'Asia-Pacific'),
('InBody Asia', 'MYS', 'Malaysia', 'Kuala Lumpur', 3.1390, 101.6869, 'Asia-Pacific'),
('InBody Vietnam', 'VNM', 'Vietnam', 'Ho Chi Minh', 10.8231, 106.6297, 'Asia-Pacific');

-- 입력 확인
SELECT name, code, country, city, region FROM subsidiaries ORDER BY region, name;
```

#### 4.2.3 샘플 재무 데이터 입력

```sql
-- ============================================
-- 4. 샘플 재무 데이터 입력 (2024 Q3, Q4)
-- ============================================

-- Helper: 법인 ID 조회 함수
CREATE OR REPLACE FUNCTION get_subsidiary_id(sub_code TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT id FROM subsidiaries WHERE code = sub_code);
END;
$$ LANGUAGE plpgsql;

-- InBody USA (큰 규모)
INSERT INTO financial_data (subsidiary_id, fiscal_year, quarter, revenue_krw, operating_profit_krw, target_revenue_krw)
VALUES
(get_subsidiary_id('USA'), 2024, 3, 50000000000, 5000000000, 48000000000),
(get_subsidiary_id('USA'), 2024, 4, 55000000000, 6000000000, 52000000000),
(get_subsidiary_id('USA'), 2024, 2, 48000000000, 4800000000, 46000000000),
(get_subsidiary_id('USA'), 2024, 1, 45000000000, 4500000000, 44000000000);

-- InBody Japan (중간 규모)
INSERT INTO financial_data (subsidiary_id, fiscal_year, quarter, revenue_krw, operating_profit_krw, target_revenue_krw)
VALUES
(get_subsidiary_id('JPN'), 2024, 3, 30000000000, 3000000000, 32000000000),
(get_subsidiary_id('JPN'), 2024, 4, 32000000000, 3500000000, 34000000000),
(get_subsidiary_id('JPN'), 2024, 2, 29000000000, 2900000000, 30000000000),
(get_subsidiary_id('JPN'), 2024, 1, 28000000000, 2800000000, 29000000000);

-- InBody China (성장 중)
INSERT INTO financial_data (subsidiary_id, fiscal_year, quarter, revenue_krw, operating_profit_krw, target_revenue_krw)
VALUES
(get_subsidiary_id('CHN'), 2024, 3, 25000000000, 2000000000, 24000000000),
(get_subsidiary_id('CHN'), 2024, 4, 28000000000, 2500000000, 26000000000),
(get_subsidiary_id('CHN'), 2024, 2, 23000000000, 1800000000, 22000000000),
(get_subsidiary_id('CHN'), 2024, 1, 20000000000, 1600000000, 21000000000);

-- InBody Europe
INSERT INTO financial_data (subsidiary_id, fiscal_year, quarter, revenue_krw, operating_profit_krw, target_revenue_krw)
VALUES
(get_subsidiary_id('NLD'), 2024, 3, 18000000000, 1800000000, 17000000000),
(get_subsidiary_id('NLD'), 2024, 4, 20000000000, 2100000000, 19000000000),
(get_subsidiary_id('NLD'), 2024, 2, 17000000000, 1700000000, 16000000000),
(get_subsidiary_id('NLD'), 2024, 1, 16000000000, 1600000000, 15500000000);

-- InBody India (작은 규모, 고성장)
INSERT INTO financial_data (subsidiary_id, fiscal_year, quarter, revenue_krw, operating_profit_krw, target_revenue_krw)
VALUES
(get_subsidiary_id('IND'), 2024, 3, 8000000000, 600000000, 7500000000),
(get_subsidiary_id('IND'), 2024, 4, 10000000000, 900000000, 9000000000),
(get_subsidiary_id('IND'), 2024, 2, 7000000000, 500000000, 7000000000),
(get_subsidiary_id('IND'), 2024, 1, 6000000000, 400000000, 6500000000);

-- 나머지 법인들 (간단하게)
INSERT INTO financial_data (subsidiary_id, fiscal_year, quarter, revenue_krw, operating_profit_krw, target_revenue_krw)
SELECT 
  get_subsidiary_id(code),
  2024,
  4,
  CASE 
    WHEN code = 'MEX' THEN 12000000000
    WHEN code = 'TUR' THEN 9000000000
    WHEN code = 'VNM' THEN 7000000000
    WHEN code = 'MYS' THEN 11000000000
    WHEN code = 'AUS' THEN 15000000000
    WHEN code = 'BWA' THEN 8000000000
  END as revenue,
  CASE 
    WHEN code = 'MEX' THEN 1200000000
    WHEN code = 'TUR' THEN 900000000
    WHEN code = 'VNM' THEN 600000000
    WHEN code = 'MYS' THEN 1100000000
    WHEN code = 'AUS' THEN 1500000000
    WHEN code = 'BWA' THEN 700000000
  END as profit,
  NULL as target
FROM subsidiaries
WHERE code IN ('MEX', 'TUR', 'VNM', 'MYS', 'AUS', 'BWA');

-- 입력 결과 확인
SELECT 
  s.name,
  fd.fiscal_year,
  fd.quarter,
  fd.revenue_krw / 100000000 as revenue_billion,
  fd.operating_profit_krw / 100000000 as profit_billion,
  ROUND((fd.operating_profit_krw::NUMERIC / fd.revenue_krw * 100), 1) as margin_pct
FROM financial_data fd
JOIN subsidiaries s ON fd.subsidiary_id = s.id
ORDER BY fd.fiscal_year DESC, fd.quarter DESC, s.name;
```

#### 4.2.4 유용한 조회 쿼리

```sql
-- ============================================
-- 5. 개발/테스트용 조회 쿼리
-- ============================================

-- 최근 분기 실적 (모든 법인)
SELECT 
  s.name,
  s.region,
  fd.fiscal_year || ' Q' || fd.quarter as period,
  fd.revenue_krw / 100000000 as revenue_억원,
  fd.operating_profit_krw / 100000000 as profit_억원,
  ROUND((fd.operating_profit_krw::NUMERIC / fd.revenue_krw * 100), 1) as margin
FROM financial_data fd
JOIN subsidiaries s ON fd.subsidiary_id = s.id
WHERE (fd.fiscal_year, fd.quarter) = (
  SELECT fiscal_year, quarter 
  FROM financial_data 
  ORDER BY fiscal_year DESC, quarter DESC 
  LIMIT 1
)
ORDER BY fd.revenue_krw DESC;

-- 특정 법인의 4분기 추이
SELECT 
  fd.fiscal_year || ' Q' || fd.quarter as period,
  fd.revenue_krw / 100000000 as revenue
FROM financial_data fd
JOIN subsidiaries s ON fd.subsidiary_id = s.id
WHERE s.code = 'USA'
ORDER BY fd.fiscal_year DESC, fd.quarter DESC
LIMIT 4;

-- 지역별 합계
SELECT 
  s.region,
  COUNT(DISTINCT s.id) as subsidiaries_count,
  SUM(fd.revenue_krw) / 100000000 as total_revenue_억원
FROM subsidiaries s
LEFT JOIN financial_data fd ON s.id = fd.subsidiary_id
WHERE fd.fiscal_year = 2024 AND fd.quarter = 4
GROUP BY s.region
ORDER BY total_revenue_억원 DESC;
```

### 4.3 TypeScript Types

```typescript
// lib/supabase/types.ts
export interface Subsidiary {
  id: string;
  name: string;
  code: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  region: 'Americas' | 'Europe' | 'Asia-Pacific';
  created_at: string;
}

export interface FinancialData {
  id: string;
  subsidiary_id: string;
  fiscal_year: number;
  quarter: number;
  revenue_krw: number;
  operating_profit_krw: number | null;
  target_revenue_krw: number | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialDataWithSubsidiary extends FinancialData {
  subsidiaries: Subsidiary;
}

// View Models (UI용)
export interface SubsidiaryCardData {
  subsidiary: Subsidiary;
  latestFinancial: {
    period: string;           // "2024 Q4"
    revenue: number;          // 억원 단위 (550)
    operatingProfit: number;  // 억원 단위 (60)
    operatingMargin: number;  // % (10.9)
    lastUpdated: Date;
  };
}

export interface ChartDataPoint {
  quarter: string;    // "2024 Q1"
  revenue: number;    // 억원 단위 (450)
  profit: number;     // 억원 단위 (45)
}
```

---

## 5. Cursor AI 개발 가이드

### 5.0 사전 준비 체크리스트

#### ✅ 환경 세팅 완료 확인
- [ ] Node.js 18+ 설치 확인: `node --version`
- [ ] Cursor 최신 버전 설치
- [ ] Git 설치 및 설정
- [ ] Supabase 계정 생성

---

### 5.1 프로젝트 초기화 (30분)

#### Step 1-1: Next.js 프로젝트 생성

**Terminal 실행:**
```bash
# 프로젝트 생성
npx create-next-app@latest subsidiary-dashboard \
  --typescript \
  --tailwind \
  --app \
  --eslint \
  --no-src-dir

# 프로젝트 폴더로 이동
cd subsidiary-dashboard

# Git 저장소 초기화
git init
git add .
git commit -m "Initial commit: Next.js 15 + TypeScript + Tailwind"
```

**예상 출력:**
```
✔ Would you like to use TypeScript? … Yes
✔ Would you like to use ESLint? … Yes
✔ Would you like to use Tailwind CSS? … Yes
✔ Would you like to use `src/` directory? … No
✔ Would you like to use App Router? … Yes
✔ Would you like to customize the default import alias? … No
```

#### Step 1-2: 필수 라이브러리 설치

```bash
# Supabase 클라이언트
npm install @supabase/supabase-js

# 차트 라이브러리
npm install recharts

# 지도 라이브러리
npm install react-simple-maps

# 유틸리티
npm install date-fns clsx tailwind-merge

# Tooltip (선택)
npm install react-tooltip

# 타입 정의
npm install -D @types/react-simple-maps
```

#### Step 1-3: shadcn/ui 설치

```bash
# shadcn/ui 초기화
npx shadcn@latest init

# 프롬프트 응답
✔ Which style would you like to use? › Default
✔ Which color would you like to use as base color? › Slate
✔ Would you like to use CSS variables for colors? › yes

# 필요한 컴포넌트 설치
npx shadcn@latest add card
npx shadcn@latest add button
npx shadcn@latest add skeleton
npx shadcn@latest add dialog
npx shadcn@latest add badge
npx shadcn@latest add separator
```

#### Step 1-4: 프로젝트 구조 생성

```bash
# 폴더 생성
mkdir -p lib/supabase lib/services lib/utils lib/constants
mkdir -p components/dashboard components/layout
mkdir -p types

# 기본 파일 생성
touch lib/supabase/client.ts
touch lib/supabase/types.ts
touch lib/services/financialService.ts
touch lib/utils/format.ts
touch lib/constants/regions.ts
touch types/index.ts
touch components/dashboard/WorldMap.tsx
touch components/dashboard/SubsidiaryCard.tsx
touch components/dashboard/FinancialChart.tsx
touch components/layout/DashboardLayout.tsx

# .env 파일 생성
touch .env.local
touch .env.example
```

#### Step 1-5: Cursor AI 프롬프트

**Cursor에서 실행 (Cmd/Ctrl + K):**

```
프로젝트 기본 구조를 설정해줘:

1. lib/utils/cn.ts를 만들어서 clsx + tailwind-merge 통합
2. lib/constants/regions.ts에 지역별 색상 상수 정의
3. types/index.ts에 기본 타입 export (Subsidiary, FinancialData)
4. .env.example 파일 작성 (Supabase URL, Key)

코드를 생성할 때:
- TypeScript strict mode 사용
- ESLint 규칙 준수
- 주석 포함 (한국어)
```

**예상 생성 파일들:**

```typescript
// lib/utils/cn.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// lib/constants/regions.ts
export const REGIONS = {
  AMERICAS: 'Americas',
  EUROPE: 'Europe',
  ASIA_PACIFIC: 'Asia-Pacific',
} as const;

export const REGION_COLORS = {
  [REGIONS.AMERICAS]: '#3B82F6',
  [REGIONS.EUROPE]: '#10B981',
  [REGIONS.ASIA_PACIFIC]: '#F59E0B',
} as const;

// .env.example
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

### 5.2 Supabase 연동 (1시간)

#### Step 2-1: Supabase 프로젝트 생성

1. https://supabase.com/dashboard 접속
2. "New project" 클릭
3. 프로젝트 정보 입력:
   - Name: `inbody-subsidiary-dashboard`
   - Database Password: (강력한 비밀번호 생성)
   - Region: Northeast Asia (Seoul)
4. "Create new project" 클릭 (2-3분 소요)

#### Step 2-2: API Keys 복사

1. Project Settings → API → Project URL 복사
2. Project Settings → API → `anon` `public` key 복사
3. `.env.local` 파일에 추가:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Step 2-3: 데이터베이스 테이블 생성

**Supabase Dashboard → SQL Editor → New query:**

```sql
-- 위의 "4.2.1 테이블 생성" SQL 전체 복사 & 실행
```

**실행 후 확인:**
- Table Editor에서 `subsidiaries`, `financial_data` 테이블 생성 확인

#### Step 2-4: Cursor AI로 Supabase 클라이언트 생성

**Cursor Prompt:**

```
lib/supabase/client.ts를 만들어줘:

요구사항:
1. createClient로 Supabase 클라이언트 초기화
2. 환경 변수 검증 (.env.local 누락 시 에러)
3. 타입 안전성을 위한 Database 타입 정의
4. singleton 패턴 적용

그리고 lib/supabase/types.ts에 다음 타입들을 정의해줘:
- Subsidiary (id, name, code, country, city, latitude, longitude, region, created_at)
- FinancialData (모든 financial_data 컬럼)
- FinancialDataWithSubsidiary (join 결과용)
```

**생성된 파일 예시:**

```typescript
// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// lib/supabase/types.ts
export interface Subsidiary {
  id: string;
  name: string;
  code: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  region: 'Americas' | 'Europe' | 'Asia-Pacific';
  created_at: string;
}

export interface FinancialData {
  id: string;
  subsidiary_id: string;
  fiscal_year: number;
  quarter: number;
  revenue_krw: number;
  operating_profit_krw: number | null;
  target_revenue_krw: number | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialDataWithSubsidiary extends FinancialData {
  subsidiaries: Subsidiary;
}

export interface Database {
  public: {
    Tables: {
      subsidiaries: {
        Row: Subsidiary;
      };
      financial_data: {
        Row: FinancialData;
      };
    };
  };
}
```

#### Step 2-5: 샘플 데이터 입력

**Supabase SQL Editor:**

```sql
-- 위의 "4.2.2 법인 데이터 입력" SQL 실행
-- 위의 "4.2.3 샘플 재무 데이터 입력" SQL 실행
```

**데이터 입력 확인:**
```sql
SELECT COUNT(*) FROM subsidiaries;  -- 11개 (국내 제외)
SELECT COUNT(*) FROM financial_data; -- 약 20-30개
```

#### Step 2-6: 연결 테스트

**app/page.tsx를 임시로 수정:**

```typescript
// app/page.tsx
import { supabase } from '@/lib/supabase/client';

export default async function Home() {
  const { data, error } = await supabase
    .from('subsidiaries')
    .select('*')
    .limit(5);

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Supabase 연결 테스트</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

**브라우저 확인:**
```bash
npm run dev
# http://localhost:3000 접속
# 법인 데이터가 JSON으로 표시되면 성공!
```

---

### 5.3 세계지도 구현 (2-3시간)

#### Step 3-1: 지도 컴포넌트 생성

**Cursor Prompt:**

```
components/dashboard/WorldMap.tsx를 만들어줘:

요구사항:
1. react-simple-maps 사용
2. ComposableMap + Geographies로 세계지도 렌더링
3. Marker 컴포넌트로 법인 위치 표시
   - 원형 마커 (radius: 8)
   - 지역별 색상 (REGION_COLORS 사용)
   - hover 시 크기 확대 (scale: 1.2)
   - 선택된 마커는 stroke 강조
4. 클릭 이벤트 핸들링

Props:
- subsidiaries: Subsidiary[]
- selectedId?: string | null
- onSubsidiaryClick: (id: string) => void

스타일:
- 지도 배경: #f3f4f6
- 국가 경계선: #d1d5db
- 마커에 transition 효과

지도 데이터는 다음 URL 사용:
https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json
```

**생성된 코드 예시:**

```typescript
// components/dashboard/WorldMap.tsx
'use client';

import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Subsidiary } from '@/lib/supabase/types';
import { REGION_COLORS } from '@/lib/constants/regions';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

interface WorldMapProps {
  subsidiaries: Subsidiary[];
  selectedId?: string | null;
  onSubsidiaryClick: (id: string) => void;
}

export function WorldMap({ subsidiaries, selectedId, onSubsidiaryClick }: WorldMapProps) {
  return (
    <div className="w-full h-full bg-gray-50 rounded-lg">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 140,
          center: [30, 20],
        }}
        className="w-full h-full"
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#f9fafb"
                stroke="#d1d5db"
                strokeWidth={0.5}
              />
            ))
          }
        </Geographies>

        {subsidiaries.map((sub) => (
          <Marker
            key={sub.id}
            coordinates={[sub.longitude, sub.latitude]}
            onClick={() => onSubsidiaryClick(sub.id)}
          >
            <circle
              r={selectedId === sub.id ? 10 : 8}
              fill={REGION_COLORS[sub.region]}
              stroke={selectedId === sub.id ? '#1f2937' : 'transparent'}
              strokeWidth={2}
              className="cursor-pointer transition-all duration-200 hover:scale-110"
              opacity={selectedId && selectedId !== sub.id ? 0.5 : 1}
            />
            <text
              textAnchor="middle"
              y={-15}
              className="text-xs font-medium fill-gray-700 pointer-events-none"
              opacity={selectedId === sub.id ? 1 : 0}
            >
              {sub.name}
            </text>
          </Marker>
        ))}
      </ComposableMap>
    </div>
  );
}
```

#### Step 3-2: 포맷팅 유틸리티 생성

**Cursor Prompt:**

```
lib/utils/format.ts를 만들어줘:

함수들:
1. formatKRW(amount: number): string
   - 억원 단위로 변환 (예: 50000000000 → "500억원")
   - 천단위 콤마 포함
   
2. formatMargin(margin: number): string
   - 소수점 1자리 (예: 10.87 → "10.9%")
   
3. formatPeriod(year: number, quarter: number): string
   - "YYYY QN" 형식 (예: 2024, 4 → "2024 Q4")
   
4. formatDate(date: string | Date): string
   - date-fns 사용
   - "YYYY년 MM월 DD일" 형식

모든 함수에 JSDoc 주석 추가
```

**생성된 파일:**

```typescript
// lib/utils/format.ts
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * 원화를 억원 단위로 포맷팅
 * @example formatKRW(50000000000) // "500억원"
 */
export function formatKRW(amount: number): string {
  const billion = amount / 100000000;
  return `${billion.toLocaleString('ko-KR')}억원`;
}

/**
 * 영업이익률을 퍼센트로 포맷팅
 * @example formatMargin(10.87) // "10.9%"
 */
export function formatMargin(margin: number): string {
  return `${margin.toFixed(1)}%`;
}

/**
 * 연도와 분기를 "YYYY QN" 형식으로 포맷팅
 * @example formatPeriod(2024, 4) // "2024 Q4"
 */
export function formatPeriod(year: number, quarter: number): string {
  return `${year} Q${quarter}`;
}

/**
 * 날짜를 "YYYY년 MM월 DD일" 형식으로 포맷팅
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'yyyy년 MM월 dd일', { locale: ko });
}

/**
 * 영업이익률 계산
 */
export function calculateMargin(profit: number, revenue: number): number {
  if (revenue === 0) return 0;
  return (profit / revenue) * 100;
}
```

#### Step 3-3: 메인 페이지 구현

**Cursor Prompt:**

```
app/page.tsx를 다시 작성해줘:

요구사항:
1. Server Component로 Supabase에서 subsidiaries 데이터 fetch
2. Client Component인 DashboardClient 렌더링 (별도 파일)

components/dashboard/DashboardClient.tsx를 만들어줘:
1. 'use client' 지시어
2. useState로 selectedSubsidiaryId 관리
3. WorldMap 컴포넌트 렌더링
4. 레이아웃: 
   - 헤더 (제목, 업데이트 시간)
   - 메인: WorldMap (선택 안 됐을 때 전체 화면)
5. 로딩/에러 상태 처리

스타일:
- 헤더: h-16, bg-white, border-b
- 메인: flex-1, bg-gray-50
```

**생성된 파일들:**

```typescript
// app/page.tsx
import { supabase } from '@/lib/supabase/client';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

export default async function HomePage() {
  const { data: subsidiaries, error } = await supabase
    .from('subsidiaries')
    .select('*')
    .order('name');

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">데이터 로딩 실패</h2>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  return <DashboardClient subsidiaries={subsidiaries || []} />;
}

// components/dashboard/DashboardClient.tsx
'use client';

import { useState } from 'react';
import { Subsidiary } from '@/lib/supabase/types';
import { WorldMap } from './WorldMap';
import { formatDate } from '@/lib/utils/format';

interface DashboardClientProps {
  subsidiaries: Subsidiary[];
}

export function DashboardClient({ subsidiaries }: DashboardClientProps) {
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        <h1 className="text-xl font-bold text-gray-900">
          InBody 해외법인 대시보드
        </h1>
        <div className="text-sm text-gray-500">
          마지막 업데이트: {formatDate(new Date())}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-gray-50 p-6">
        <div className="h-full max-w-7xl mx-auto">
          <WorldMap
            subsidiaries={subsidiaries}
            selectedId={selectedSubsidiaryId}
            onSubsidiaryClick={setSelectedSubsidiaryId}
          />
        </div>
      </main>
    </div>
  );
}
```

#### Step 3-4: 테스트

```bash
npm run dev
```

**체크리스트:**
- [ ] 지도가 렌더링됨
- [ ] 11개 법인 마커가 올바른 위치에 표시
- [ ] 마커 hover 시 크기 확대
- [ ] 마커 클릭 시 선택 상태 변경
- [ ] 콘솔에 에러 없음

---

### 5.4 법인 정보 카드 구현 (2시간)

#### Step 4-1: Financial Service 생성

**Cursor Prompt:**

```
lib/services/financialService.ts를 만들어줘:

함수 2개:

1. getLatestFinancialData(subsidiaryId: string)
   - 해당 법인의 가장 최근 분기 데이터 1개 반환
   - subsidiary 정보도 join
   - 반환 타입: FinancialDataWithSubsidiary | null

2. getFinancialTrend(subsidiaryId: string, quarters: number = 4)
   - 최근 N분기 데이터 반환 (내림차순)
   - 반환 타입: FinancialData[]

에러 처리:
- try-catch로 감싸기
- 에러 발생 시 console.error + null/빈배열 반환
```

**생성된 파일:**

```typescript
// lib/services/financialService.ts
import { supabase } from '@/lib/supabase/client';
import type { FinancialData, FinancialDataWithSubsidiary } from '@/lib/supabase/types';

/**
 * 특정 법인의 최신 재무 데이터 조회
 */
export async function getLatestFinancialData(
  subsidiaryId: string
): Promise<FinancialDataWithSubsidiary | null> {
  try {
    const { data, error } = await supabase
      .from('financial_data')
      .select(`
        *,
        subsidiaries (*)
      `)
      .eq('subsidiary_id', subsidiaryId)
      .order('fiscal_year', { ascending: false })
      .order('quarter', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to fetch latest financial data:', error);
    return null;
  }
}

/**
 * 특정 법인의 최근 N분기 재무 데이터 조회 (차트용)
 */
export async function getFinancialTrend(
  subsidiaryId: string,
  quarters: number = 4
): Promise<FinancialData[]> {
  try {
    const { data, error } = await supabase
      .from('financial_data')
      .select('*')
      .eq('subsidiary_id', subsidiaryId)
      .order('fiscal_year', { ascending: false })
      .order('quarter', { ascending: false })
      .limit(quarters);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch financial trend:', error);
    return [];
  }
}
```

#### Step 4-2: SubsidiaryCard 컴포넌트 생성

**Cursor Prompt:**

```
components/dashboard/SubsidiaryCard.tsx를 만들어줘:

요구사항:
1. 'use client' 컴포넌트
2. useEffect로 selectedSubsidiaryId 변경 시 데이터 fetch
3. 로딩 상태: Skeleton (shadcn/ui)
4. 에러 상태: 에러 메시지 표시

UI 구조 (shadcn Card 사용):
- CardHeader: 
  - 법인명 (text-2xl font-bold)
  - 도시, 국가 (text-sm text-gray-500)
  - 닫기 버튼 (우측 상단)
- CardContent:
  - 분기 정보 (Badge로 "2024 Q4")
  - 3개 메트릭:
    * 매출액 (text-3xl font-bold)
    * 영업이익 (text-xl)
    * 영업이익률 (text-xl, 마이너스면 text-red-600)
  - 구분선 (Separator)
  - FinancialChart 컴포넌트 (다음 단계에서 구현)

Props:
- subsidiaryId: string | null
- onClose: () => void

스타일:
- 고정 너비 400px (데스크톱)
- 최대 높이 80vh, overflow-y-auto
- 부드러운 애니메이션 (animate-in slide-in-from-right)
```

**생성된 파일:**

```typescript
// components/dashboard/SubsidiaryCard.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { X } from 'lucide-react';
import { getLatestFinancialData, getFinancialTrend } from '@/lib/services/financialService';
import { formatKRW, formatMargin, formatPeriod, calculateMargin } from '@/lib/utils/format';
import type { FinancialData, FinancialDataWithSubsidiary } from '@/lib/supabase/types';

interface SubsidiaryCardProps {
  subsidiaryId: string | null;
  onClose: () => void;
}

export function SubsidiaryCard({ subsidiaryId, onClose }: SubsidiaryCardProps) {
  const [data, setData] = useState<FinancialDataWithSubsidiary | null>(null);
  const [trendData, setTrendData] = useState<FinancialData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subsidiaryId) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const [latest, trend] = await Promise.all([
          getLatestFinancialData(subsidiaryId),
          getFinancialTrend(subsidiaryId, 4),
        ]);

        if (!latest) {
          setError('재무 데이터를 찾을 수 없습니다.');
          return;
        }

        setData(latest);
        setTrendData(trend);
      } catch (err) {
        setError('데이터를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [subsidiaryId]);

  if (!subsidiaryId) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-[400px] bg-white border-l border-gray-200 shadow-xl z-50 animate-in slide-in-from-right duration-300">
      <Card className="h-full border-0 rounded-none overflow-y-auto">
        <CardHeader className="sticky top-0 bg-white border-b z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {loading ? (
                <>
                  <Skeleton className="h-8 w-48 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </>
              ) : data ? (
                <>
                  <CardTitle className="text-2xl">{data.subsidiaries.name}</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {data.subsidiaries.city}, {data.subsidiaries.country}
                  </p>
                </>
              ) : null}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-600">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-6">
              {/* Period Badge */}
              <Badge variant="secondary" className="text-sm">
                {formatPeriod(data.fiscal_year, data.quarter)} 실적
              </Badge>

              {/* Metrics */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">매출액</p>
                  <p className="text-3xl font-bold">{formatKRW(data.revenue_krw)}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">영업이익</p>
                  <p className={`text-xl font-semibold ${
                    (data.operating_profit_krw || 0) < 0 ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {formatKRW(data.operating_profit_krw || 0)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">영업이익률</p>
                  <p className={`text-xl font-semibold ${
                    calculateMargin(data.operating_profit_krw || 0, data.revenue_krw) < 0
                      ? 'text-red-600'
                      : 'text-gray-900'
                  }`}>
                    {formatMargin(
                      calculateMargin(data.operating_profit_krw || 0, data.revenue_krw)
                    )}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Chart Section - 다음 단계에서 구현 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">최근 4분기 추이</h3>
                <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
                  차트는 다음 단계에서 구현
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

#### Step 4-3: DashboardClient 업데이트

**Cursor Prompt:**

```
components/dashboard/DashboardClient.tsx를 업데이트해줘:

변경사항:
1. SubsidiaryCard import
2. 레이아웃 변경:
   - selectedSubsidiaryId가 있을 때: WorldMap 70% + SubsidiaryCard 30%
   - 없을 때: WorldMap 100%
3. SubsidiaryCard의 onClose 핸들러 추가

레이아웃:
- flex로 구성
- WorldMap: flex-1
- SubsidiaryCard: 고정폭 (자체 스타일 적용)
```

**업데이트된 코드:**

```typescript
// components/dashboard/DashboardClient.tsx
'use client';

import { useState } from 'react';
import { Subsidiary } from '@/lib/supabase/types';
import { WorldMap } from './WorldMap';
import { SubsidiaryCard } from './SubsidiaryCard';
import { formatDate } from '@/lib/utils/format';

interface DashboardClientProps {
  subsidiaries: Subsidiary[];
}

export function DashboardClient({ subsidiaries }: DashboardClientProps) {
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-10">
        <h1 className="text-xl font-bold text-gray-900">
          InBody 해외법인 대시보드
        </h1>
        <div className="text-sm text-gray-500">
          마지막 업데이트: {formatDate(new Date())}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Map Section */}
        <div className={`transition-all duration-300 ${
          selectedSubsidiaryId ? 'w-[calc(100%-400px)]' : 'w-full'
        }`}>
          <div className="h-full p-6 bg-gray-50">
            <div className="h-full max-w-7xl mx-auto">
              <WorldMap
                subsidiaries={subsidiaries}
                selectedId={selectedSubsidiaryId}
                onSubsidiaryClick={setSelectedSubsidiaryId}
              />
            </div>
          </div>
        </div>

        {/* Subsidiary Card */}
        <SubsidiaryCard
          subsidiaryId={selectedSubsidiaryId}
          onClose={() => setSelectedSubsidiaryId(null)}
        />
      </main>
    </div>
  );
}
```

#### Step 4-4: 테스트

**체크리스트:**
- [ ] 법인 마커 클릭 시 오른쪽에 카드 슬라이드인
- [ ] 로딩 스켈레톤 표시
- [ ] 법인명, 도시, 국가 정확히 표시
- [ ] 매출액, 영업이익, 이익률 정확히 계산
- [ ] 닫기(X) 버튼 클릭 시 카드 닫힘
- [ ] 다른 법인 클릭 시 카드 내용 변경

---

### 5.5 재무 차트 구현 (1-2시간)

#### Step 5-1: FinancialChart 컴포넌트 생성

**Cursor Prompt:**

```
components/dashboard/FinancialChart.tsx를 만들어줘:

요구사항:
1. Recharts의 BarChart 사용
2. 최근 4분기 매출 추이 시각화
3. X축: "2024 Q1" 형식
4. Y축: 억원 단위
5. Tooltip에 정확한 금액 표시
6. 반응형 (ResponsiveContainer)

Props:
- data: FinancialData[]

데이터 가공:
- fiscal_year, quarter → "YYYY QN" 형식
- revenue_krw → 억원 단위로 변환
- 오래된 순서로 정렬 (차트는 시간 순)

스타일:
- Bar 색상: #3B82F6 (blue-500)
- Grid: 점선
- Tooltip: 카드 스타일, 그림자
```

**생성된 파일:**

```typescript
// components/dashboard/FinancialChart.tsx
'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { FinancialData } from '@/lib/supabase/types';
import { formatKRW, formatPeriod } from '@/lib/utils/format';

interface FinancialChartProps {
  data: FinancialData[];
}

interface ChartDataPoint {
  period: string;
  revenue: number; // 억원 단위
  revenueRaw: number; // 원 단위 (tooltip용)
}

export function FinancialChart({ data }: FinancialChartProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    // 시간 순서대로 정렬 (오래된 것부터)
    const sorted = [...data].sort((a, b) => {
      if (a.fiscal_year !== b.fiscal_year) {
        return a.fiscal_year - b.fiscal_year;
      }
      return a.quarter - b.quarter;
    });

    return sorted.map((d) => ({
      period: formatPeriod(d.fiscal_year, d.quarter),
      revenue: d.revenue_krw / 100000000, // 억원 단위
      revenueRaw: d.revenue_krw,
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12 }}
          tickLine={false}
          tickFormatter={(value) => `${value}억`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="revenue"
          fill="#3B82F6"
          radius={[4, 4, 0, 0]}
          maxBarSize={60}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || !payload[0]) return null;

  const data = payload[0].payload as ChartDataPoint;

  return (
    <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
      <p className="text-sm font-medium text-gray-900 mb-1">{data.period}</p>
      <p className="text-lg font-bold text-blue-600">
        {formatKRW(data.revenueRaw)}
      </p>
    </div>
  );
}
```

#### Step 5-2: SubsidiaryCard에 차트 추가

**Cursor Prompt:**

```
components/dashboard/SubsidiaryCard.tsx를 업데이트해줘:

변경사항:
1. FinancialChart import
2. "차트는 다음 단계에서 구현" 부분을 실제 차트로 교체
3. trendData가 비어있으면 "데이터 없음" 메시지

조건:
- trendData.length > 0일 때만 차트 렌더링
```

**업데이트된 부분:**

```typescript
// components/dashboard/SubsidiaryCard.tsx (일부)
import { FinancialChart } from './FinancialChart';

// ... (기존 코드)

<div>
  <h3 className="text-sm font-medium text-gray-700 mb-4">최근 4분기 추이</h3>
  {trendData.length > 0 ? (
    <FinancialChart data={trendData} />
  ) : (
    <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
      추이 데이터가 없습니다.
    </div>
  )}
</div>
```

#### Step 5-3: 테스트

**체크리스트:**
- [ ] 차트가 렌더링됨
- [ ] 4개 막대가 표시 (데이터가 있는 경우)
- [ ] X축 라벨 "2024 Q1" 형식
- [ ] Y축 "500억" 형식
- [ ] 막대 hover 시 tooltip 표시
- [ ] tooltip에 정확한 금액 표시

---

### 5.6 UI/UX 개선 (1-2시간)

#### Step 5-6-1: 지도 Tooltip 추가

**Cursor Prompt:**

```
components/dashboard/WorldMap.tsx를 업데이트해줘:

react-tooltip을 사용해서 마커 hover 시 법인명 표시

요구사항:
1. react-tooltip 패키지 import
2. 각 Marker에 data-tooltip-id, data-tooltip-content 추가
3. Tooltip 컴포넌트 렌더링 (지도 외부)

스타일:
- 작은 폰트 (text-xs)
- 어두운 배경
- 빠른 표시 (delayShow: 100ms)
```

#### Step 5-6-2: 로딩 상태 개선

**Cursor Prompt:**

```
app/loading.tsx를 만들어줘:

전체 페이지 로딩 skeleton:
- 헤더 skeleton
- 지도 영역 skeleton (회색 배경 + pulse 애니메이션)

shadcn Skeleton 컴포넌트 사용
```

#### Step 5-6-3: 에러 페이지 추가

**Cursor Prompt:**

```
app/error.tsx를 만들어줘:

Error Boundary:
- 'use client' 컴포넌트
- 에러 메시지 표시
- "다시 시도" 버튼
- reset() 함수 호출

디자인:
- 중앙 정렬
- 아이콘 포함
- 친절한 메시지
```

#### Step 5-6-4: 반응형 레이아웃

**Cursor Prompt:**

```
components/dashboard/DashboardClient.tsx를 업데이트해줘:

모바일 반응형:
- 768px 이하: SubsidiaryCard를 하단 슬라이드업 (drawer 스타일)
- 768px 이상: 현재 우측 패널 유지

Tailwind breakpoints 사용:
- md:w-[400px] (데스크톱)
- max-md:bottom-0 max-md:right-0 max-md:left-0 max-md:h-[70vh] (모바일)
```

#### Step 5-6-5: 마이크로 인터랙션

**Cursor Prompt:**

```
다음 컴포넌트들에 transition 효과 추가:

1. WorldMap.tsx:
   - 마커 hover: scale, opacity transition
   - 선택된 마커: pulse 애니메이션

2. SubsidiaryCard.tsx:
   - 카드 등장: slide-in 애니메이션
   - 메트릭 숫자: 부드러운 fade-in

3. FinancialChart.tsx:
   - Bar hover: opacity 변경

Tailwind animate 클래스 사용
```

---

### 5.7 최종 테스트 및 배포 (1시간)

#### Step 7-1: 로컬 전체 테스트

**테스트 체크리스트:**

```markdown
## 기능 테스트
- [ ] 페이지 로드 (< 2초)
- [ ] 지도에 11개 법인 마커 표시
- [ ] 마커 hover 시 tooltip
- [ ] 마커 클릭 시 카드 열림
- [ ] 카드에 법인 정보 정확히 표시
- [ ] 차트에 4분기 데이터 표시
- [ ] 닫기 버튼 작동
- [ ] 다른 법인 선택 시 카드 업데이트

## UI/UX 테스트
- [ ] 로딩 상태 skeleton 표시
- [ ] 에러 발생 시 에러 메시지
- [ ] 애니메이션 부드럽게 작동
- [ ] 반응형 (데스크톱 + 모바일)

## 데이터 정확성
- [ ] 매출액 포맷팅 정확 (억원)
- [ ] 영업이익률 계산 정확
- [ ] 차트 X축 라벨 정확
- [ ] 분기 순서 정확 (오래된 순)

## 브라우저 호환성
- [ ] Chrome
- [ ] Safari
- [ ] Firefox
```

#### Step 7-2: 빌드 테스트

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과 확인
npm run start

# 빌드 에러 없는지 확인
# 경고 무시해도 됨 (dev dependency 관련)
```

#### Step 7-3: Vercel 배포

**Step A: GitHub Repository 생성**

```bash
# GitHub에서 새 저장소 생성
# https://github.com/new

# 로컬 저장소 연결
git remote add origin https://github.com/YOUR_USERNAME/subsidiary-dashboard.git
git branch -M main
git push -u origin main
```

**Step B: Vercel 프로젝트 생성**

1. https://vercel.com 접속
2. "Add New... → Project" 클릭
3. GitHub 저장소 import
4. Framework Preset: Next.js (자동 감지)
5. Environment Variables 추가:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   ```
6. "Deploy" 클릭 (3-5분 소요)

**Step C: 배포 확인**

- 배포 URL 확인 (예: `subsidiary-dashboard.vercel.app`)
- 브라우저에서 접속
- 모든 기능 작동 확인

#### Step 7-4: README 작성

**Cursor Prompt:**

```
README.md를 작성해줘:

섹션:
1. 프로젝트 소개
2. 주요 기능 (스크린샷 placeholder 포함)
3. 기술 스택
4. 로컬 실행 방법
5. 환경 변수 설정
6. 배포 URL
7. 개발 로드맵 (Phase 2, 3)
8. 라이선스

톤: 전문적이지만 읽기 쉽게
언어: 한국어
```

---

## 6. 개발 일정

### 6.1 3일 타임라인 (상세)

#### Day 1: 화요일 (저녁 2-3시간)

| 시간 | 작업 | 완료 기준 |
|-----|------|----------|
| 18:00-18:30 | 프로젝트 초기화 (5.1) | npm run dev 실행 성공 |
| 18:30-19:00 | Supabase 연동 (5.2) | 테이블 생성 완료 |
| 19:00-19:30 | 법인 데이터 입력 | 11개 법인 입력 확인 |
| 19:30-20:30 | 지도 컴포넌트 (5.3.1) | 지도에 마커 표시 |
| 20:30-21:00 | 메인 페이지 연동 (5.3.3) | 마커 클릭 반응 |

**Day 1 완료 상태:**
- ✅ 지도에 11개 법인 표시
- ✅ 마커 클릭 시 콘솔에 ID 출력
- ✅ Git 커밋

---

#### Day 2: 수요일 (저녁 3-4시간)

| 시간 | 작업 | 완료 기준 |
|-----|------|----------|
| 18:00-18:30 | 재무 데이터 입력 | 샘플 데이터 20-30건 |
| 18:30-19:30 | Financial Service (5.4.1) | 데이터 fetch 함수 작동 |
| 19:30-21:00 | SubsidiaryCard (5.4.2) | 카드에 데이터 표시 |
| 21:00-21:30 | 레이아웃 통합 (5.4.3) | 카드 열림/닫힘 작동 |

**Day 2 완료 상태:**
- ✅ 법인 클릭 시 카드 열림
- ✅ 매출/이익 데이터 표시
- ✅ Git 커밋

---

#### Day 3: 목요일 (저녁 3-4시간)

| 시간 | 작업 | 완료 기준 |
|-----|------|----------|
| 18:00-19:30 | 차트 구현 (5.5) | 4분기 차트 표시 |
| 19:30-20:30 | UI 개선 (5.6) | 애니메이션, 반응형 |
| 20:30-21:00 | 전체 테스트 (5.7.1) | 체크리스트 완료 |
| 21:00-21:30 | 배포 (5.7.3) | Vercel URL 획득 |

**Day 3 완료 상태:**
- ✅ 모든 기능 작동
- ✅ 배포 완료
- ✅ README 작성

---

#### Day 4: 금요일 (오전)

| 시간 | 작업 |
|-----|------|
| 09:00-09:30 | 최종 확인, 버그 수정 |
| 09:30-10:00 | 데모 준비 (주요 시나리오 연습) |
| 10:00+ | 부사장님께 데모 |

---

### 6.2 리스크 관리

| 리스크 | 발생 가능성 | 대응 방안 |
|--------|-----------|----------|
| 3일 안에 완성 못함 | 중 | 우선순위 낮은 기능 제거 (tooltip, 애니메이션) |
| Supabase 연결 문제 | 하 | 문서 참조, 하드코딩 데이터로 우회 |
| 지도 렌더링 느림 | 하 | 법인 수 적어서 문제 없음, 최적화는 Phase 2 |
| 차트 구현 막힘 | 중 | Recharts 공식 예제 참고, 단순 막대그래프만 |
| 배포 실패 | 하 | Vercel 로그 확인, 로컬에서 build 테스트 먼저 |

---

## 7. 배포 및 테스트

### 7.1 배포 체크리스트

```markdown
## Vercel 배포 전
- [ ] npm run build 성공
- [ ] 환경 변수 .env.local 확인
- [ ] .gitignore에 .env.local 포함 확인
- [ ] Git 저장소 push 완료

## Vercel 설정
- [ ] GitHub 저장소 연결
- [ ] Environment Variables 입력
  - [ ] NEXT_PUBLIC_SUPABASE_URL
  - [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] Framework Preset: Next.js
- [ ] Deploy 버튼 클릭

## 배포 후 확인
- [ ] 배포 성공 (Build log 확인)
- [ ] 프로덕션 URL 접속
- [ ] 지도 렌더링
- [ ] 마커 클릭
- [ ] 카드 데이터 표시
- [ ] 차트 표시
- [ ] 모바일 반응형
```

### 7.2 성능 최적화 (Phase 2)

현재 MVP에서는 성능 최적화를 최소화하고, Phase 2에서 다음을 개선:

- [ ] 이미지 최적화 (Next.js Image)
- [ ] 지도 렌더링 최적화 (React.memo)
- [ ] 데이터 캐싱 (React Query)
- [ ] Code splitting (dynamic import)

---

## 8. 트러블슈팅

### 8.1 자주 발생하는 에러

#### 에러 1: Supabase 연결 실패

```
Error: Invalid Supabase URL or Key
```

**해결 방법:**
1. `.env.local` 파일 확인
2. Supabase Dashboard에서 URL, Key 재확인
3. 서버 재시작: `npm run dev` 종료 후 재실행

#### 에러 2: 지도 렌더링 안 됨

```
Module not found: Can't resolve 'react-simple-maps'
```

**해결 방법:**
```bash
npm install react-simple-maps
npm install -D @types/react-simple-maps
```

#### 에러 3: 차트 표시 안 됨

```
Uncaught Error: Recharts requires DOM
```

**해결 방법:**
- `'use client'` 지시어 추가
- Server Component에서 Client Component로 변경

#### 에러 4: 빌드 실패

```
Type error: Property 'XXX' does not exist
```

**해결 방법:**
1. TypeScript 타입 확인
2. `lib/supabase/types.ts` 인터페이스 확인
3. 필요시 `@ts-ignore` 임시 사용 (Phase 2에서 수정)

#### 에러 5: 배포 후 환경 변수 안 됨

```
Error: Supabase client not initialized
```

**해결 방법:**
1. Vercel Dashboard → Settings → Environment Variables
2. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가
3. Redeploy

### 8.2 Cursor AI 사용 팁

#### 팁 1: 구체적인 프롬프트

❌ **나쁜 예:**
```
차트 컴포넌트 만들어줘
```

✅ **좋은 예:**
```
Recharts의 BarChart를 사용해서 최근 4분기 매출 추이를 보여주는 
FinancialChart 컴포넌트를 만들어줘. 
X축은 "2024 Q1" 형식, Y축은 억원 단위, Tooltip에 정확한 금액 표시.
Props는 data: FinancialData[]
```

#### 팁 2: 에러 전체 복사

에러 발생 시:
1. 전체 에러 메시지 복사 (스택 트레이스 포함)
2. Cursor에 붙여넣기
3. "이 에러를 어떻게 해결하나요?" 질문

#### 팁 3: 코드 리뷰 요청

```
다음 코드를 검토하고 개선점을 제안해줘:
[코드 붙여넣기]

특히:
1. 타입 안전성
2. 에러 처리
3. 성능 최적화
```

#### 팁 4: 단계별 작업

한 번에 너무 많은 것을 요청하지 말고:
1. 기본 구조 생성
2. 데이터 연동
3. 스타일링
4. 최적화

순서대로 진행

---

## 9. Phase 2 로드맵 (참고용)

### 9.1 엑셀 업로드 기능 (Week 1)

- [ ] 파일 업로드 UI (react-dropzone)
- [ ] 엑셀 파싱 (xlsx)
- [ ] 데이터 검증
- [ ] Supabase bulk insert
- [ ] 업로드 히스토리 테이블

### 9.2 4개 카테고리 구현 (Week 2)

- [ ] 탭 네비게이션 (shadcn Tabs)
- [ ] **재무실적**: 확장된 지표, 필터링
- [ ] **내부거래**: 법인 간 거래 내역
- [ ] **시스템 사용**: ERP 사용 현황
- [ ] **분기별 마감 일정표**: 캘린더 뷰

### 9.3 고급 기능 (Week 3)

- [ ] 목표 대비 달성률 계산 및 표시
- [ ] 전년 동기 대비 성장률
- [ ] PDF/Excel Export
- [ ] 다크 모드
- [ ] 사용자 인증 (Supabase Auth)

---

## 10. 연락처 및 지원

### 개발자
- 이름: 조승현
- 소속: InBody Global Business Support Team
- 이메일: (추가 예정)

### 기술 지원
- Supabase Discord: https://discord.supabase.com
- Next.js Discussions: https://github.com/vercel/next.js/discussions
- Cursor Community: https://forum.cursor.sh

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|-----|------|----------|
| 0.1.0 | 2026-01-07 | 초안 작성 |

---

