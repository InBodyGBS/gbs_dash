# Submission Storage 설정 가이드

## Storage 버킷 생성 및 정책 설정

### 1. 버킷 생성
1. Supabase Dashboard → Storage
2. "New bucket" 클릭
3. 버킷 이름: `submission`
4. Public 또는 Private 설정 (필요에 따라)
5. 생성

### 2. Storage 정책 설정

**중요**: `submission` 버킷에 대한 정책이 없으면 업로드가 실패합니다.

#### 방법 1: SQL Editor에서 실행 (권장)
`docs/submission-storage-policies.sql` 파일의 SQL을 Supabase SQL Editor에서 실행하세요.

#### 방법 2: Dashboard에서 수동 설정

Supabase Storage는 RLS(Row Level Security) 정책을 사용합니다. 다음 정책을 설정해야 합니다:

#### 업로드 정책 (INSERT)
```
Policy Name: Allow public uploads
Operation: INSERT
Target roles: public
Policy definition: true
```

또는 인증된 사용자만 업로드하도록 하려면:
```
Policy Name: Allow authenticated uploads
Operation: INSERT
Target roles: authenticated
Policy definition: true
```

#### 다운로드 정책 (SELECT)
```
Policy Name: Allow public downloads
Operation: SELECT
Target roles: public
Policy definition: true
```

#### 삭제 정책 (DELETE)
```
Policy Name: Allow authenticated deletes
Operation: DELETE
Target roles: authenticated
Policy definition: true
```

### 3. 정책 설정 방법
1. Supabase Dashboard → Storage
2. `submission` 버킷 선택
3. "Policies" 탭 클릭
4. "New Policy" 클릭
5. 위의 정책들을 각각 추가

### 4. 빠른 설정 (모든 사용자 허용)
개발 환경에서는 다음 정책으로 모든 작업을 허용할 수 있습니다:

```
Policy Name: Allow all operations
Operations: SELECT, INSERT, UPDATE, DELETE
Target roles: public
Policy definition: true
```

**주의**: 프로덕션 환경에서는 보안을 위해 더 엄격한 정책을 사용하세요.
