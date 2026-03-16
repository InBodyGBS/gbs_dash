# Monthly Closing - Storage Setup Guide

> PRD Section 4.6 기반 Supabase Storage 설정 가이드

## 1. Storage 버킷 생성

### 1.1 Supabase Dashboard에서 생성

1. Supabase 대시보드 접속
2. **Storage** 메뉴로 이동
3. **New bucket** 클릭
4. 버킷 이름: `monthly-closing`
5. **Public bucket** 체크 해제 (비공개)
6. File size limit: `10MB`
7. **Create bucket** 클릭

### 1.2 버킷 구조

```
monthly-closing/
├─ uploads/
│  └─ {entity_code}/
│     └─ {year}/
│        └─ {month}/
│           └─ {upload_id}_{original_filename}.xlsx
└─ exports/
   └─ {entity_code}/
      └─ {year}/
         └─ {month}/
            └─ pl_export_{timestamp}.xlsx
```

## 2. Storage 정책 설정

`docs/monthly-closing-policies.sql` 파일의 SQL을 실행하여 업로드/다운로드 정책을 설정합니다.

**실행 방법**:
1. Supabase Dashboard → SQL Editor
2. `docs/monthly-closing-policies.sql` 파일의 내용을 복사하여 붙여넣기
3. "Run" 버튼 클릭

**또는 Supabase 대시보드에서 수동 설정**:
1. **Storage** > **monthly-closing** > **Policies** 이동
2. 다음 정책 추가:
   - **INSERT**: 인증된 사용자 업로드 허용 (uploads 폴더만)
   - **SELECT**: 인증된 사용자 다운로드 허용
   - **UPDATE**: 인증된 사용자 수정 허용
   - **DELETE**: 인증된 사용자 삭제 허용

## 3. User Roles 설정 (선택사항)

고급 권한 관리가 필요한 경우 `docs/user-roles-schema.sql` 파일을 실행합니다.

**역할 종류**:
| Role | 설명 | 권한 |
|------|------|------|
| `entity_user` | 법인 담당자 | 자신의 Entity 파일만 접근 |
| `gbs_user` | GBS 팀원 | 모든 Entity 파일 접근 |
| `gbs_admin` | GBS 관리자 | 모든 파일 + 사용자 관리 |
| `executive` | 경영진 | 모든 파일 조회 |

## 4. 데이터베이스 스키마 설정

`docs/monthly-closing-schema.sql` 파일의 SQL을 실행하여 테이블을 생성합니다.

### 4.1 tb_uploads 테이블

업로드 기록을 저장하는 테이블입니다.

```sql
-- 이미 스키마에 포함되어 있으나, 확인용
SELECT * FROM tb_uploads LIMIT 1;
```

## 5. API Endpoints

### 5.1 파일 업로드

```bash
POST /api/upload
Content-Type: multipart/form-data

# Form Data:
# - file: 업로드할 파일
# - entity_code: 법인 코드 (예: KOR, USA)
# - period_year: 회계연도 (예: 2024)
# - period_month: 회계월 (예: 3)
```

### 5.2 업로드 목록 조회

```bash
GET /api/upload?entity_code=KOR&period_year=2024&period_month=3
```

### 5.3 파일 삭제

```bash
DELETE /api/upload?upload_id=123
```

### 5.4 Signed URL 생성 (다운로드)

```bash
GET /api/download?upload_id=123
# 또는
GET /api/download?file_path=uploads/KOR/2024/3/123_file.xlsx
```

### 5.5 파일 직접 다운로드

```bash
POST /api/download
Content-Type: application/json

{
  "upload_id": 123
}
```

## 6. 파일 형식

업로드하는 Excel/CSV 파일은 다음 컬럼을 포함해야 합니다:
- `Account Code` 또는 `계정코드`: 계정 코드
- `Account Name` 또는 `계정명`: 계정명
- `Debit` 또는 `차변`: 차변 금액
- `Credit` 또는 `대변`: 대변 금액
- `Balance` 또는 `잔액`: 잔액 (선택사항, 없으면 Debit - Credit으로 계산)

**허용 파일 형식**:
- `.xlsx` (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
- `.xls` (application/vnd.ms-excel)
- `.csv` (text/csv)

**파일 크기 제한**: 10MB

## 7. 에러 처리

| Error Code | Error Message | 원인 | 해결방법 |
|-----------|---------------|------|----------|
| 403 | `new row violates row-level security policy` | RLS 정책 미설정 또는 권한 부족 | RLS 정책 확인 및 user_roles 테이블 확인 |
| 400 | `The resource already exists` | 동일 파일명 업로드 시도 | Timestamp 추가하여 파일명 unique화 (자동 처리됨) |
| 413 | `Payload too large` | 파일 크기 제한 초과 | 10MB 이하 파일 업로드 |
| 406 | `Invalid MIME type` | 허용되지 않는 파일 형식 | xlsx, xls, csv 파일만 업로드 |

## 8. 보안 체크리스트

- [ ] RLS enabled on `storage.objects`
- [ ] RLS enabled on all database tables
- [ ] Bucket is set to `public: false`
- [ ] File size validation on frontend and backend
- [ ] MIME type validation
- [ ] Authenticated users only can upload
- [ ] Users can only access files they own or have permission for
- [ ] GBS Team has elevated permissions (선택사항)
- [ ] Audit log for all file operations (선택사항)

## 9. 테스트

1. Monthly Closing > Upload 페이지로 이동
2. Entity, 연도, 월 선택
3. TB 파일 업로드
4. Mapping 페이지에서 COA 매핑 확인
5. Result 페이지에서 P&L 확인

### 9.1 API 테스트 (curl)

```bash
# 업로드 테스트
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test.xlsx" \
  -F "entity_code=KOR" \
  -F "period_year=2024" \
  -F "period_month=3"

# 목록 조회
curl http://localhost:3000/api/upload?entity_code=KOR

# Signed URL 생성
curl http://localhost:3000/api/download?upload_id=1
```