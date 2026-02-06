-- ============================================
-- Task Histories 테이블 생성 스크립트
-- ============================================

-- task_histories (Task 히스토리)
CREATE TABLE IF NOT EXISTS task_histories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  request_date DATE,
  response_date DATE,
  description TEXT,
  completion_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_histories_task ON task_histories(task_id);
CREATE INDEX IF NOT EXISTS idx_task_histories_request_date ON task_histories(request_date);
CREATE INDEX IF NOT EXISTS idx_task_histories_response_date ON task_histories(response_date);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_task_histories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_histories_updated_at ON task_histories;
CREATE TRIGGER task_histories_updated_at
BEFORE UPDATE ON task_histories
FOR EACH ROW
EXECUTE FUNCTION update_task_histories_updated_at();

-- RLS (Row Level Security) 정책
ALTER TABLE task_histories ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 조회/생성/수정/삭제 가능
CREATE POLICY "Anyone can view task_histories" ON task_histories FOR SELECT USING (true);
CREATE POLICY "Anyone can create task_histories" ON task_histories FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update task_histories" ON task_histories FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete task_histories" ON task_histories FOR DELETE USING (true);
