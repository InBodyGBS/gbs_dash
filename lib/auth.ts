/**
 * 인증 관련 함수
 */

import { supabase } from './supabase/client';

export interface SignUpData {
  email: string;
  password: string;
  name: string;
  team?: string;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data;
}

export async function signUp({ email, password, name, team }: SignUpData) {
  // 1. Supabase Auth에 사용자 생성
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('사용자 생성 실패');

  // 2. user_profiles 테이블에 프로필 정보 저장
  const { error: profileError } = await supabase
    .from('user_profiles')
    .insert({
      id: authData.user.id,
      email,
      name,
      team: team || null,
    });

  if (profileError) {
    // 프로필 저장 실패 시 사용자 삭제 (선택사항)
    console.error('프로필 저장 실패:', profileError);
    throw new Error(`프로필 저장 실패: ${profileError.message}`);
  }

  return authData;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
