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

/** localStorage 키 — 클라이언트 측 세션 만료 추적 */
const AUTH_EXPIRES_AT_KEY = 'gbs_auth_expires_at';
/** "Remember me" 체크 시 유지 기간 (30일) */
const REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
/** "Remember me" 미체크 시 유지 기간 (8시간 — 업무일) */
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

/** 로그인 직후 호출 — 만료 타임스탬프를 저장 */
function setAuthExpiry(remember: boolean): void {
  if (typeof window === 'undefined') return;
  const ms = remember ? REMEMBER_ME_DURATION_MS : SESSION_DURATION_MS;
  const expiresAt = Date.now() + ms;
  window.localStorage.setItem(AUTH_EXPIRES_AT_KEY, String(expiresAt));
}

/** 현재 클라이언트 측 세션이 만료되었는지 검사 */
export function isAuthExpired(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(AUTH_EXPIRES_AT_KEY);
  if (!raw) return true; // 기록이 없으면 만료된 것으로 간주
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return true;
  return Date.now() > ts;
}

/** 만료 타임스탬프 제거 */
function clearAuthExpiry(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
}

/**
 * 서버를 호출하지 않고 로컬 세션만 정리한다.
 * - refresh token이 이미 무효화된 상태(=서버 호출 시 401/403)에서 사용
 * - localStorage의 supabase 세션 키와 만료 타임스탬프를 모두 제거
 */
export function clearLocalSession(): void {
  clearAuthExpiry();
  if (typeof window === 'undefined') return;
  try {
    Object.keys(window.localStorage).forEach((k) => {
      if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
        window.localStorage.removeItem(k);
      }
    });
  } catch {
    // ignore
  }
}

/**
 * Supabase auth 에러가 "Invalid Refresh Token / Refresh Token Not Found" 류인지 판별.
 * 이 에러는 서버에 이미 무효화된 토큰으로 갱신 시도할 때 발생하므로
 * 정상적인 "로그인 필요" 상황으로 취급해야 한다.
 */
export function isRefreshTokenError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : '';
  return /refresh\s*token/i.test(msg) || /invalid.*token/i.test(msg);
}

export async function signInWithEmail(
  email: string,
  password: string,
  remember: boolean = false,
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  setAuthExpiry(remember);
  return data;
}

export async function signUp({ email, password, name, team }: SignUpData) {
  // 1) Supabase Auth 에 사용자 생성
  //    - options.data 로 name/team 을 user_metadata 에 함께 보냄
  //    - DB 트리거 (docs/user-profile-signup-fix.sql) 가 user_profiles 자동 생성
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        team: team || null,
      },
    },
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('사용자 생성 실패');

  // 2) Fallback: 트리거가 아직 적용되지 않은 환경을 위해 클라이언트에서도 한 번 시도
  //    - 트리거가 이미 행을 만들었으면 ON CONFLICT 처럼 무시하기 위해 upsert 사용
  //    - 인증 세션이 없으면 RLS 로 실패할 수 있으나, 이때는 트리거가 처리하므로 무시 가능
  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: authData.user.id,
        email,
        name,
        team: team || null,
      },
      { onConflict: 'id' },
    );

  if (profileError) {
    // RLS 401 등은 트리거가 처리할 가능성이 높으므로 조용히 경고만 남김 (가입 자체는 성공)
    console.warn('user_profiles 클라이언트 저장 실패 (트리거가 처리할 가능성 있음):', profileError.message);
  }

  return authData;
}

export async function signOut() {
  // 1) 클라이언트 측 만료 타임스탬프 즉시 제거 — 서버 호출 결과와 무관하게 무조건 정리
  clearAuthExpiry();

  // 2) 서버 측 signOut — 토큰이 이미 만료/무효화된 경우 403 이 떨어질 수 있음.
  //    이미 무효화된 세션은 더 이상 무효화할 게 없는 정상 상황이므로 에러를 throw 하지 않는다.
  //    (토스트 '로그아웃 실패' 가 뜨는 것을 방지)
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn('Supabase signOut server-side warning (ignored):', error.message);
    }
  } catch (e) {
    console.warn('Supabase signOut exception (ignored):', e);
  }

  // 3) 안전망: 로컬 스토리지의 supabase 세션 키도 강제로 정리 (희박한 경우 잔존 방지)
  if (typeof window !== 'undefined') {
    try {
      Object.keys(window.localStorage).forEach((k) => {
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
          window.localStorage.removeItem(k);
        }
      });
    } catch {
      // ignore
    }
  }
}

/**
 * 비밀번호 재설정 메일 발송.
 * `redirectTo` 는 사용자가 메일 링크 클릭 시 이동할 페이지.
 * Supabase 프로젝트 → Authentication → URL Configuration 의 Redirect URLs 에
 * 같은 origin 의 `/reset-password/confirm` 이 등록돼 있어야 한다.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password/confirm`,
  });
  if (error) throw error;
}

/**
 * 새 비밀번호 적용. 호출 시점에 recovery 세션이 활성화돼 있어야 한다
 * (메일 링크를 통해 들어와서 PKCE code 교환이 끝난 상태).
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
