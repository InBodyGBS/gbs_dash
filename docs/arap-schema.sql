-- Intercompany AR-AP Balance Reconciliation System
-- 데이터베이스 스키마

-- 1. arap_submissions 테이블
CREATE TABLE IF NOT EXISTS arap_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL CHECK (fiscal_year >= 2020),
  fiscal_month INTEGER NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
  submission_type TEXT NOT NULL CHECK (submission_type IN ('file', 'manual')),
  submission_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  file_path TEXT,
  total_items INTEGER DEFAULT 0,
  match_status TEXT DEFAULT 'pending' CHECK (match_status IN ('pending', 'matched', 'mismatched', 'no_data')),
  submitted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 복합 인덱스
  CONSTRAINT unique_arap_submission UNIQUE (entity_id, fiscal_year, fiscal_month)
);

-- 2. arap_submission_details 테이블
CREATE TABLE IF NOT EXISTS arap_submission_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES arap_submissions(id) ON DELETE CASCADE,
  invoice_date DATE,
  counterparty_entity_id UUID NOT NULL REFERENCES subsidiaries(id),
  account_type TEXT NOT NULL CHECK (account_type IN ('AR', 'AP', 'Others')),
  invoice_no TEXT,
  currency TEXT NOT NULL CHECK (LENGTH(currency) = 3),
  amount DECIMAL(18, 2) NOT NULL CHECK (amount > 0),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. arap_audit_logs 테이블
CREATE TABLE IF NOT EXISTS arap_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES subsidiaries(id),
  action_type TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  old_value JSONB,
  new_value JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_arap_submissions_entity_date 
  ON arap_submissions(entity_id, fiscal_year, fiscal_month);
CREATE INDEX IF NOT EXISTS idx_arap_submission_details_submission 
  ON arap_submission_details(submission_id);
CREATE INDEX IF NOT EXISTS idx_arap_submission_details_counterparty 
  ON arap_submission_details(counterparty_entity_id);
CREATE INDEX IF NOT EXISTS idx_arap_audit_logs_entity 
  ON arap_audit_logs(entity_id, changed_at DESC);

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_arap_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_arap_submissions_updated_at
  BEFORE UPDATE ON arap_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_arap_updated_at();

-- 코멘트 추가
COMMENT ON TABLE arap_submissions IS 'Intercompany AR-AP 제출 정보';
COMMENT ON TABLE arap_submission_details IS 'Intercompany AR-AP 제출 상세 내역';
COMMENT ON TABLE arap_audit_logs IS 'Intercompany AR-AP 감사 로그';

COMMENT ON COLUMN arap_submissions.entity_id IS '법인 ID (subsidiaries 테이블 참조)';
COMMENT ON COLUMN arap_submissions.fiscal_year IS '귀속연도';
COMMENT ON COLUMN arap_submissions.fiscal_month IS '귀속월 (1-12)';
COMMENT ON COLUMN arap_submissions.submission_type IS '제출 방식 (file: 파일 업로드, manual: 직접 입력)';
COMMENT ON COLUMN arap_submissions.match_status IS '매칭 상태 (pending: 확인중, matched: 매칭완료, mismatched: 불일치, no_data: 미제출)';
COMMENT ON COLUMN arap_submission_details.counterparty_entity_id IS '상대방 Entity ID';
COMMENT ON COLUMN arap_submission_details.account_type IS '계정 유형 (AR: 채권, AP: 채무, Others: 기타)';
COMMENT ON COLUMN arap_submission_details.currency IS '통화 코드 (3자리, 예: USD, EUR, KRW)';
COMMENT ON COLUMN arap_submission_details.amount IS '금액';
