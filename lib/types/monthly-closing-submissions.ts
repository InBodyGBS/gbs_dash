import type { MonthlyClosingCategoryId } from '@/lib/constants/monthly-closing-categories';

export interface MonthlySubmission {
  id: string;
  period_year: number;
  period_month: number;
  subsidiary_id: string | null;
  category: MonthlyClosingCategoryId | string;
  file_name: string;
  file_path: string;
  file_size: number;
  version: number;
  submitted_by: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface MonthlyReviewStatus {
  id: string;
  period_year: number;
  period_month: number;
  subsidiary_id: string | null;
  reviewing: boolean;
  confirm: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonthlySubmissionFormData {
  file: File;
  category: MonthlyClosingCategoryId;
  periodYear: number;
  periodMonth: number;
  subsidiaryId: string;
}

