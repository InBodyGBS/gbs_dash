# ARAP 시스템 설정 가이드

Intercompany AR-AP Balance Reconciliation System을 설정하는 단계별 가이드입니다.

## 필수 설정 순서

### 1단계: 데이터베이스 테이블 생성 ⚠️ 필수

Supabase Dashboard → SQL Editor에서 다음 파일을 실행하세요:

**파일**: `docs/arap-schema.sql`

이 스크립트는 다음 테이블을 생성합니다:
- `arap_submissions` - 제출 정보
- `arap_submission_details` - 제출 상세 내역
- `arap_audit_logs` - 감사 로그

**실행 방법**:
1. Supabase Dashboard 접속
2. 좌측 메뉴에서 "SQL Editor" 클릭
3. "New query" 클릭
4. `docs/arap-schema.sql` 파일의 내용을 복사하여 붙여넣기
5. "Run" 버튼 클릭

**확인**:
```sql
-- 테이블이 생성되었는지 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'arap_%';
```

### 2단계: RLS 정책 설정 ⚠️ 필수

**중요**: 1단계를 완료한 후에만 실행하세요!

Supabase Dashboard → SQL Editor에서 다음 파일을 실행하세요:

**파일**: `docs/arap-rls-policies.sql`

이 스크립트는 Row Level Security 정책을 설정합니다.

**실행 방법**:
1. 1단계가 완료되었는지 확인
2. `docs/arap-rls-policies.sql` 파일의 내용을 복사하여 붙여넣기
3. "Run" 버튼 클릭

### 3단계: 제출 로그 누적을 위한 제약 조건 제거 (선택사항)

여러 번 저장 시 로그가 쌓이도록 하려면 다음 SQL을 실행하세요:

**파일**: `docs/arap-remove-unique-constraint.sql`

**실행 방법**:
1. Supabase Dashboard → SQL Editor
2. `docs/arap-remove-unique-constraint.sql` 파일의 내용을 복사하여 붙여넣기
3. "Run" 버튼 클릭

**주의**: 이 작업을 수행하면 같은 entity_id, fiscal_year, fiscal_month 조합에 여러 제출이 가능합니다. Review 페이지에서 모든 제출 이력을 확인할 수 있습니다.

**확인**:
```sql
-- 제약 조건이 제거되었는지 확인
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'arap_submissions' 
AND constraint_name = 'unique_arap_submission';
-- 결과가 없으면 제거된 것입니다.
```

### 4단계: Storage 버킷 생성 (선택사항)

파일 업로드 기능을 사용하려면 Storage 버킷을 생성해야 합니다.

**방법 1: Supabase Dashboard에서 생성**
1. Supabase Dashboard → Storage
2. "New bucket" 클릭
3. 버킷 이름: `arap-submissions`
4. Public bucket: 선택 안 함 (비공개)
5. "Create bucket" 클릭

**방법 2: SQL로 생성**
```sql
-- Storage 버킷 생성 (Supabase Dashboard에서만 가능, SQL로는 불가)
-- Dashboard에서 수동으로 생성해야 합니다.
```

**Storage RLS 정책 설정**:
버킷 생성 후 다음 SQL을 실행하세요:

**파일**: `docs/arap-storage-policies.sql`

**실행 방법**:
1. Supabase Dashboard → SQL Editor
2. `docs/arap-storage-policies.sql` 파일의 내용을 복사하여 붙여넣기
3. "Run" 버튼 클릭

**확인**:
```sql
-- 정책이 생성되었는지 확인
SELECT * FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%arap-submissions%';
```

## 문제 해결

### 에러: "relation 'arap_submissions' does not exist"
- **원인**: 테이블이 아직 생성되지 않음
- **해결**: 1단계(arap-schema.sql)를 먼저 실행하세요

### 에러: "permission denied for table"
- **원인**: RLS 정책이 설정되지 않음
- **해결**: 2단계(arap-rls-policies.sql)를 실행하세요

### 에러: "bucket not found"
- **원인**: Storage 버킷이 생성되지 않음
- **해결**: 3단계에서 Storage 버킷을 생성하세요 (파일 업로드 기능을 사용하지 않으면 선택사항)

## 확인 체크리스트

설정이 완료되었는지 확인하세요:

- [ ] `arap_submissions` 테이블 생성됨
- [ ] `arap_submission_details` 테이블 생성됨
- [ ] `arap_audit_logs` 테이블 생성됨
- [ ] RLS 정책 설정됨
- [ ] 제출 로그 누적 제약 조건 제거됨 (로그 누적 사용 시)
- [ ] Storage 버킷 생성됨 (파일 업로드 사용 시)
- [ ] Storage RLS 정책 설정됨 (파일 업로드 사용 시)

## 다음 단계

설정이 완료되면:
1. 애플리케이션을 새로고침하세요
2. Inter-co Transaction 페이지로 이동하세요
3. 데이터를 입력하고 테스트하세요
