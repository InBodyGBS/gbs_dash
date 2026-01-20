# ARAP Storage Setup

Intercompany AR-AP Balance Reconciliation System에서 파일 업로드를 위한 Supabase Storage 버킷 설정 가이드입니다.

## Storage 버킷 생성

Supabase Dashboard에서 다음 버킷을 생성하세요:

**버킷 이름**: `arap-submissions`

## RLS 정책 설정

다음 SQL을 Supabase SQL Editor에서 실행하여 RLS 정책을 설정하세요:

```sql
-- Storage 버킷에 대한 RLS 정책
-- 모든 인증된 사용자는 파일 업로드 가능
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'arap-submissions');

-- 모든 인증된 사용자는 파일 조회 가능
CREATE POLICY "Authenticated users can view files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'arap-submissions');

-- 파일 소유자만 삭제 가능
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'arap-submissions');
```

## 파일 경로 구조

업로드된 파일은 다음 경로 구조로 저장됩니다:

```
{entity_id}/{fiscal_year}/{fiscal_month}/{timestamp}_{filename}
```

예시:
```
abc123-uuid/2024/1/1704067200000_submission.xlsx
```

## 참고

- 최대 파일 크기: 10MB
- 지원 형식: .xlsx, .xls
- 최대 행 수: 1,000개
