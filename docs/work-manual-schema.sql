-- ============================================
-- Work Manual 데이터베이스 스키마
-- ============================================

-- work_manuals 테이블 생성
CREATE TABLE IF NOT EXISTS work_manuals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content JSONB -- 파싱된 내용을 JSON으로 저장 (선택사항)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_work_manuals_uploaded_at ON work_manuals(uploaded_at DESC);

-- 코멘트
COMMENT ON TABLE work_manuals IS '업무기술서 파일 정보';
COMMENT ON COLUMN work_manuals.file_name IS '파일명';
COMMENT ON COLUMN work_manuals.file_path IS 'Supabase Storage 경로';
COMMENT ON COLUMN work_manuals.file_size IS '파일 크기 (bytes)';
COMMENT ON COLUMN work_manuals.uploaded_by IS '업로드한 사용자';
COMMENT ON COLUMN work_manuals.uploaded_at IS '업로드 일시';
COMMENT ON COLUMN work_manuals.content IS '파싱된 문서 내용 (JSON)';

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================

-- RLS 활성화
ALTER TABLE work_manuals ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 조회 가능
CREATE POLICY "Anyone can view work manuals"
  ON work_manuals
  FOR SELECT
  USING (true);

-- 인증된 사용자가 업로드 가능
CREATE POLICY "Authenticated users can upload work manuals"
  ON work_manuals
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 인증된 사용자가 삭제 가능
CREATE POLICY "Authenticated users can delete work manuals"
  ON work_manuals
  FOR DELETE
  USING (auth.role() = 'authenticated');
