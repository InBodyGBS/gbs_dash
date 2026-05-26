/**
 * 결산 일정표 (Closing Task Master) 타입
 */

export type ClosingTaskFreq = '월' | '분기';
export type ClosingTaskStatus = 'todo' | 'inprog' | 'done' | 'delay';

/** 마스터 task — 재사용 정의 */
export interface ClosingTaskMaster {
  id: number;
  cat: string;
  freq: ClosingTaskFreq;
  sub: string | null;
  name: string;
  assignee: string | null;
  /** 'D-3', 'D+4' 형식 */
  ps: string | null;
  pe: string | null;
  predecessors: number[];
  successors: number[];
  output: string | null;
  active: boolean;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

/** 사이클 record — 특정 결산월의 task 실행 기록 */
export interface ClosingTaskRecord {
  id: string;
  task_id: number;
  cm_year: number;
  cm_month: number;
  as_date: string | null;
  ae_date: string | null;
  status: ClosingTaskStatus;
  note: string | null;
  files: Array<{ name: string; url: string; path?: string }>;
  completed_by: string | null;
  completed_at: string | null;
  updated_at: string;
}

/** UI 표시용 — master + 해당 사이클 record + D-day 해석 결과 */
export interface ClosingTaskView {
  master: ClosingTaskMaster;
  record: ClosingTaskRecord | null;
  /** ps를 절대일로 변환 (Date) */
  plannedStart: Date | null;
  plannedEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  status: ClosingTaskStatus;
}

/** 공휴일 */
export interface ClosingHoliday {
  holiday_date: string; // YYYY-MM-DD
  name: string | null;
}

/** Form data (Master 편집용) */
export interface ClosingTaskMasterFormData {
  id?: number;
  cat: string;
  freq: ClosingTaskFreq;
  sub?: string;
  name: string;
  assignee?: string;
  ps?: string;
  pe?: string;
  predecessors?: number[];
  successors?: number[];
  output?: string;
  active?: boolean;
  display_order?: number;
}

/** 필터 */
export interface ClosingTaskFilters {
  cats: string[];
  freqs: ClosingTaskFreq[];
  assignees: string[];
  statuses: ClosingTaskStatus[];
  search: string;
}

/** 통계 */
export interface ClosingTaskStats {
  total: number;
  todo: number;
  inprog: number;
  done: number;
  delay: number;
  overdueCount: number; // 계획 종료일 지났는데 미완료
}

/** 카테고리 표시용 색상 */
export const CLOSING_TASK_CAT_COLORS: Record<string, string> = {
  결산: '#971B2F',
  재고: '#EF8100',
  비용: '#1E66D9',
  산출물: '#01BA65',
  결산조정: '#3D4B61',
  원가: '#7C3AED',
  기타: '#67767F',
};

export const CLOSING_TASK_STATUS_LABEL: Record<ClosingTaskStatus, string> = {
  todo: '예정',
  inprog: '진행중',
  done: '완료',
  delay: '지연',
};
