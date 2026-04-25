'use client';

/**
 * 비밀번호 재설정 — 새 비밀번호 입력 단계
 *
 * 사용자는 메일의 매직 링크를 클릭해 이 페이지에 도착한다.
 * Supabase 의 detectSessionInUrl(default true) 가 자동으로 URL 의 토큰/code 를
 * 파싱해 recovery 세션을 만들어 준다. 우리는 onAuthStateChange('PASSWORD_RECOVERY')
 * 또는 현재 세션 존재 여부로 입력 가능 상태를 판단한다.
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Loader2, KeyRound, AlertCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { updatePassword } from '@/lib/auth';

const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return '알 수 없는 오류';
};

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      }
    >
      <ConfirmInner />
    </Suspense>
  );
}

function ConfirmInner() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // recovery 세션 감지
  useEffect(() => {
    let cancelled = false;

    // 1) 페이지 진입 시 이미 세션이 들어와 있는지 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        setHasSession(true);
        setReady(true);
      }
    });

    // 2) PASSWORD_RECOVERY 이벤트가 늦게 도착하는 케이스
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setHasSession(true);
        setReady(true);
      }
    });

    // 3) 1.5초 안에 아무 신호가 없으면 안내 화면으로
    const timeout = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 1500);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (password !== confirm) {
      toast.error('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setSubmitting(true);
    try {
      await updatePassword(password);
      toast.success('비밀번호가 변경되었습니다. 다시 로그인해 주세요.');
      // 보안상 세션 종료 후 로그인 화면으로
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (error: unknown) {
      toast.error('비밀번호 변경 실패', { description: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-9 w-9" style={{ color: '#971B2F' }} />
            <span className="text-2xl font-bold text-gray-900">InBody GBS</span>
          </div>
          <p className="text-sm text-gray-600">새 비밀번호 설정</p>
        </div>

        <Card>
          {!ready ? (
            <CardContent className="py-10 text-center text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
              인증 정보를 확인하는 중…
            </CardContent>
          ) : !hasSession ? (
            <CardContent className="py-8 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">유효한 재설정 링크가 아닙니다</p>
                <p className="text-sm text-gray-600 mt-1">
                  링크가 만료되었거나 이미 사용되었습니다. 재설정 메일을 다시 받아 주세요.
                </p>
              </div>
              <Link
                href="/reset-password"
                className="inline-flex items-center text-sm text-blue-600 hover:underline"
              >
                재설정 메일 다시 받기
              </Link>
            </CardContent>
          ) : (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-gray-700" />
                  새 비밀번호 입력
                </CardTitle>
                <CardDescription className="text-xs">
                  6자 이상의 새 비밀번호를 입력해 주세요. 변경 후 다시 로그인해야 합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-xs">새 비밀번호</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-xs">새 비밀번호 확인</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      disabled={submitting}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    비밀번호 변경
                  </Button>
                  <Link
                    href="/login"
                    className="flex items-center justify-center text-xs text-gray-600 hover:text-gray-900 mt-2"
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" /> 로그인 화면으로
                  </Link>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
