export type VoeStatus = 'Pending' | 'In Progress' | 'Resolved';
export type VoeCategory = 'General' | 'Accounting' | 'Tax' | 'Closing' | 'System' | 'Other';

/**
 * entity_to_gbs: 법인 담당자 → GBS 문의 (기존)
 * gbs_to_entity: GBS → 법인 담당자 문의 (Quarterly Closing Reviewing 에서 생성)
 */
export type VoeDirection = 'entity_to_gbs' | 'gbs_to_entity';

export interface VoeInquiry {
  id: string;
  title: string;
  content: string;
  category: VoeCategory;
  entity_name: string;
  author: string;
  status: VoeStatus;
  /** 문의 방향 */
  direction: VoeDirection;
  /** QC Overview Reviewing 에서 생성된 경우: 카테고리 ID */
  source_category: string | null;
  /** QC Overview Reviewing 에서 생성된 경우: quarter_id */
  source_quarter_id: string | null;
  response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export type VoeInquiryInsert = Omit<
  VoeInquiry,
  'id' | 'status' | 'response' | 'responded_by' | 'responded_at' | 'created_at' | 'updated_at'
> & {
  direction?: VoeDirection;
  source_category?: string | null;
  source_quarter_id?: string | null;
};
