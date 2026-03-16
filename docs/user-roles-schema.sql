-- ============================================
-- User Roles Schema
-- 사용자 역할 관리 테이블 및 RLS 정책
-- PRD Section 4.6.3 기반
-- ============================================

-- 1. User Roles 테이블 생성
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'entity_user', 'gbs_user', 'gbs_admin', 'executive'
  entity_code VARCHAR(10), -- NULL for GBS/Executive, specific entity for entity_user
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, entity_code)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_entity_code ON user_roles(entity_code);

-- 3. RLS 활성화
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책

-- Policy: 사용자는 자신의 역할만 조회 가능
DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
CREATE POLICY "Users can view own role"
ON user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy: GBS Admin만 역할 추가 가능
DROP POLICY IF EXISTS "GBS Admin can insert roles" ON user_roles;
CREATE POLICY "GBS Admin can insert roles"
ON user_roles FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'gbs_admin'
  )
);

-- Policy: GBS Admin만 역할 수정 가능
DROP POLICY IF EXISTS "GBS Admin can update roles" ON user_roles;
CREATE POLICY "GBS Admin can update roles"
ON user_roles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'gbs_admin'
  )
);

-- Policy: GBS Admin만 역할 삭제 가능
DROP POLICY IF EXISTS "GBS Admin can delete roles" ON user_roles;
CREATE POLICY "GBS Admin can delete roles"
ON user_roles FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'gbs_admin'
  )
);

-- ============================================
-- 초기 Admin 사용자 설정 (필요시 수동 실행)
-- ============================================
/*
-- 특정 사용자를 GBS Admin으로 설정
INSERT INTO user_roles (user_id, role, entity_code)
VALUES (
  'YOUR_USER_UUID_HERE', -- auth.users에서 user_id 확인
  'gbs_admin',
  NULL
);
*/

-- ============================================
-- 헬퍼 함수: 사용자 역할 확인
-- ============================================
CREATE OR REPLACE FUNCTION get_user_role(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM user_roles
  WHERE user_id = p_user_id
  LIMIT 1;
  
  RETURN COALESCE(v_role, 'guest');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수: 현재 사용자가 GBS Team인지 확인
CREATE OR REPLACE FUNCTION is_gbs_team()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role IN ('gbs_admin', 'gbs_user')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수: 현재 사용자가 특정 Entity에 접근 가능한지 확인
CREATE OR REPLACE FUNCTION can_access_entity(p_entity_code VARCHAR(10))
RETURNS BOOLEAN AS $$
BEGIN
  -- GBS Team은 모든 Entity 접근 가능
  IF is_gbs_team() THEN
    RETURN TRUE;
  END IF;
  
  -- Entity User는 자신의 Entity만 접근 가능
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND entity_code = p_entity_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 확인 쿼리
-- ============================================
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'user_roles'
ORDER BY ordinal_position;
