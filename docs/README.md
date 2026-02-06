# 회계기준 카드뉴스 Supabase 배포 가이드

---

## 📋 목차
1. [개요](#개요)
2. [파일 구조](#파일-구조)
3. [Supabase 설정](#supabase-설정)
4. [데이터 삽입 방법](#데이터-삽입-방법)
5. [프론트엔드 연동](#프론트엔드-연동)
6. [활용 예시](#활용-예시)

---

## 개요

### 목적
IFRS (국제회계기준)와 Dutch GAAP (네덜란드 회계기준) 회계원칙을 카드뉴스 형태로 정리하여 Supabase에 저장하고, 웹/앱에서 활용할 수 있도록 구조화합니다.

### 주요 기능
- ✅ 회계기준별 카테고리 구분 (IFRS 6개, Dutch GAAP 6개)
- ✅ 카드뉴스 형식의 구조화된 데이터
- ✅ 핵심 포인트, 예시, 시각 데이터 포함
- ✅ 실무 팁 제공
- ✅ 태그 기반 검색 지원
- ✅ 중요도 표시

---

## 파일 구조

```
accounting-standards-card-news/
├── accounting_standards_schema.sql      # DB 스키마 정의
├── ifrs_card_news_data.json            # IFRS 카드뉴스 데이터
├── dutch_gaap_card_news_data.json      # Dutch GAAP 카드뉴스 데이터
├── insert_card_news_data.sql           # SQL 삽입 스크립트
├── insert_card_news_script.ts          # TypeScript 삽입 스크립트
└── README.md                            # 이 문서
```

---

## Supabase 설정

### 1단계: 프로젝트 생성
1. https://supabase.com 접속
2. "New Project" 클릭
3. 프로젝트 이름, 데이터베이스 비밀번호 설정
4. Region 선택 (예: ap-northeast-2 for Seoul)

### 2단계: 데이터베이스 스키마 생성
1. Supabase Dashboard → SQL Editor
2. `accounting_standards_schema.sql` 파일 내용 복사
3. "Run" 클릭하여 실행

**생성되는 테이블**:
- `accounting_standards` - 회계기준 마스터
- `card_categories` - 카테고리
- `card_news` - 카드뉴스 메인
- `card_references` - 참고자료
- `practical_tips` - 실무 팁

### 3단계: RLS (Row Level Security) 확인
스키마 스크립트 실행 시 자동으로 RLS 정책이 생성됩니다:
- ✅ 모든 사용자 읽기 가능
- ✅ 인증된 사용자만 쓰기 가능

---

## 데이터 삽입 방법

### 방법 1: TypeScript 스크립트 사용 (권장)

#### 1) 환경 변수 설정
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # 필수!
```

#### 2) 패키지 설치
```bash
npm install @supabase/supabase-js
npm install --save-dev ts-node @types/node
```

#### 3) JSON 파일 위치
```
your-project/
├── scripts/
│   ├── insert_card_news_script.ts
│   ├── ifrs_card_news_data.json
│   └── dutch_gaap_card_news_data.json
```

#### 4) 실행
```bash
# 데이터 삽입
npx ts-node scripts/insert_card_news_script.ts

# 기존 데이터 삭제 후 재삽입
npx ts-node scripts/insert_card_news_script.ts --clear
```

**예상 출력**:
```
🚀 Starting data insertion...

📊 Inserting IFRS data...
  → Inserting standard: International Financial Reporting Standards
  ✓ Standard inserted: xxx-xxx-xxx
  → Inserting 6 categories...
  ✓ 6 categories inserted
  → Inserting 20 cards...
  ✓ 20/20 cards inserted
  → Inserting practical tips...
  ✓ 15 practical tips inserted

📋 Inserting Dutch GAAP data...
  ...

✅ All data inserted successfully!

🔍 Verifying inserted data...
  ✓ Standards count: 2
  ✓ Categories count: 12
  ✓ Cards count: 40
  ✓ Important cards count: 18
  ✓ Full view records: 40

🎉 Done!
```

---

### 방법 2: Supabase Dashboard UI 사용

#### 1) Table Editor에서 직접 입력
1. Dashboard → Table Editor
2. `accounting_standards` 테이블 선택
3. "Insert row" 클릭
4. JSON 데이터를 수동으로 입력

**장점**: 코드 없이 가능
**단점**: 대량 데이터 입력 시 비효율적

---

### 방법 3: SQL 직접 실행

#### 1) Supabase SQL Editor에서
1. `insert_card_news_data.sql` 파일 열기
2. 내용 복사하여 SQL Editor에 붙여넣기
3. "Run" 클릭

**주의**: 샘플 SQL은 일부 데이터만 포함되어 있습니다. 전체 데이터는 TypeScript 스크립트 사용 권장.

---

## 프론트엔드 연동

### 1. Supabase Client 설정

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

---

### 2. 데이터 조회 예시

#### 모든 회계기준 조회
```typescript
const { data: standards, error } = await supabase
  .from('accounting_standards')
  .select('*')

console.log(standards)
// [
//   { standard_code: 'IFRS', standard_name: '...' },
//   { standard_code: 'DUTCH_GAAP', standard_name: '...' }
// ]
```

#### IFRS 카드뉴스 전체 조회 (뷰 사용)
```typescript
const { data: cards, error } = await supabase
  .from('card_news_full')
  .select('*')
  .eq('standard_code', 'IFRS')
  .order('card_number')

console.log(cards)
// [
//   {
//     id: 'xxx',
//     title: 'IFRS 적용 기준',
//     category_name: '재무제표 작성 기준',
//     content: '...',
//     key_points: [...],
//     ...
//   },
//   ...
// ]
```

#### 중요 카드만 조회
```typescript
const { data: importantCards } = await supabase
  .from('card_news_full')
  .select('*')
  .eq('is_important', true)
```

#### 태그로 검색
```typescript
const { data: leaseCards } = await supabase
  .from('card_news')
  .select('*')
  .contains('tags', ['IFRS16', '리스'])
```

#### 카테고리별 조회
```typescript
const { data: categories } = await supabase
  .from('card_categories')
  .select(`
    *,
    card_news(*)
  `)
  .eq('standard_id', 'ifrs-standard-uuid')
```

---

### 3. React Component 예시

#### 카드뉴스 리스트 컴포넌트
```tsx
// components/CardNewsList.tsx
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Card {
  id: string
  title: string
  subtitle: string
  content: string
  category_name: string
  category_icon: string
  category_color: string
  is_important: boolean
}

export default function CardNewsList({ standardCode }: { standardCode: string }) {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCards() {
      const { data, error } = await supabase
        .from('card_news_full')
        .select('*')
        .eq('standard_code', standardCode)
        .order('card_number')

      if (error) {
        console.error('Error fetching cards:', error)
      } else {
        setCards(data || [])
      }
      setLoading(false)
    }

    fetchCards()
  }, [standardCode])

  if (loading) return <div>Loading...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card) => (
        <div
          key={card.id}
          className="border rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow"
          style={{ borderColor: card.category_color }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="text-3xl">{card.category_icon}</span>
            <span className="text-sm text-gray-500">{card.category_name}</span>
          </div>
          
          <h3 className="text-xl font-bold mb-2">
            {card.title}
            {card.is_important && (
              <span className="ml-2 text-red-500">★</span>
            )}
          </h3>
          
          {card.subtitle && (
            <p className="text-sm text-gray-600 mb-3">{card.subtitle}</p>
          )}
          
          <p className="text-gray-700 line-clamp-3">{card.content}</p>
          
          <button className="mt-4 text-blue-600 hover:text-blue-700">
            자세히 보기 →
          </button>
        </div>
      ))}
    </div>
  )
}
```

#### 사용 예시
```tsx
// app/accounting-standards/page.tsx
import CardNewsList from '@/components/CardNewsList'

export default function AccountingStandardsPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">회계기준 카드뉴스</h1>
      
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4">IFRS (국제회계기준)</h2>
        <CardNewsList standardCode="IFRS" />
      </section>
      
      <section>
        <h2 className="text-2xl font-semibold mb-4">Dutch GAAP (네덜란드 회계기준)</h2>
        <CardNewsList standardCode="DUTCH_GAAP" />
      </section>
    </div>
  )
}
```

---

## 활용 예시

### 1. 학습용 플래시카드 앱
```typescript
// 랜덤 카드 1개 가져오기
const { data: randomCard } = await supabase
  .rpc('get_random_card', { p_standard_code: 'IFRS' })
