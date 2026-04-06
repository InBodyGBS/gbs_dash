import { supabase } from '@/lib/supabase/client';

/**
 * 관리자 여부: NEXT_PUBLIC_ADMIN_EMAILS(쉼표 구분) 또는 user_profiles.is_admin
 */
export async function getIsAdminUser(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return false;

  const envList = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (envList.includes(user.email.toLowerCase())) return true;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !data) return false;
  return Boolean((data as { is_admin?: boolean }).is_admin);
}
