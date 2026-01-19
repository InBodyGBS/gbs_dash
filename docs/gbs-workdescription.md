# Cursor 프롬프트: 업무기술서 페이지 구현

## 요구사항
업무기술서 페이지에 워드 문서(.docx) 업로드 및 표시 기능을 구현해주세요.

## 기능 명세

### 1. 파일 업로드 기능
- 드래그 앤 드롭 또는 파일 선택으로 .docx 파일 업로드
- Supabase Storage에 파일 저장 (버킷: work-manuals)
- 업로드된 파일 목록 표시 (파일명, 업로드 날짜, 파일 크기)
- 파일 삭제 기능

### 2. 문서 파싱 및 표시
- mammoth.js 라이브러리를 사용하여 .docx 파일을 HTML로 변환
- 변환된 내용을 깔끔한 레이아웃으로 표시
- 다음 구조로 표시:
  * 제목: "< 글로벌사업지원(GBS)팀 업무 기술서 >"
  * Team Mission 섹션 (배경색: 연한 파랑)
  * Key Responsibilities 섹션
    - 4개의 주요 책임 영역을 카드 형태로 표시
    - 각 카드: 제목(bold) + 세부 내용(bullet points)

### 3. UI/UX 디자인

#### 레이아웃
```
┌─────────────────────────────────────────────────┐
│  [업로드 영역]                                    │
│  📁 파일을 드래그하거나 클릭하여 업로드           │
├─────────────────────────────────────────────────┤
│  업로드된 파일 목록                               │
│  ┌───────────────────────────────────────┐      │
│  │ 📄 업무기술서.docx                     │      │
│  │ 2026-01-16  |  45KB  | [보기] [삭제]  │      │
│  └───────────────────────────────────────┘      │
├─────────────────────────────────────────────────┤
│  문서 내용 (선택한 파일)                         │
│  ┌─────────────────────────────────────┐        │
│  │ < 글로벌사업지원(GBS)팀 업무 기술서 >  │        │
│  │                                       │        │
│  │ [Team Mission]                        │        │
│  │ 글로벌사업지원(GBS)팀은...            │        │
│  │                                       │        │
│  │ [Key Responsibilities]                │        │
│  │ ┌──────────────┐ ┌──────────────┐   │        │
│  │ │ 1. 글로벌... │ │ 2. 그룹 회계 │   │        │
│  │ └──────────────┘ └──────────────┘   │        │
│  │ ┌──────────────┐ ┌──────────────┐   │        │
│  │ │ 3. Global... │ │ 4. 결산관리  │   │        │
│  │ └──────────────┘ └──────────────┘   │        │
│  └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

#### 스타일 가이드
- 전체 배경: white
- 업로드 영역: 테두리 dashed, hover 시 배경색 변경
- Team Mission 섹션: 배경 #EFF6FF (연한 파랑), 패딩 24px, 둥근 모서리
- Key Responsibilities 카드:
  * 배경: white
  * 테두리: 1px solid #E5E7EB
  * 그림자: shadow-sm
  * 패딩: 20px
  * Grid 레이아웃: 2열 (모바일에서 1열)
  * 호버 시: shadow-md
- 타이포그래피:
  * 제목: text-2xl font-bold text-gray-900
  * 섹션 헤더: text-xl font-semibold text-blue-700
  * 본문: text-base text-gray-700

### 4. 기술 스택
- React/Next.js
- Supabase Storage (파일 저장)
- mammoth.js (docx 파싱)
- Tailwind CSS (스타일링)
- react-dropzone (드래그 앤 드롭)

### 5. 데이터 모델 (Supabase)

#### work_manuals 테이블
```sql
CREATE TABLE work_manuals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  content JSONB -- 파싱된 내용을 JSON으로 저장 (선택사항)
);
```

### 6. 주요 컴포넌트 구조

```typescript
// components/WorkManual/WorkManualUpload.tsx
// 파일 업로드 컴포넌트

// components/WorkManual/WorkManualList.tsx
// 업로드된 파일 목록 컴포넌트

// components/WorkManual/WorkManualViewer.tsx
// 문서 내용 표시 컴포넌트
// - parseDocxToHTML() 함수로 mammoth 사용
// - TeamMission, KeyResponsibilities 섹션 렌더링

// pages/work-manual/index.tsx
// 메인 페이지: 위 컴포넌트들을 조합
```

### 7. 예시 코드

#### mammoth.js 사용 예시
```typescript
import mammoth from 'mammoth';

async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value;
}
```

#### Supabase 업로드 예시
```typescript
import { supabase } from '@/lib/supabase';

async function uploadFile(file: File) {
  const filePath = `${Date.now()}_${file.name}`;
  
  // 1. Storage 업로드
  const { error: uploadError } = await supabase.storage
    .from('work-manuals')
    .upload(filePath, file);
  
  if (uploadError) throw uploadError;
  
  // 2. DB 레코드 생성
  const { error: dbError } = await supabase
    .from('work_manuals')
    .insert({
      file_name: file.name,
      file_path: filePath,
      file_size: file.size
    });
  
  if (dbError) throw dbError;
}
```

### 8. 우선순위
1. 파일 업로드 및 Storage 저장 (High)
2. 업로드된 파일 목록 표시 (High)
3. mammoth.js로 docx 파싱 및 HTML 표시 (High)
4. 구조화된 레이아웃 (Mission, Responsibilities 카드) (Medium)
5. 파일 삭제 기능 (Low)

### 9. 추가 개선 사항 (선택)
- PDF로 변환하여 다운로드 기능
- 검색 기능 (문서 내용 검색)
- 버전 관리 (같은 파일의 여러 버전)
- 권한 관리 (특정 사용자만 업로드/삭제 가능)

---

## 실행 지침
1. 먼저 mammoth와 react-dropzone 패키지 설치: `npm install mammoth react-dropzone`
2. Supabase에서 work-manuals 버킷 생성
3. work_manuals 테이블 생성
4. 위 컴포넌트 구조대로 구현
5. 기존 "곧 추가될 예정입니다" 메시지를 실제 구현으로 교체

현재 페이지 경로: `/gbs/work-manual`
