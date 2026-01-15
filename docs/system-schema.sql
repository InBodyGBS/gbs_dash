-- ============================================
-- System 관리 테이블 생성 스크립트
-- ============================================

-- 1. systems (시스템 현황)
CREATE TABLE IF NOT EXISTS systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES subsidiaries(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN ('ERP', 'CRM', '생산관리', '물류', '회계', 'CS', 'Payroll', '기타')
  ),
  system_name TEXT,
  version TEXT,
  vendor TEXT,
  implementation_date DATE,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(entity_id, category)
);

CREATE INDEX IF NOT EXISTS idx_systems_entity ON systems(entity_id);
CREATE INDEX IF NOT EXISTS idx_systems_category ON systems(category);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_systems_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS systems_updated_at ON systems;
CREATE TRIGGER systems_updated_at
BEFORE UPDATE ON systems
FOR EACH ROW
EXECUTE FUNCTION update_systems_updated_at();

-- 2. projects (프로젝트)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  entity_id UUID NOT NULL REFERENCES subsidiaries(id),
  category TEXT NOT NULL CHECK (
    category IN ('ERP', 'CRM', '생산관리', '물류', '회계', 'CS', 'Payroll', '기타')
  ),
  status TEXT NOT NULL DEFAULT '계획중' CHECK (
    status IN ('계획중', '진행중', '완료', '보류', '취소')
  ),
  pm TEXT NOT NULL,
  start_date DATE,
  due_date DATE,
  completion_date DATE,
  description TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_entity ON projects(entity_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_pm ON projects(pm);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_projects_updated_at();

-- 3. tasks (프로젝트 태스크)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '계획중' CHECK (
    status IN ('계획중', '진행중', '완료', '지연', '보류')
  ),
  due_date DATE,
  completed_date DATE,
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  estimated_hours DECIMAL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(project_id, task_number)
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_tasks_updated_at();

-- 4. processes (프로세스)
CREATE TABLE IF NOT EXISTS processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  entity_id UUID NOT NULL REFERENCES subsidiaries(id),
  category TEXT NOT NULL CHECK (
    category IN ('회계', '구매', '판매', '비용', '자금', 'FOC', '결산')
  ),
  description TEXT,
  flowchart_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT '작성중' CHECK (
    status IN ('작성중', '검토중', '승인완료', '보관')
  ),
  created_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processes_entity ON processes(entity_id);
CREATE INDEX IF NOT EXISTS idx_processes_category ON processes(category);
CREATE INDEX IF NOT EXISTS idx_processes_status ON processes(status);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_processes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS processes_updated_at ON processes;
CREATE TRIGGER processes_updated_at
BEFORE UPDATE ON processes
FOR EACH ROW
EXECUTE FUNCTION update_processes_updated_at();

-- RLS (Row Level Security) 정책
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 조회/생성/수정/삭제 가능
CREATE POLICY "Anyone can view systems" ON systems FOR SELECT USING (true);
CREATE POLICY "Anyone can create systems" ON systems FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update systems" ON systems FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete systems" ON systems FOR DELETE USING (true);

CREATE POLICY "Anyone can view projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Anyone can create projects" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update projects" ON projects FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete projects" ON projects FOR DELETE USING (true);

CREATE POLICY "Anyone can view tasks" ON tasks FOR SELECT USING (true);
CREATE POLICY "Anyone can create tasks" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update tasks" ON tasks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete tasks" ON tasks FOR DELETE USING (true);

CREATE POLICY "Anyone can view processes" ON processes FOR SELECT USING (true);
CREATE POLICY "Anyone can create processes" ON processes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update processes" ON processes FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete processes" ON processes FOR DELETE USING (true);

