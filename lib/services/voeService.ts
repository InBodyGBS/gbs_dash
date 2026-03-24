/**
 * VOE (Voice of Entity) Service
 *
 * Required Supabase table:
 *
 * CREATE TABLE voe_inquiries (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   title TEXT NOT NULL,
 *   content TEXT NOT NULL,
 *   category TEXT NOT NULL DEFAULT 'General',
 *   entity_name TEXT NOT NULL,
 *   author TEXT NOT NULL,
 *   status TEXT NOT NULL DEFAULT 'Pending',
 *   response TEXT,
 *   responded_by TEXT,
 *   responded_at TIMESTAMPTZ,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */

import { supabase } from '@/lib/supabase/client';
import type { VoeInquiry, VoeInquiryInsert, VoeStatus } from '@/lib/types/voe';

const voeTable = () => supabase.from('voe_inquiries' as never);

/** 전체 문의 조회 (관리자용) */
export async function getVoeInquiries(): Promise<VoeInquiry[]> {
  const { data, error } = await voeTable()
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as VoeInquiry[];
}

/** 특정 법인의 문의 조회: 내가 보낸 문의(entity_to_gbs) + GBS가 보낸 문의(gbs_to_entity) */
export async function getVoeInquiriesByEntity(entityName: string): Promise<VoeInquiry[]> {
  const { data, error } = await voeTable()
    .select('*')
    .eq('entity_name', entityName)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as VoeInquiry[];
}

/** GBS → Entity 문의 생성 (Quarterly Closing Reviewing 에서 호출) */
export async function createGbsToEntityInquiry(params: {
  title: string;
  content: string;
  entityName: string;
  author: string;         // GBS 담당자 이름
  sourceCategory: string; // closing category id
  sourceQuarterId: string;
}): Promise<VoeInquiry> {
  const { data, error } = await voeTable()
    .insert({
      title: params.title,
      content: params.content,
      category: 'Closing' as const,
      entity_name: params.entityName,
      author: params.author,
      direction: 'gbs_to_entity',
      source_category: params.sourceCategory,
      source_quarter_id: params.sourceQuarterId,
    } as never)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as VoeInquiry;
}

export async function createVoeInquiry(inquiry: VoeInquiryInsert): Promise<VoeInquiry> {
  const { data, error } = await voeTable()
    .insert(inquiry as never)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as VoeInquiry;
}

export async function updateVoeStatus(
  id: string,
  status: VoeStatus,
  response?: string,
  respondedBy?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (response !== undefined) update.response = response;
  if (respondedBy !== undefined) {
    update.responded_by = respondedBy;
    update.responded_at = new Date().toISOString();
  }

  const { error } = await voeTable().update(update as never).eq('id', id);
  if (error) throw new Error(error.message);
}
