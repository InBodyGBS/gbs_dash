## 1. Storage 버킷 생성

1. Supabase 대시보드 접속
2. **Storage** 메뉴로 이동
3. **New bucket** 클릭
4. 버킷 이름: `monthly-closing`
5. **Public bucket** 체크 해제 (비공개)
6. **Create bucket** 클릭

## 2. Storage 정책 설정

`docs/monthly-closing-storage-policies.sql` 파일의 SQL을 실행하여 업로드/다운로드 정책을 설정합니다.

**실행 방법**:
1. Supabase Dashboard → SQL Editor
2. `docs/monthly-closing-storage-policies.sql` 파일의 내용을 복사하여 붙여넣기
3. "Run" 버튼 클릭

**또는 Supabase 대시보드에서 수동 설정**:
1. **Storage** > **monthly-closing** > **Policies** 이동
2. 다음 정책 추가:
   - **INSERT**: 인증된 사용자 업로드 허용
   - **SELECT**: 인증된 사용자 다운로드 허용
   - **DELETE**: 인증된 사용자 삭제 허용

## 3. 데이터베이스 스키마 설정

`docs/monthly-closing-schema.sql` 파일의 SQL을 실행하여 테이블을 생성합니다.

## 4. 파일 형식

업로드하는 Excel/CSV 파일은 다음 컬럼을 포함해야 합니다:
- `Account Code` 또는 `계정코드`: 계정 코드
- `Account Name` 또는 `계정명`: 계정명
- `Debit` 또는 `차변`: 차변 금액
- `Credit` 또는 `대변`: 대변 금액
- `Balance` 또는 `잔액`: 잔액 (선택사항, 없으면 Debit - Credit으로 계산)

## 5. 테스트

1. Monthly Closing > Upload 페이지로 이동
2. Entity, 연도, 월 선택
3. TB 파일 업로드
4. Mapping 페이지에서 COA 매핑 확인
5. Result 페이지에서 P&L 확인