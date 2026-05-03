import { supabase } from '@/lib/supabase/client';

/**
 * 관리자 여부 — 다음 중 하나라도 true 면 admin:
 *   1) NEXT_PUBLIC_ADMIN_EMAILS (쉼표 구분, 환경변수)
 *   2) user_roles.role = 'gbs_admin'  (신 권한 시스템)
 *   3) user_profiles.is_admin = true  (구 시스템 — 호환 유지)
 *
 * 어떤 채널에서 admin 으로 등록됐든 동일하게 동작하도록 OR 처리.
 */
export async function getIsAdminUser(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // 1) 환경변수 화이트리스트
  if (user.email) {
    const envList = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (envList.includes(user.email.toLowerCase())) return true;
  }

  // 2) user_roles.role = 'gbs_admin'
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'gbs_admin')
    .limit(1)
    .maybeSingle();
  if (roleRow) return true;

  // 3) user_profiles.is_admin = true (레거시 호환)
  const { data: profileRow } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (profileRow && (profileRow as { is_admin?: boolean }).is_admin) return true;

  return false;
}
