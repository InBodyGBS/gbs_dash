-- ============================================
-- Role Page Permissions
-- 역할(role)별로 어떤 페이지(page_id)에 접근할 수 있는지 관리
-- ============================================
-- 정책:
--   - 행 존재 = 접근 허용, 행 없음 = 접근 불허 (deny by default)
--   - gbs_admin 은 코드 레벨에서 항상 모든 페이지 접근 (테이블 무시)
--   - entity_user 만 본 테이블의 영향을 받음
--
-- page_id 는 lib/constants/pages.ts 의 PAGE_REGISTRY 와 1:1 매칭
-- ============================================

CREATE TABLE IF NOT EXISTS role_page_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role VARCHAR(20) NOT NULL CHECK (role IN ('entity_user', 'gbs_admin')),
  page_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, page_id)
);

CREATE INDEX IF NOT EXISTS idx_role_page_permissions_role
  ON role_page_permissions (role);

COMMENT ON TABLE role_page_permissions IS '역할별 페이지 접근 권한 (entity_user 만 영향, gbs_admin 은 코드에서 항상 허용)';

-- ============================================
-- RLS
-- ============================================
ALTER TABLE role_page_permissions ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자: 자신이 가진 role 의 행을 조회 가능
DROP POLICY IF EXISTS "Authenticated read role_page_permissions" ON role_page_permissions;
CREATE POLICY "Authenticated read role_page_permissions"
  ON role_page_permissions FOR SELECT
  TO authenticated
  USING (true);

-- gbs_admin 만 INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "GBS Admin insert role_page_permissions" ON role_page_permissions;
CREATE POLICY "GBS Admin insert role_page_permissions"
  ON role_page_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'gbs_admin'
    )
  );

DROP POLICY IF EXISTS "GBS Admin delete role_page_permissions" ON role_page_permissions;
CREATE POLICY "GBS Admin delete role_page_permissions"
  ON role_page_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'gbs_admin'
    )
  );

-- ============================================
-- 초기 추천 권한 (entity_user) — 필요시 주석 해제 후 실행
-- ============================================
/*
INSERT INTO role_page_permissions (role, page_id) VALUES
  ('entity_user', 'dashboard'),
  ('entity_user', 'announcements'),
  ('entity_user', 'finance-guide'),
  ('entity_user', 'my-submissions'),
  ('entity_user', 'voe'),
  ('entity_user', 'profile')
ON CONFLICT (role, page_id) DO NOTHING;
*/
