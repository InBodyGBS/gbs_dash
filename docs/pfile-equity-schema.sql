-- ============================================
-- P-File: 지분구조도 (법인 노드 + 지분/관계 엣지)
-- Admin > P-File 화면에서 사용
--
-- 한 번에 실행: 기존 DB는 IF NOT EXISTS / ADD COLUMN IF NOT EXISTS 로 보완
-- subsidiaries(기존 법인 마스터)와 선택 연동: subsidiary_id
-- ============================================

CREATE TABLE IF NOT EXISTS pfile_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('hq', 'subsidiary', 'associate')),
  subsidiary_id uuid REFERENCES subsidiaries (id) ON DELETE SET NULL,
  incorporation_date date,
  country text,
  industry text,
  currency text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 이미 예전 스크립트로 테이블만 만든 경우: 컬럼 추가
ALTER TABLE pfile_entities
  ADD COLUMN IF NOT EXISTS subsidiary_id uuid REFERENCES subsidiaries (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pfile_entities_subsidiary ON pfile_entities (subsidiary_id);

-- 같은 subsidiaries 행은 지분도 노드에 한 번만 연결
CREATE UNIQUE INDEX IF NOT EXISTS pfile_entities_subsidiary_id_unique
  ON pfile_entities (subsidiary_id)
  WHERE subsidiary_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pfile_ownership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id uuid NOT NULL REFERENCES pfile_entities (id) ON DELETE CASCADE,
  to_entity_id uuid NOT NULL REFERENCES pfile_entities (id) ON DELETE CASCADE,
  relation_kind text NOT NULL CHECK (relation_kind IN ('control', 'associate')),
  share_pct numeric(5, 2),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pfile_ownership_no_self CHECK (from_entity_id <> to_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_pfile_ownership_from ON pfile_ownership (from_entity_id);
CREATE INDEX IF NOT EXISTS idx_pfile_ownership_to ON pfile_ownership (to_entity_id);
CREATE INDEX IF NOT EXISTS idx_pfile_entities_type ON pfile_entities (entity_type);

ALTER TABLE pfile_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pfile_ownership ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pfile_entities_select" ON pfile_entities;
DROP POLICY IF EXISTS "pfile_entities_insert" ON pfile_entities;
DROP POLICY IF EXISTS "pfile_entities_update" ON pfile_entities;
DROP POLICY IF EXISTS "pfile_entities_delete" ON pfile_entities;
DROP POLICY IF EXISTS "pfile_ownership_select" ON pfile_ownership;
DROP POLICY IF EXISTS "pfile_ownership_insert" ON pfile_ownership;
DROP POLICY IF EXISTS "pfile_ownership_update" ON pfile_ownership;
DROP POLICY IF EXISTS "pfile_ownership_delete" ON pfile_ownership;

CREATE POLICY "pfile_entities_select" ON pfile_entities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pfile_entities_insert" ON pfile_entities
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pfile_entities_update" ON pfile_entities
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pfile_entities_delete" ON pfile_entities
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "pfile_ownership_select" ON pfile_ownership
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pfile_ownership_insert" ON pfile_ownership
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pfile_ownership_update" ON pfile_ownership
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pfile_ownership_delete" ON pfile_ownership
  FOR DELETE TO authenticated USING (true);

-- ============================================
-- 데모 데이터 (선택). 운영 DB에는 실행하지 마세요.
-- subsidiary_id 에 실제 subsidiaries.id 를 넣으면 화면에 마스터 이름/국가/코드가 반영됩니다.
-- ============================================
/*
INSERT INTO pfile_entities (name, entity_type, subsidiary_id, incorporation_date, country, industry, currency, display_order) VALUES
  ('HQ', 'hq', NULL, '2000-01-01', 'KR', '지주', 'KRW', 0),
  ('법인 A', 'subsidiary', NULL, '2010-03-15', 'JP', '제조', 'JPY', 1),
  ...;

-- 위 INSERT 후 반환된 id로 교체하여 pfile_ownership 행을 채우세요.
*/
