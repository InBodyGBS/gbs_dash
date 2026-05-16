-- ============================================
-- Submission Templates — 카테고리별 제출 양식 (Admin 업로드)
-- 사용자는 "템플릿 다운로드" 시 여기 등록된 파일을 받음
-- 카테고리당 1개만 — UNIQUE(category)
-- ============================================

CREATE TABLE IF NOT EXISTS submission_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,            -- ClosingCategoryId (예: 'trial-balance')
  file_name TEXT NOT NULL,                  -- 원본 파일명 (예: 'TB_Template.xlsx')
  file_path TEXT NOT NULL,                  -- Storage 경로 (submission 버킷 기준)
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  uploaded_by TEXT,                         -- 업로더 이메일/이름
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submission_templates_category
  ON submission_templates (category);

COMMENT ON TABLE submission_templates IS 'Financial Closing 카테고리별 제출 템플릿 (Admin 업로드)';

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_submission_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_submission_templates_updated_at ON submission_templates;
CREATE TRIGGER trg_submission_templates_updated_at
  BEFORE UPDATE ON submission_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_submission_templates_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE submission_templates ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자 — 읽기 허용 (사용자가 다운로드해야 하므로)
DROP POLICY IF EXISTS "Authenticated read submission_templates" ON submission_templates;
CREATE POLICY "Authenticated read submission_templates"
  ON submission_templates FOR SELECT
  TO authenticated
  USING (true);

-- gbs_admin 만 INSERT / UPDATE / DELETE
DROP POLICY IF EXISTS "Admin insert submission_templates" ON submission_templates;
CREATE POLICY "Admin insert submission_templates"
  ON submission_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'gbs_admin'
    )
  );

DROP POLICY IF EXISTS "Admin update submission_templates" ON submission_templates;
CREATE POLICY "Admin update submission_templates"
  ON submission_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'gbs_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'gbs_admin'
    )
  );

DROP POLICY IF EXISTS "Admin delete submission_templates" ON submission_templates;
CREATE POLICY "Admin delete submission_templates"
  ON submission_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'gbs_admin'
    )
  );

-- ============================================
-- Storage 정책 — submission 버킷의 templates/ 폴더 전용
-- 모든 정책을 SQL 로 직접 등록 (Dashboard 수동 설정 불필요)
-- ============================================

-- 1) SELECT — 인증 사용자 전체 다운로드 가능
DROP POLICY IF EXISTS "Authenticated read submission templates folder" ON storage.objects;
CREATE POLICY "Authenticated read submission templates folder"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'submission'
    AND (storage.foldername(name))[1] = 'templates'
  );

-- 2) INSERT — gbs_admin 만 업로드 가능
DROP POLICY IF EXISTS "Admin insert submission templates folder" ON storage.objects;
CREATE POLICY "Admin insert submission templates folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'submission'
    AND (storage.foldername(name))[1] = 'templates'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'gbs_admin'
    )
  );

-- 3) UPDATE — gbs_admin 만 갱신 가능 (upsert, metadata 변경 등)
DROP POLICY IF EXISTS "Admin update submission templates folder" ON storage.objects;
CREATE POLICY "Admin update submission templates folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'submission'
    AND (storage.foldername(name))[1] = 'templates'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'gbs_admin'
    )
  )
  WITH CHECK (
    bucket_id = 'submission'
    AND (storage.foldername(name))[1] = 'templates'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'gbs_admin'
    )
  );

-- 4) DELETE — gbs_admin 만 삭제 가능 (이전 파일 정리 + 명시적 삭제)
DROP POLICY IF EXISTS "Admin delete submission templates folder" ON storage.objects;
CREATE POLICY "Admin delete submission templates folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'submission'
    AND (storage.foldername(name))[1] = 'templates'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'gbs_admin'
    )
  );

-- ============================================
-- 검증 — 적용된 정책 확인
-- ============================================
SELECT
  policyname,
  cmd AS operation,
  CASE
    WHEN cmd = 'r' THEN 'SELECT'
    WHEN cmd = 'a' THEN 'INSERT'
    WHEN cmd = 'w' THEN 'UPDATE'
    WHEN cmd = 'd' THEN 'DELETE'
    ELSE cmd::text
  END AS readable_op
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%submission templates folder%'
ORDER BY policyname;
