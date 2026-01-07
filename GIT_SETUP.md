# Git 저장소 설정 가이드

## 현재 상태
- ✅ 로컬 Git 저장소 있음
- ❌ 원격 저장소(GitHub) 연결 안 됨

## Git 푸시 방법

### 방법 1: GitHub에서 새 저장소 생성 후 연결 (권장)

#### 1단계: GitHub에서 저장소 생성
1. [GitHub](https://github.com)에 로그인
2. 우측 상단 "+" 버튼 → "New repository" 클릭
3. 저장소 설정:
   - **Repository name**: `gbs_dash` (또는 원하는 이름)
   - **Description**: "InBody GBS Dashboard"
   - **Visibility**: Private (또는 Public)
   - **Initialize this repository with**: 체크하지 않음 (이미 로컬에 코드가 있음)
4. "Create repository" 클릭

#### 2단계: 로컬에서 원격 저장소 연결
GitHub에서 생성된 저장소의 URL을 복사한 후:

```bash
# 원격 저장소 추가 (GitHub에서 제공하는 URL 사용)
git remote add origin https://github.com/사용자명/gbs_dash.git

# 또는 SSH 사용 시
git remote add origin git@github.com:사용자명/gbs_dash.git
```

#### 3단계: 변경사항 커밋 및 푸시
```bash
# 모든 변경사항 추가
git add .

# 커밋
git commit -m "Initial commit: GBS Dashboard with Quarterly Closing features"

# 원격 저장소에 푸시
git push -u origin main
```

### 방법 2: PowerShell에서 직접 실행

현재 디렉토리에서 다음 명령어를 순서대로 실행:

```powershell
# 1. 변경사항 추가
git add .

# 2. 커밋
git commit -m "배포 준비: Quarterly Closing Schedule 기능 완성"

# 3. 원격 저장소 연결 (GitHub URL로 변경 필요)
git remote add origin https://github.com/사용자명/gbs_dash.git

# 4. 푸시
git push -u origin main
```

## 주의사항

### .gitignore 확인
다음 파일들은 Git에 포함되지 않아야 합니다:
- `.env.local` (환경 변수 - 보안상 중요!)
- `node_modules/`
- `.next/`
- `.cursor/` (선택사항)

### 커밋 전 확인사항
```bash
# 커밋할 파일 확인
git status

# 변경사항 미리보기
git diff
```

## 다음 단계

Git 푸시 완료 후:
1. Vercel에서 GitHub 저장소 연결
2. 자동 배포 시작
3. URL 공유 가능!

---

**도움이 필요하면 알려주세요!** 🚀
