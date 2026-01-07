# 배포 가이드

## 📋 배포 개요

이 프로젝트를 URL로 공유하기 위해서는 **배포가 필요합니다**. 

### ✅ 데이터 유지 보장
- **Supabase**를 사용하므로 모든 데이터는 클라우드 데이터베이스에 저장됩니다
- 배포 후에도 사용자들이 입력한 모든 데이터가 유지됩니다
- 개발을 계속 진행해도 프로덕션 데이터는 안전합니다

## 🚀 Vercel 배포 (권장)

Next.js 프로젝트에 최적화된 Vercel을 사용하는 것을 권장합니다.

### 1단계: Git 저장소 준비

```bash
# 현재 변경사항 커밋
git add .
git commit -m "배포 준비 완료"

# 원격 저장소에 푸시 (GitHub, GitLab 등)
git push origin main
```

### 2단계: Vercel 계정 생성 및 프로젝트 연결

1. [Vercel](https://vercel.com)에 접속하여 계정 생성 (GitHub 계정으로 로그인 가능)
2. "Add New Project" 클릭
3. GitHub 저장소 선택 또는 URL로 연결
4. 프로젝트 설정:
   - **Framework Preset**: Next.js (자동 감지됨)
   - **Root Directory**: `./` (기본값)
   - **Build Command**: `npm run build` (자동 설정됨)
   - **Output Directory**: `.next` (자동 설정됨)

### 3단계: 환경 변수 설정

Vercel 대시보드에서 **Settings → Environment Variables**에 다음 변수 추가:

```
NEXT_PUBLIC_SUPABASE_URL=https://zaeyagrtriyhxodvcdyh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZXlhZ3J0cml5aHhvZHZjZHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTExMDMsImV4cCI6MjA4MzI4NzEwM30.8_EQyjEijqNMaZKatCId0geS86_Mgxs4muUWfpb13WM
```

> ⚠️ **보안 참고**: 현재 Supabase 키가 코드에 하드코딩되어 있습니다. 배포 후에는 환경 변수로 변경하는 것을 권장합니다.

### 4단계: 배포 실행

1. "Deploy" 버튼 클릭
2. 빌드 로그 확인 (약 2-3분 소요)
3. 배포 완료 후 URL 확인 (예: `https://your-project.vercel.app`)

### 5단계: 배포 확인

- ✅ 프로덕션 URL 접속
- ✅ 대시보드 페이지 로드 확인
- ✅ 데이터 로딩 확인
- ✅ 기능 테스트

## 🔄 지속적 배포 (CI/CD)

Vercel은 자동으로 CI/CD를 설정합니다:

- **자동 배포**: `main` 브랜치에 푸시할 때마다 자동 배포
- **프리뷰 배포**: Pull Request 생성 시 프리뷰 URL 자동 생성
- **롤백**: 이전 배포로 쉽게 롤백 가능

## 📝 배포 후 체크리스트

- [ ] 프로덕션 URL 접속 확인
- [ ] 모든 페이지 로드 확인
- [ ] 데이터 CRUD 기능 테스트
- [ ] 모바일 반응형 확인
- [ ] 성능 확인 (Lighthouse 점수)

## 🔧 문제 해결

### 빌드 실패 시

1. 로컬에서 빌드 테스트: `npm run build`
2. Vercel 빌드 로그 확인
3. 환경 변수 확인
4. TypeScript 오류 확인

### 데이터가 표시되지 않을 때

1. Supabase 연결 확인
2. 환경 변수 확인
3. Supabase RLS (Row Level Security) 정책 확인

## 🌐 커스텀 도메인 설정 (선택사항)

1. Vercel 대시보드 → Settings → Domains
2. 도메인 추가
3. DNS 설정 (Vercel이 자동으로 안내)

## 📊 모니터링

- Vercel 대시보드에서 실시간 트래픽 확인
- Supabase 대시보드에서 데이터베이스 사용량 확인

---

**배포 완료 후 공유 가능한 URL이 생성됩니다!** 🎉
