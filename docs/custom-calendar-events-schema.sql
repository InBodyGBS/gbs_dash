-- Closing Schedule 대시보드 캘린더 — 수기 등록 이벤트 (기기 간 공유)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS custom_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_calendar_events_event_date
  ON custom_calendar_events (event_date);

COMMENT ON TABLE custom_calendar_events IS 'Closing Schedule 캘린더 수기 이벤트';

ALTER TABLE custom_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read custom_calendar_events" ON custom_calendar_events;
CREATE POLICY "Authenticated read custom_calendar_events"
  ON custom_calendar_events FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert custom_calendar_events" ON custom_calendar_events;
CREATE POLICY "Authenticated insert custom_calendar_events"
  ON custom_calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated delete custom_calendar_events" ON custom_calendar_events;
CREATE POLICY "Authenticated delete custom_calendar_events"
  ON custom_calendar_events FOR DELETE
  TO authenticated
  USING (true);
