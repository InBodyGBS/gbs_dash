# InBody Global Business Support Dashboard

InBody 해외법인 관리 대시보드 - 세계지도 기반 인터랙티브 재무 실적 시각화 플랫폼

## 📋 프로젝트 개요

17개 해외법인의 재무 데이터를 세계지도 위에 시각화하여 한눈에 파악할 수 있는 대시보드입니다.

### 주요 기능

- 🗺️ **세계지도 시각화**: 법인 위치를 지역별 색상으로 구분하여 표시
- 📊 **재무 실적 대시보드**: 법인별 매출액, 영업이익, 영업이익률 확인
- 📈 **추이 차트**: 최근 4분기 실적 트렌드 분석
- 🎯 **목표 달성률**: 목표 대비 실적 비교 (데이터가 있는 경우)
- 🔄 **실시간 업데이트**: Supabase 연동으로 데이터 동기화

## 🛠️ 기술 스택

### 코어 기술

- **Next.js 15** - React 프레임워크 (App Router)
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 유틸리티 기반 스타일링
- **shadcn/ui** - 고품질 UI 컴포넌트

### 주요 라이브러리

- **Supabase** - 백엔드 및 데이터베이스
- **Recharts** - 차트 시각화
- **react-simple-maps** - 지도 렌더링
- **date-fns** - 날짜 포맷팅
- **Lucide React** - 아이콘

## 🚀 시작하기

### 사전 요구사항

- Node.js 18.x 이상
- npm 또는 yarn
- Supabase 계정

### 설치 방법

1. **저장소 클론**

```bash
git clone <repository-url>
cd gbs_dash
```

2. **의존성 설치**

```bash
npm install
```

3. **환경 변수 설정**

`.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> Supabase URL과 Key는 [Supabase Dashboard](https://supabase.com/dashboard) > Project Settings > API에서 확인할 수 있습니다.

4. **개발 서버 실행**

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 📁 프로젝트 구조

```
gbs_dash/
├── app/
│   ├── (dashboard)/          # 대시보드 페이지 그룹
│   │   ├── layout.tsx        # 대시보드 레이아웃
│   │   └── page.tsx          # 메인 대시보드
│   ├── page.tsx              # 루트 페이지
│   ├── layout.tsx            # 루트 레이아웃
│   └── globals.css           # 글로벌 스타일
├── components/
│   ├── dashboard/
│   │   ├── MapContainer.tsx      # 지도 컨테이너
│   │   ├── WorldMap.tsx          # 세계지도 컴포넌트
│   │   ├── SubsidiaryCard.tsx    # 법인 정보 카드
│   │   └── FinancialChart.tsx    # 재무 차트
│   ├── layout/
│   │   ├── Sidebar.tsx           # 좌측 사이드바
│   │   ├── Header.tsx            # 상단 헤더
│   │   └── DashboardLayout.tsx   # 레이아웃 래퍼
│   └── ui/                   # shadcn/ui 컴포넌트
├── lib/
│   ├── supabase/
│   │   ├── client.ts         # Supabase 클라이언트
│   │   └── types.ts          # 데이터베이스 타입
│   ├── services/
│   │   └── financialService.ts   # 재무 데이터 서비스
│   ├── utils/
│   │   └── format.ts         # 포맷팅 유틸리티
│   ├── constants/
│   │   ├── categories.ts     # 카테고리 정의
│   │   └── regions.ts        # 지역 상수
│   └── utils.ts              # 공통 유틸리티
├── .cursor/
│   └── rules/
│       └── project-rules.mdc # 프로젝트 개발 규칙
└── docs/
    └── PRD.md                # 프로젝트 요구사항 문서
