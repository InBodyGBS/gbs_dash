export type ReviewStatus = 'none' | 'reviewing' | 'confirmed';

export interface CategoryReviewStatus {
  id: string;
  quarter_id: string;
  subsidiary_id: string;
  category: string;
  status: ReviewStatus;
  reviewed_by: string | null;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
}
