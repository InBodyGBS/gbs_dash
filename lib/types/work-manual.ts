/**
 * Work Manual 타입 정의
 */

export type WorkManualType = '업무기술서' | '업무분장표';

export interface WorkManual {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  file_type: WorkManualType | null;
  uploaded_by: string | null;
  uploaded_at: string;
  content?: any; // JSONB
}