```

## 💾 데이터베이스 구조

### subsidiaries (법인 정보)

| 컬럼 | 타입 | 설명 |
|-----|------|------|
| id | UUID | 법인 고유 ID |
| name | TEXT | 법인명 |
| code | TEXT | 법인 코드 |
| country | TEXT | 국가 |
| city | TEXT | 도시 |
| latitude | DECIMAL | 위도 |
| longitude | DECIMAL | 경도 |
| region | TEXT | 지역 (Americas, Europe, Asia-Pacific) |

### financial_data (재무 데이터)

| 컬럼 | 타입 | 설명 |
|-----|------|------|
| id | UUID | 데이터 고유 ID |
| subsidiary_id | UUID | 법인 ID (FK) |
| fiscal_year | INTEGER | 회계연도 |
| quarter | INTEGER | 분기 (1-4) |
| revenue_krw | BIGINT | 매출액 (원화) |
| operating_profit_krw | BIGINT | 영업이익 (원화) |
| target_revenue_krw | BIGINT | 목표 매출액 (선택) |

## 🎨 주요 기능 설명

### 1. 세계지도 시각화

- 법인 위치를 마커로 표시
- 지역별 색상 구분 (Americas: 파랑, Europe: 초록, Asia-Pacific: 주황)
- 마커 클릭 시 상세 정보 표시
- Hover 시 법인명 툴팁

### 2. 법인 정보 카드

- 우측 슬라이드인 패널
- 최신 분기 재무 실적 표시
- 매출액, 영업이익, 영업이익률 계산
- 목표 달성률 (데이터가 있는 경우)

### 3. 재무 차트

- 최근 4분기 매출 추이
- 막대그래프 형태
- 억원 단위로 표시
- Hover 시 상세 금액 툴팁

### 4. 카테고리 네비게이션

- Quarterly Closing (분기 마감)
- Financial Result (재무 실적)
- Issue (현안 사항)
- Inter-co Transaction (법인간 거래)
- System (시스템 현황)
- Audit and Tax (감사 및 세무)
- P-File (문서 보관함)

## 📝 개발 규칙

프로젝트의 코딩 컨벤션과 개발 규칙은 [.cursor/rules/project-rules.mdc](.cursor/rules/project-rules.mdc)를 참조하세요.

주요 규칙:
- 함수형 컴포넌트 사용
- 화살표 함수 작성
- TypeScript strict mode
- 한글 주석 필수
- ESLint 규칙 준수

## 🚢 배포

### Vercel 배포

1. GitHub에 코드 푸시
2. [Vercel](https://vercel.com)에서 프로젝트 import
3. 환경 변수 설정
4. Deploy 클릭

### 환경 변수 설정 (Vercel)

Vercel Dashboard → Settings → Environment Variables에 다음을 추가:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 📈 개발 로드맵

### Phase 1 (현재) ✅
- ✅ 세계지도 시각화
- ✅ 법인 정보 카드
- ✅ 재무 차트
- ✅ 기본 레이아웃

### Phase 2 (계획)
- [ ] 엑셀 업로드 기능
- [ ] 4개 카테고리 상세 페이지
- [ ] 목표 달성률 분석
- [ ] 전년 동기 대비 성장률

### Phase 3 (계획)
- [ ] 사용자 인증
- [ ] 권한 관리
- [ ] PDF/Excel Export
- [ ] 실시간 알림

## 🐛 트러블슈팅

### Supabase 연결 오류

```
Error: Invalid Supabase URL or Key
```

**해결방법**: `.env.local` 파일의 환경 변수를 확인하고 서버를 재시작하세요.

### 지도가 렌더링되지 않음

**해결방법**: 
```bash
npm install react-simple-maps
```

### 차트가 표시되지 않음

**해결방법**: 컴포넌트에 `'use client'` 지시어가 있는지 확인하세요.

## 📄 라이선스

© 2026 InBody Co., Ltd. All rights reserved.

---

## 👥 팀

**Global Business Support Team**
- 담당자: 조승현

## 📞 문의

- GitHub Issues를 통해 버그 리포트 및 기능 요청
- 프로젝트 관련 문의: GBS Team

---

**Made with ❤️ by InBody GBS Team**
