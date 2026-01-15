/**
 * System 관리 관련 타입 정의
 */

export type SystemCategory = 'ERP' | 'CRM' | '생산관리' | '물류' | '회계' | 'CS' | 'Payroll' | '기타';

export interface System {
  id: string;
  entity_id: string;
  category: SystemCategory;
  system_name: string | null;
  version: string | null;
  vendor: string | null;
  implementation_date: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SystemFormData {
  entity_id: string;
  category: SystemCategory;
  system_name?: string;
  version?: string;
  vendor?: string;
  implementation_date?: string;
  notes?: string;
  created_by: string;
}

export type ProjectStatus = '계획중' | '진행중' | '완료' | '보류' | '취소';

export interface Project {
  id: string;
  title: string;
  entity_id: string;
  category: SystemCategory;
  status: ProjectStatus;
  pm: string;
  start_date: string | null;
  due_date: string | null;
  completion_date: string | null;
  description: string | null;
  progress: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = '계획중' | '진행중' | '완료' | '지연' | '보류';

export interface Task {
  id: string;
  project_id: string;
  task_number: string;
  title: string;
  description: string | null;
  assignee: string;
  status: TaskStatus;
  due_date: string | null;
  completed_date: string | null;
  progress: number;
  estimated_hours: number | null;
  parent_task_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export type ProcessCategory = '회계' | '구매' | '판매' | '비용' | '자금' | 'FOC' | '결산';
export type ProcessStatus = '작성중' | '검토중' | '승인완료' | '보관';

export interface Process {
  id: string;
  title: string;
  entity_id: string;
  category: ProcessCategory;
  description: string | null;
  flowchart_data: Record<string, any>;
  version: number;
  status: ProcessStatus;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

