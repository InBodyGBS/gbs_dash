/**
 * Todo List 타입
 */

export type TodoStatus = 'todo' | 'in_progress' | 'done';
export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TodoItem {
  id: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: string | null;
  assignee: string | null;
  tags: string[];
  entity_id: string | null;
  created_by: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TodoFormData {
  id?: string;
  title: string;
  description?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  due_date?: string | null;
  assignee?: string;
  tags?: string[];
  entity_id?: string | null;
}

export interface TodoFilters {
  search: string;
  statuses: TodoStatus[];
  priorities: TodoPriority[];
  assignees: string[];
  tags: string[];
  showCompleted: boolean;
}

export type TodoSortOption =
  | 'due_asc'
  | 'due_desc'
  | 'created_desc'
  | 'created_asc'
  | 'priority';

export interface TodoStats {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  /** 마감 임박 (D-3 이내 & 미완료) */
  dueSoon: number;
  overdue: number;
}

export const TODO_STATUS_LABEL: Record<TodoStatus, string> = {
  todo: '예정',
  in_progress: '진행중',
  done: '완료',
};

export const TODO_STATUS_COLOR: Record<TodoStatus, string> = {
  todo: '#9ca3af',
  in_progress: '#3B82F6',
  done: '#10B981',
};

export const TODO_PRIORITY_LABEL: Record<TodoPriority, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  urgent: '긴급',
};

export const TODO_PRIORITY_COLOR: Record<TodoPriority, string> = {
  low: '#9ca3af',
  medium: '#EAB308',
  high: '#F97316',
  urgent: '#EF4444',
};

export const TODO_PRIORITY_ORDER: Record<TodoPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};
