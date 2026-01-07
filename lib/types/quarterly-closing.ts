/**
 * Quarterly Closing 관련 타입 정의
 */

export interface Quarter {
  id: string;
  year: number;
  quarter: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface ScheduleItem {
  id: string;
  quarter_id: string;
  subsidiary_id: string;
  category: string;
  planned_date: string;
  confirmed_date: string | null;
  status: 'planned' | 'confirmed';
  created_at: string;
  updated_at: string;
}

export interface DocumentSubmission {
  id: string;
  quarter_id: string;
  subsidiary_id: string;
  category: string;
  file_name: string;
  file_path: string;
  file_size: number;
  version: number;
  submitted_by: string | null;
  submitted_at: string;
}

export interface ClosingGuide {
  id: string;
  title: string;
  category: string;
  icon: string | null;
  summary: string | null;
  content: string;
  attachments: any;
  tags: string[] | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

