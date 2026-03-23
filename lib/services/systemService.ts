import { supabase } from '@/lib/supabase/client';
import type { System, SystemFormData } from '@/lib/types/system';

/**
 * 시스템 현황 조회 (법인별, 카테고리별)
 */
export async function getSystems(entityId?: string): Promise<System[]> {
  let query = supabase.from('systems').select('*').order('created_at', { ascending: false });

  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as unknown as System[];
}

/**
 * 특정 법인과 카테고리의 시스템 조회
 */
export async function getSystemByEntityAndCategory(
  entityId: string,
  category: SystemFormData['category']
): Promise<System | null> {
  const { data, error } = await supabase
    .from('systems')
    .select('*')
    .eq('entity_id', entityId)
    .eq('category', category)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    throw error;
  }

  return data as unknown as System;
}

/**
 * 시스템 생성 또는 업데이트 (upsert)
 */
export async function upsertSystem(systemData: SystemFormData): Promise<System> {
  const { data, error } = await supabase
    .from('systems')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(
      {
        entity_id: systemData.entity_id,
        category: systemData.category,
        system_name: systemData.system_name || null,
        version: systemData.version || null,
        vendor: systemData.vendor || null,
        implementation_date: systemData.implementation_date || null,
        notes: systemData.notes || null,
        created_by: systemData.created_by,
      } as any,
      {
        onConflict: 'entity_id,category',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data as unknown as System;
}

/**
 * 시스템 삭제
 */
export async function deleteSystem(id: string): Promise<void> {
  const { error } = await supabase.from('systems').delete().eq('id', id);

  if (error) throw error;
}

/**
 * 시스템명만 업데이트 (인라인 편집용)
 */
export async function updateSystemName(
  entityId: string,
  category: SystemFormData['category'],
  systemName: string | null
): Promise<System> {
  // 먼저 존재하는지 확인
  const existing = await getSystemByEntityAndCategory(entityId, category);

  if (existing) {
    // 업데이트
    const { data, error } = await supabase
      .from('systems')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ system_name: systemName ?? null } as any)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as System;
  } else {
    // 생성 - get authenticated user for created_by
    const { data: { user } } = await supabase.auth.getUser();
    const createdBy = user?.email || user?.id || 'unknown';
    return upsertSystem({
      entity_id: entityId,
      category,
      system_name: systemName ?? undefined,
      created_by: createdBy,
    });
  }
}
