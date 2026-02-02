# Financial Result Storage 설정 가이드

Financial Result 기능을 사용하기 위해 Supabase Storage 버킷을 설정해야 합니다.

## 1. Storage 버킷 생성

1. Supabase 대시보드 접속
2. **Storage** 메뉴로 이동
3. **New bucket** 클릭
4. 버킷 이름: `financial-result`
5. **Public bucket** 체크 해제 (비공개)
6. **Create bucket** 클릭

## 2. Storage 정책 설정

`docs/financial-result-storage-policies.sql` 파일의 SQL을 실행하여 업로드/다운로드 정책을 설정합니다.

또는 Supabase 대시보드에서:

1. **Storage** > **financial-result** > **Policies** 이동
2. 다음 정책 추가:

### 업로드 정책
- **Policy name**: `Allow public uploads`
- **Allowed operation**: `INSERT`
- **Policy definition**: 
  ```sql
  true
  ```

### 다운로드 정책
- **Policy name**: `Allow public downloads`
- **Allowed operation**: `SELECT`
- **Policy definition**: 
  ```sql
  true
  ```

## 3. 데이터베이스 스키마 설정

`docs/financial-result-schema.sql` 파일의 SQL을 실행하여 테이블을 생성합니다.

## 4. 파일 형식

업로드하는 Excel 파일은 다음 컬럼을 포함해야 합니다:

- `Entity`: Entity 이름 (예: HQ, USA, Japan)
- `Period`: Period 문자열 (예: "20254Q")
- `Rev_Account`: 계정명 (예: 매출, 매출원가, 판관비)
- `Amount(KRW)`: 금액 (원화)

PL 시트가 있어야 하며, 위 컬럼들이 포함되어 있어야 합니다.

## 5. 테스트

1. Financial Result 페이지로 이동
2. "파일 업로드" 탭에서 Excel 파일 업로드
3. "분기별 증감표" 탭에서 데이터 확인
