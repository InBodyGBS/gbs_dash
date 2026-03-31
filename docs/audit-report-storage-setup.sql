-- ============================================
-- Audit Report Storage
-- 버킷 ID: audit-report (UI·문서 표기: "Audit report")
-- Audit and Tax > 감사 현황 탭에서 Audit Report 파일 업로드 시 사용
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-report', 'audit-report', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "audit_report_allow_insert" ON storage.objects;
DROP POLICY IF EXISTS "audit_report_allow_select" ON storage.objects;
DROP POLICY IF EXISTS "audit_report_allow_delete" ON storage.objects;

CREATE POLICY "audit_report_allow_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audit-report');

CREATE POLICY "audit_report_allow_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'audit-report');

CREATE POLICY "audit_report_allow_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'audit-report');
