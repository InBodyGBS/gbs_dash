-- ============================================================
-- Migration: 독촉 이메일 로그 테이블 + 법인 연락처 이메일 컬럼
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. subsidiaries 테이블에 contact_email 컬럼 추가
ALTER TABLE subsidiaries
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

COMMENT ON COLUMN subsidiaries.contact_email IS
  '독촉 이메일 수신 주소 (법인 담당자)';

-- 2. reminder_logs 테이블 생성
CREATE TABLE IF NOT EXISTS reminder_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_item_id UUID NOT NULL REFERENCES schedule_items(id) ON DELETE CASCADE,
  subsidiary_id    UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  quarter_id       UUID NOT NULL REFERENCES quarters(id) ON DELETE CASCADE,
  category         TEXT NOT NULL,
  recipient_email  TEXT NOT NULL,
  sent_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  email_id         TEXT,           -- Resend 반환 메시지 ID
  status           TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message    TEXT,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reminder_logs_schedule_item
  ON reminder_logs(schedule_item_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_subsidiary
  ON reminder_logs(subsidiary_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_sent_at
  ON reminder_logs(sent_at DESC);
-- 당일 중복 발송 방지 조회용
CREATE INDEX IF NOT EXISTS idx_reminder_logs_item_date
  ON reminder_logs(schedule_item_id, sent_at DESC);

COMMENT ON TABLE reminder_logs IS '기한 초과 항목에 대한 독촉 이메일 발송 이력';

-- RLS 활성화
ALTER TABLE reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON reminder_logs;
CREATE POLICY "Allow all for authenticated"
  ON reminder_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 완료 후: 각 법인의 contact_email을 직접 입력하세요
-- 예: UPDATE subsidiaries SET contact_email = 'contact@subsidiary.com' WHERE code = 'BWA';
-- ============================================================
