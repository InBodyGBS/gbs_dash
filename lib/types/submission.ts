/**
 * Submission 관련 타입 정의
 */

import type { ClosingCategoryId } from '@/lib/constants/closing-categories';

export interface Submission {
  id: string;
  quarter_id: string | null;
  subsidiary_id: string | null;
  category: ClosingCategoryId;
  file_name: string;
  file_path: string;
  file_size: number;
  version: number;
  submitted_by: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface SubmissionComment {
  id: string;
  submission_id: string;
  message: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  edited: boolean;
  // 사용자 정보 (옵셔널, 조회 시 함께 가져옴)
  user_name?: string | null;
  user_email?: string | null;
}

export interface SubmissionFormData {
  category: ClosingCategoryId;
  file: File;
  quarter_id?: string | null;
  subsidiary_id?: string | null;
  fiscal_year?: string | null;
  entity_name?: string | null;
  /** Overview·Submission 상단과 동일한 귀속 월 (1–12), 확정 여부 판단에 사용 */
  closing_month?: string | null;
}
