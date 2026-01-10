/**
 * Issue 관리 관련 타입 정의
 */

export interface Issue {
  id: string;
  title: string;
  category: IssueCategory;
  entity_id: string;
  description: string;
  response: string | null;
  status: IssueStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type IssueCategory =
  | 'Tax'
  | 'Lease'
  | 'Closing'
  | 'System'
  | 'Audit'
  | 'Depreciation'
  | 'Labor SG&A'
  | 'Accrual'
  | 'PKG'
  | 'Inventory'
  | 'Bad debt'
  | 'Allowance'
  | 'FS'
  | 'Others';

export type IssueStatus = '확인 중' | '완료';

export interface IssueFormData {
  title: string;
  category: IssueCategory;
  entity_id: string;
  description: string;
  response?: string;
  status?: IssueStatus;
  created_by: string;
}

export interface IssueFilters {
  search: string;
  categories: IssueCategory[];
  entities: string[];
  statuses: IssueStatus[];
}

export type IssueSortOption = 'created_desc' | 'created_asc' | 'entity' | 'category';

export interface IssueStats {
  total: number;
  inProgress: number;
  completed: number;
  completionRate: number;
}

export interface CategoryCount {
  category: IssueCategory;
  count: number;
}

export interface EntityCount {
  entity_id: string;
  entity_name: string;
  count: number;
}

