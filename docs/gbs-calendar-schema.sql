-- ============================================
-- GBS Calendar 이벤트 테이블 스키마
-- ============================================

CREATE TABLE IF NOT EXISTS gbs_calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL, -- 시작일 (YYYY-MM-DD)
  end_date DATE, -- 종료일 (기간 일정인 경우, YYYY-MM-DD)
  time TEXT, -- 시간 (HH:mm 형식, 선택적)
  title TEXT NOT NULL, -- 일정 제목
  assignee TEXT, -- 담당자
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_gbs_calendar_events_date ON gbs_calendar_events(date);
CREATE INDEX IF NOT EXISTS idx_gbs_calendar_events_end_date ON gbs_calendar_events(end_date);
CREATE INDEX IF NOT EXISTS idx_gbs_calendar_events_created_at ON gbs_calendar_events(created_at DESC);

-- 자동 updated_at 업데이트 트리거
CREATE OR REPLACE FUNCTION update_gbs_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gbs_calendar_events_timestamp
    BEFORE UPDATE ON gbs_calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_gbs_calendar_events_updated_at();

-- 코멘트
COMMENT ON TABLE gbs_calendar_events IS 'GBS 캘린더 일정 이벤트';
COMMENT ON COLUMN gbs_calendar_events.date IS '시작일';
COMMENT ON COLUMN gbs_calendar_events.end_date IS '종료일 (기간 일정인 경우)';
COMMENT ON COLUMN gbs_calendar_events.time IS '시간 (HH:mm)';
COMMENT ON COLUMN gbs_calendar_events.title IS '일정 제목';
COMMENT ON COLUMN gbs_calendar_events.assignee IS '담당자';
