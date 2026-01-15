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
  return data || [];
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

  return data;
}

/**
 * 시스템 생성 또는 업데이트 (upsert)
 */
export async function upsertSystem(systemData: SystemFormData): Promise<System> {
  const { data, error } = await supabase
    .from('systems')
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
      },
      {
        onConflict: 'entity_id,category',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
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
      .update({ system_name: systemName || null })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // 생성
    return upsertSystem({
      entity_id: entityId,
      category,
      system_name: systemName || null,
      created_by: '조승현', // TODO: 실제 사용자 인증 연동
    });
  }
}

