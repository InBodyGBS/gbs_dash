-- ============================================
-- User Role Changes Audit Schema
-- /gbs/users 관리 화면에서 발생하는 모든 역할 변경 이력을 기록한다.
-- gbs_admin 만 조회 가능, INSERT 는 API 라우트(service_role) 에서만.
-- ============================================

CREATE TABLE IF NOT EXISTS user_role_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- 변경을 수행한 관리자
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_name TEXT,
  -- 대상 사용자
  target_user_id UUID NOT NULL,
  target_email TEXT,
  target_name TEXT,
  -- 작업 종류
  action VARCHAR(20) NOT NULL CHECK (action IN ('approve', 'update', 'remove')),
  -- 변경 전·후 스냅샷 (JSON 으로 다중 entity_code 도 표현)
  -- 예: { "role": "entity_user", "entity_codes": ["KR-HQ", "JP-TKY"] }
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_role_changes_target ON user_role_changes(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_changes_actor ON user_role_changes(actor_id);
CREATE INDEX IF NOT EXISTS idx_user_role_changes_created_at ON user_role_changes(created_at DESC);

COMMENT ON TABLE user_role_changes IS '역할 변경 감사 로그 (관리자 화면에서만 기록)';

-- RLS
ALTER TABLE user_role_changes ENABLE ROW LEVEL SECURITY;

-- 조회: gbs_admin 만
DROP POLICY IF EXISTS "gbs_admin can view role changes" ON user_role_changes;
CREATE POLICY "gbs_admin can view role changes"
  ON user_role_changes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'gbs_admin'
    )
  );

-- INSERT 는 service_role 만 (정책 미부여 = 차단)