```

### 2. 회계기준 검색 엔진
```typescript
// 전문 검색 (PostgreSQL Full Text Search)
const { data: searchResults } = await supabase
  .from('card_news')
  .select('*')
  .textSearch('content', '재고자산')
```

### 3. 진행률 추적 시스템
```typescript
// 사용자별 학습 진행률 테이블 추가
CREATE TABLE user_card_progress (
  user_id UUID REFERENCES auth.users(id),
  card_id UUID REFERENCES card_news(id),
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP
);
```

### 4. 퀴즈 생성
```typescript
// key_points를 활용한 퀴즈 문제 생성
const { data: cards } = await supabase
  .from('card_news')
  .select('title, key_points')
  .limit(10)

const quizQuestions = cards.map(card => ({
  question: `${card.title}의 핵심 포인트는?`,
  answer: card.key_points[0],
  distractors: [...otherKeyPoints] // 다른 카드의 key_points
}))
```

---

## 데이터 구조 상세

### accounting_standards
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | Primary Key |
| standard_code | TEXT | 'IFRS', 'DUTCH_GAAP' 등 |
| standard_name | TEXT | 회계기준 정식 명칭 |
| country | TEXT | 적용 국가 |
| description | TEXT | 설명 |

### card_categories
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | Primary Key |
| standard_id | UUID | Foreign Key |
| category_name | TEXT | 카테고리명 (한글) |
| category_name_en | TEXT | 카테고리명 (영문) |
| display_order | INTEGER | 표시 순서 |
| icon | TEXT | 이모지 아이콘 |
| color | TEXT | 색상 코드 (#HEX) |

### card_news
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | Primary Key |
| category_id | UUID | Foreign Key |
| card_number | INTEGER | 카드 번호 |
| title | TEXT | 제목 |
| subtitle | TEXT | 부제목 |
| content | TEXT | 본문 |
| key_points | JSONB | 핵심 포인트 배열 |
| examples | JSONB | 예시 데이터 |
| visual_data | JSONB | 차트/표 데이터 |
| tags | TEXT[] | 검색용 태그 |
| is_important | BOOLEAN | 중요 표시 |

---

## 문제 해결

### Q1: "relation does not exist" 에러
**A**: 스키마가 생성되지 않았습니다. `accounting_standards_schema.sql`을 먼저 실행하세요.

### Q2: "insert violates foreign key constraint" 에러
**A**: 참조 테이블의 데이터를 먼저 삽입해야 합니다.
순서: accounting_standards → card_categories → card_news

### Q3: RLS 정책으로 인한 읽기 실패
**A**: `supabase.auth.signIn()`으로 로그인하거나, RLS 정책을 확인하세요.

### Q4: JSON 데이터가 올바르게 삽입되지 않음
**A**: TypeScript 스크립트 사용 시 JSON.stringify() 대신 객체를 직접 전달하세요.

---

## 다음 단계

### 추가 기능 구현 아이디어
1. **북마크 기능**: 사용자가 중요 카드를 저장
2. **댓글/질문**: 카드별 Q&A 기능
3. **버전 관리**: 회계기준 개정 시 변경 이력 추적
4. **다국어 지원**: content_en 컬럼 추가
5. **PDF 출력**: 카드뉴스를 PDF로 내보내기

### 데이터 확장
- US GAAP 추가
- K-IFRS (한국채택국제회계기준) 추가
- 업종별 회계처리 추가

---

## 참고 자료

- Supabase 공식 문서: https://supabase.com/docs
- IFRS 공식 사이트: https://www.ifrs.org
- Dutch GAAP (RJ): https://www.rjnet.nl
