/**
 * Category Review Status Service
 *
 * Required Supabase tables:
 *
 * CREATE TABLE category_review_status (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   quarter_id TEXT NOT NULL,
 *   subsidiary_id TEXT NOT NULL,
 *   category TEXT NOT NULL,
 *   status TEXT NOT NULL DEFAULT 'none',
 *   reviewed_by TEXT,
 *   confirmed_by TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE(quarter_id, subsidiary_id, category)
 * );
 *
 * -- voe_inquiries 에 컬럼 추가:
 * ALTER TABLE voe_inquiries ADD COLUMN direction TEXT NOT NULL DEFAULT 'entity_to_gbs';
 * ALTER TABLE voe_inquiries ADD COLUMN source_category TEXT;
 * ALTER TABLE voe_inquiries ADD COLUMN source_quarter_id TEXT;
 */

import { supabase } from '@/lib/supabase/client';
import type { CategoryReviewStatus, ReviewStatus } from '@/lib/types/category-review';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reviewTable = () => (supabase as any).from('category_review_status');

export async function getCategoryReviewStatuses(quarterId: string): Promise<CategoryReviewStatus[]> {
  const { data, error } = await reviewTable()
    .select('*')
    .eq('quarter_id', quarterId);
  if (error) throw new Error(error.message);
  return (data || []) as CategoryReviewStatus[];
}

export async function upsertCategoryReviewStatus(
  quarterId: string,
  subsidiaryId: string,
  category: string,
  status: ReviewStatus,
  actor?: string
): Promise<CategoryReviewStatus> {
  const update: Record<string, unknown> = {
    quarter_id: quarterId,
    subsidiary_id: subsidiaryId,
    category,
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'reviewing' && actor) update.reviewed_by = actor;
  if (status === 'confirmed' && actor) update.confirmed_by = actor;
  if (status === 'none') {
    update.reviewed_by = null;
    update.confirmed_by = null;
  }

  const { data, error } = await reviewTable()
    .upsert(update, { onConflict: 'quarter_id,subsidiary_id,category' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CategoryReviewStatus;
}
