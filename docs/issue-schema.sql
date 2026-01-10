-- ============================================
-- Issue 관리 테이블 생성 스크립트
-- ============================================

-- 이슈 테이블
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL CHECK (char_length(title) <= 200),
  category TEXT NOT NULL,
  entity_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  response TEXT,
  status TEXT NOT NULL DEFAULT '확인 중',
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT valid_category CHECK (
    category IN (
      'Tax', 'Lease', 'Closing', 'System', 'Audit', 
      'Depreciation', 'Labor SG&A', 'Accrual', 'PKG', 
      'Inventory', 'Bad debt', 'Allowance', 'FS', 'Others'
    )
  ),
  CONSTRAINT valid_status CHECK (status IN ('확인 중', '완료'))
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_entity ON issues(entity_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);

-- 트리거: updated_at 자동 업데이트 및 completed_at 자동 설정
CREATE OR REPLACE FUNCTION update_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = '완료' AND OLD.status != '완료' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS issues_updated_at ON issues;
CREATE TRIGGER issues_updated_at
BEFORE UPDATE ON issues
FOR EACH ROW
EXECUTE FUNCTION update_issues_updated_at();

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================

-- RLS 활성화
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view issues"
ON issues FOR SELECT
USING (true);

-- 인증된 사용자는 생성 가능
CREATE POLICY "Anyone can create issues"
ON issues FOR INSERT
WITH CHECK (true);

-- 모든 사용자가 수정 가능 (실제 환경에서는 권한 제한 권장)
CREATE POLICY "Anyone can update issues"
ON issues FOR UPDATE
USING (true);

-- 모든 사용자가 삭제 가능 (실제 환경에서는 권한 제한 권장)
CREATE POLICY "Anyone can delete issues"
ON issues FOR DELETE
USING (true);

-- ============================================
-- 샘플 데이터
-- ============================================

-- 먼저 존재하는 법인 확인 (참고용 쿼리, 실행하지 않음)
-- SELECT code, name FROM subsidiaries ORDER BY code;

-- 주의: 샘플 데이터는 subsidiaries 테이블에 실제 존재하는 법인만 사용
-- 아래 INSERT 전에 먼저 존재하는 법인 코드를 확인하세요

INSERT INTO issues (title, category, entity_id, description, status, created_by, response) 
SELECT * FROM (
  VALUES
  (
    'USA 법인 이전가격 문서 보완 필요',
    'Tax',
    (SELECT id FROM subsidiaries WHERE code = 'USA' LIMIT 1),
    '2024년 이전가격 보고서 검토 중 다음 사항 발견:

1. CUP Method 적용 근거 보완 필요
2. 비교대상 기업 선정 기준 명확화
3. 기능/위험 분석 추가 필요

외부 세무법인의 검토 의견 반영이 필요함.',
    '확인 중',
    '조승현',
    'Konsolide 세무법인에 문의 완료. 다음 주까지 보완 자료 제출 예정.

필요 서류:
- 비교가능 기업 리스트
- 기능/위험 분석 보고서
- 가격 산정 근거 자료'
  ),
  (
    'JPN 재고 평가 기준 변경',
    'Inventory',
    (SELECT id FROM subsidiaries WHERE code = 'JPN' LIMIT 1),
    '저가법 평가 기준 변경으로 인한 평가손실 반영 필요.

기존: 총평균법
변경: 개별법 적용

영향 금액: 약 15M JPY',
    '완료',
    '조승현',
    '2024-01-15 회계처리 완료. 재고자산평가손실 15.2M JPY 반영.'
  ),
  (
    'CHN 리스 회계 처리 오류',
    'Lease',
    (SELECT id FROM subsidiaries WHERE code = 'CHN' LIMIT 1),
    'IFRS 16 기준 리스부채 계산 오류 발견.

문제: 증분차입이자율 적용 오류
영향: 리스부채 과대계상 약 50K USD',
    '확인 중',
    '김철수',
    NULL
  ),
  (
    'USA 시스템 권한 오류',
    'System',
    (SELECT id FROM subsidiaries WHERE code = 'USA' LIMIT 1),
    'ERP 시스템에서 일부 사용자의 승인 권한이 누락됨.

영향: AP 결재 프로세스 지연
대상: Finance Manager 3명',
    '완료',
    '김철수',
    '2024-01-10 권한 복구 완료. IT팀 협조 완료.'
  )
) AS data(title, category, entity_id, description, status, created_by, response)
WHERE entity_id IS NOT NULL;  -- entity_id가 NULL인 경우 삽입 제외


