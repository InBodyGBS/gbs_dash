/**
 * VOE (Voice of Entity) Service
 *
 * Required Supabase table:
 *
 * CREATE TABLE voe_inquiries (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   title TEXT NOT NULL,
 *   content TEXT NOT NULL,
 *   category TEXT NOT NULL DEFAULT 'General',
 *   entity_name TEXT NOT NULL,
 *   author TEXT NOT NULL,
 *   status TEXT NOT NULL DEFAULT 'Pending',
 *   response TEXT,
 *   responded_by TEXT,
 *   responded_at TIMESTAMPTZ,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 */

import { supabase } from '@/lib/supabase/client';
import type { VoeInquiry, VoeInquiryInsert, VoeStatus } from '@/lib/types/voe';
import { getCurrentUserRoleInfo } from '@/lib/services/userRoleService';

const voeTable = () => supabase.from('voe_inquiries' as never);

// ============================================================================
// 읽음 처리 — 사용자가 마지막으로 VOE 페이지를 방문한 시각을 localStorage 에 저장.
//   updated_at > lastSeen 인 항목 = '새 답변/문의'.
//   서버 측 read 테이블 없이 가벼운 in-app 알림 구현.
// ============================================================================

const VOE_LAST_SEEN_KEY = 'gbs_voe_last_seen_at';

/** 마지막 방문 시각(ISO) 가져오기 — 미설정 시 매우 옛날 값 반환 (= 모두 unread) */
function getVoeLastSeen(): string {
  if (typeof window === 'undefined') return '1970-01-01T00:00:00.000Z';
  return window.localStorage.getItem(VOE_LAST_SEEN_KEY) ?? '1970-01-01T00:00:00.000Z';
}

/** 현재 시각으로 마지막 방문 시각 갱신 — VOE 페이지 진입 시 호출 */
export function markVoeAsSeen(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(VOE_LAST_SEEN_KEY, new Date().toISOString());
}

/**
 * 사용자에게 보여줄 unread VOE 개수.
 *   - entity_user: 본인 법인 관련 항목 중 lastSeen 이후 갱신된 것
 *   - gbs_admin / 미부여: 모든 항목 중 lastSeen 이후 갱신된 것
 *
 * 사이드바 빨간 배지 / VOE 페이지 배너 등에서 호출.
 */
export async function getUnreadVoeCount(): Promise<number> {
  try {
    const lastSeen = getVoeLastSeen();
    const roleInfo = await getCurrentUserRoleInfo();

    let query = voeTable()
      .select('id', { count: 'exact', head: true })
      .gt('updated_at', lastSeen);

    // entity_user: 본인 법인 이름들로 필터
    if (!roleInfo.canSeeAll) {
      if (roleInfo.entityCodes.length === 0) return 0;
      const { data: subs } = await supabase
        .from('subsidiaries')
        .select('name')
        .in('code', roleInfo.entityCodes);
      const names = ((subs ?? []) as { name: string }[]).map((s) => s.name);
      if (names.length === 0) return 0;
      query = query.in('entity_name', names);
    }

    const { count, error } = await query;
    if (error) {
      console.warn('getUnreadVoeCount 오류:', error.message);
      return 0;
    }
    return count ?? 0;
  } catch (e) {
    console.warn('getUnreadVoeCount 예외:', e);
    return 0;
  }
}

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

/**
 * Quarterly Closing Overview Review에서 생성한 GBS→법인 문의만 조회
 * (source_quarter_id 로 해당 분기 스코프)
 */
export async function getOverviewReviewInquiries(quarterId: string): Promise<VoeInquiry[]> {
  const { data, error } = await voeTable()
    .select('*')
    .eq('source_quarter_id', quarterId)
    .eq('direction', 'gbs_to_entity')
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

/** GBS→법인 문의: 법인 답변만 저장—상태는 변경하지 않음 (상태는 GBS가 별도 처리) */
export async function updateVoeEntityResponse(
  id: string,
  response: string,
  respondedBy: string,
): Promise<void> {
  const { error } = await voeTable()
    .update({
      response,
      responded_by: respondedBy,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** GBS 문의(gbs_to_entity) 등: 상태만 변경 */
export async function updateVoeStatusOnly(id: string, status: VoeStatus): Promise<void> {
  const { error } = await voeTable()
    .update({
      status,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** GBS→법인 문의: 본문(content)에 추가 문의를 누적 저장 */
export async function updateVoeContent(
  id: string,
  content: string,
): Promise<void> {
  const { error } = await voeTable()
    .update({
      content,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id);
  if (error) throw new Error(error.message);
}
