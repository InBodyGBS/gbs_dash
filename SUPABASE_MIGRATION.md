# Supabase 계정 변경 가이드

## 필요한 정보

새로운 Supabase 계정으로 변경하려면 다음 정보가 필요합니다:

### 필수 정보

1. **Supabase Project URL**
   - 형식: `https://[프로젝트ID].supabase.co`
   - 예시: `https://abcdefghijklmnop.supabase.co`

2. **Supabase Anon Key (Public Key)**
   - 형식: JWT 토큰 (eyJ로 시작하는 긴 문자열)
   - 예시: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 정보 확인 방법

1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 새 프로젝트 선택
3. 좌측 메뉴: **Settings** → **API**
4. 다음 정보 복사:
   - **Project URL** (Project Settings 섹션)
   - **Project API keys** → `anon` `public` 키

## 변경할 파일

다음 파일들의 Supabase 설정을 업데이트해야 합니다:

1. `lib/supabase/client.ts` - 클라이언트 사이드 Supabase 클라이언트
2. `lib/supabase/server.ts` - 서버 사이드 Supabase 클라이언트
3. `.env.local` (선택사항) - 환경 변수로 관리하는 경우

## 데이터베이스 마이그레이션

새 Supabase 프로젝트로 변경할 때:

1. **기존 데이터베이스 스키마 복사**
   - `docs/complete-setup.sql` 또는 `docs/quarterly-closing-schema.sql` 실행
   - 또는 기존 프로젝트의 SQL을 새 프로젝트에 복사

2. **데이터 마이그레이션** (필요한 경우)
   - 기존 데이터를 Export → 새 프로젝트에 Import
   - 또는 Supabase Dashboard의 Table Editor에서 수동 복사

## 보안 권장사항

환경 변수 사용을 권장합니다:

1. `.env.local` 파일 생성:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=새로운_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=새로운_키
   ```

2. 코드에서 환경 변수 사용:
   ```typescript
   const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
   const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
   ```

3. `.gitignore`에 `.env.local` 포함 확인 (이미 포함됨)

---

**새로운 Supabase 정보를 알려주시면 코드를 업데이트하겠습니다!** 🔄
