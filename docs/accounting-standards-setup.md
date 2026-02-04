# 회계기준 카드뉴스 Supabase 배포 가이드

## 📋 개요

이 가이드는 IFRS와 Dutch GAAP 회계기준 카드뉴스 데이터를 Supabase에 배포하는 방법을 설명합니다.

## 🚀 배포 순서

### 1단계: Supabase 스키마 생성

#### 기존 테이블이 있는 경우

**오류: "relation already exists"** 가 발생하면:

1. **옵션 A: 기존 테이블 삭제 후 재생성 (권장)**
   - `docs/accounting_standards_drop.sql` 파일을 먼저 실행하여 기존 테이블 삭제
   - 그 다음 `docs/accounting_standards_schema.sql` 실행

2. **옵션 B: 기존 테이블 유지**
   - 스키마 파일이 `CREATE TABLE IF NOT EXISTS`를 사용하므로 기존 테이블은 유지됩니다
   - 하지만 정책(POLICY)은 재생성됩니다

#### 스키마 생성

**방법 1: 간단한 스크립트 사용 (권장 - 기존 데이터 보존)**

1. Supabase Dashboard → **SQL Editor** 접속
2. `docs/accounting_standards_schema_simple.sql` 파일을 열어서 **전체 내용을 복사**
3. SQL Editor에 붙여넣고 **RUN** 버튼 클릭
4. 기존 테이블이 있으면 유지되고, 없으면 새로 생성됩니다
5. 5개 테이블과 뷰가 정상 생성되었는지 확인:
   - `accounting_standards`
   - `card_categories`
   - `card_news`
   - `card_references`
   - `practical_tips`
   - `card_news_full` (뷰)

**방법 2: 완전한 스크립트 사용 (기존 데이터 삭제)**

1. Supabase Dashboard → **SQL Editor** 접속
2. `docs/accounting_standards_schema_complete.sql` 파일을 열어서 **전체 내용을 복사**
3. SQL Editor에 붙여넣고 **RUN** 버튼 클릭
4. ⚠️ **주의**: 기존 테이블과 데이터가 모두 삭제되고 새로 생성됩니다

**방법 3: 단계별 실행**

1. Supabase Dashboard → **SQL Editor** 접속
2. **기존 테이블이 있다면**: `docs/accounting_standards_drop.sql` 먼저 실행
3. `docs/accounting_standards_schema.sql` 파일을 열어서 **전체 내용을 복사**
4. SQL Editor에 붙여넣고 **RUN** 버튼 클릭

> ⚠️ **중요**: SQL Editor에는 `.sql` 파일만 실행할 수 있습니다. TypeScript 파일(`.ts`)은 실행할 수 없습니다.

### 2단계: 데이터 삽입

다음 중 하나의 방법을 선택하세요:

#### 옵션 A: TypeScript 스크립트 사용 (권장)

**장점**: 전체 JSON 데이터를 자동으로 삽입

1. 프로젝트 루트에서 환경 변수 설정 확인:
   ```bash
   # .env.local 파일에 다음이 있어야 합니다:
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. 필요한 패키지 설치 (이미 설치되어 있을 수 있음):
   ```bash
   npm install @supabase/supabase-js
   npm install --save-dev ts-node @types/node
   ```

3. 스크립트 실행:
   ```bash
   npx ts-node insert_card_news_script.ts
   ```

4. 기존 데이터를 삭제하고 재삽입하려면:
   ```bash
   npx ts-node insert_card_news_script.ts --clear
   ```

#### 옵션 B: SQL 파일 사용

**장점**: Supabase Dashboard에서 직접 실행 가능

1. Supabase Dashboard → **SQL Editor** 접속
2. `docs/insert_card_news_data.sql` 파일을 열어서 **전체 내용을 복사**
3. SQL Editor에 붙여넣고 **RUN** 버튼 클릭

> ⚠️ **참고**: SQL 파일에는 샘플 데이터만 포함되어 있을 수 있습니다. 전체 데이터는 옵션 A를 권장합니다.

### 3단계: 데이터 확인

Supabase Dashboard → **Table Editor**에서 확인:

- `accounting_standards`: 2개 행 (IFRS, DUTCH_GAAP)
- `card_categories`: 12개 행 (각 기준당 6개)
- `card_news`: 40개 행 (각 기준당 20개)
- `practical_tips`: 실무 팁 데이터 (있는 경우)

또는 SQL Editor에서 확인:

```sql
-- 회계기준 확인
SELECT * FROM accounting_standards;

-- 카테고리 확인
SELECT * FROM card_categories;

-- 카드뉴스 확인
SELECT * FROM card_news_full LIMIT 10;

-- 통계 확인
SELECT 
  ast.standard_code,
  COUNT(DISTINCT cc.id) as category_count,
  COUNT(cn.id) as card_count
FROM accounting_standards ast
LEFT JOIN card_categories cc ON cc.standard_id = ast.id
LEFT JOIN card_news cn ON cn.category_id = cc.id
GROUP BY ast.id, ast.standard_code;
```

## 🔧 문제 해결

### 오류: "syntax error at or near '{'"

**원인**: TypeScript 파일(`.ts`)을 SQL Editor에 붙여넣었을 때 발생

**해결**: 
- SQL Editor에는 `.sql` 파일만 사용하세요
- TypeScript 스크립트는 터미널에서 `npx ts-node` 명령으로 실행하세요

### 오류: "relation does not exist"

**원인**: 스키마가 아직 생성되지 않았습니다

**해결**: 
1. `docs/accounting_standards_schema.sql` 파일을 먼저 실행하세요
2. 모든 테이블이 생성되었는지 확인하세요

### 오류: "permission denied"

**원인**: RLS (Row Level Security) 정책 문제

**해결**: 
- 스키마 파일의 RLS 정책이 올바르게 생성되었는지 확인
- Service Role Key를 사용하여 데이터 삽입 시 권한 문제가 없어야 합니다

### 데이터가 표시되지 않음

**확인사항**:
1. Supabase 연결 확인 (환경 변수)
2. 테이블에 데이터가 있는지 확인
3. 브라우저 콘솔에서 에러 확인
4. Network 탭에서 API 요청 확인

## 📝 다음 단계

스키마와 데이터가 준비되면:

1. **Audit & Tax 페이지 접속**: `/audit-and-tax`
2. **회계기준 선택**: IFRS 또는 Dutch GAAP 탭 클릭
3. **카테고리 필터링**: 드롭다운에서 카테고리 선택
4. **검색**: 제목, 본문, 태그로 검색
5. **카드 클릭**: 상세 정보 확인

## 📚 관련 파일

- `docs/accounting_standards_schema.sql` - 데이터베이스 스키마
- `docs/insert_card_news_data.sql` - SQL 데이터 삽입 스크립트
- `insert_card_news_script.ts` - TypeScript 데이터 삽입 스크립트
- `ifrs_card_news_data.json` - IFRS 카드뉴스 데이터
- `dutch_gaap_card_news_data.json` - Dutch GAAP 카드뉴스 데이터

---

**배포 완료 후 Audit & Tax 페이지에서 카드뉴스를 확인할 수 있습니다!** 🎉
