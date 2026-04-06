import type { User } from '@supabase/supabase-js';

/**
 * Supabase Auth 사용자로부터 UI 표시용 이름을 만듭니다.
 * user_profiles가 없거나 조회되지 않을 때 폴백으로 사용합니다.
 */
export function displayNameFromAuthUser(user: User | null | undefined): string | null {
  if (!user) return null;
  const m = user.user_metadata as Record<string, unknown> | undefined;
  const full = m?.full_name;
  const name = m?.name;
  if (typeof full === 'string' && full.trim()) return full.trim();
  if (typeof name === 'string' && name.trim()) return name.trim();
  if (user.email) {
    const local = user.email.split('@')[0];
    return (local && local.trim()) || user.email;
  }
  return null;
}
