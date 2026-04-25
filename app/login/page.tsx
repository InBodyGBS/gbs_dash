'use client';

/**
 * 로그인 페이지
 * - 이메일·비밀번호 로그인 (Supabase Auth)
 * - 신규 사용자는 회원가입 → 가입 후 GBS 관리자의 승인이 있어야 권한 부여됨
 * - 이미 로그인한 사용자는 자동으로 redirect 대상으로 이동
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { supabase } from '@/lib/supabase/client';
import { signInWithEmail, signUp } from '@/lib/auth';

function getSafeRedirect(redirect: string | null): string {
  if (!redirect) return '/';
  if (redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  return '/';
}

const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return '알 수 없는 오류';
};

export default function LoginPage() {
  // useSearchParams 사용 컴포넌트는 Suspense 안에 있어야 함 (Next.js 15)
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = getSafeRedirect(searchParams.get('redirect'));

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [checking, setChecking] = useState(true);

  // 이미 로그인 중이면 redirect
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        router.replace(redirect);
        return;
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, redirect]);

  if (checking) return <LoadingScreen />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="h-9 w-9" style={{ color: '#971B2F' }} />
            <span className="text-2xl font-bold text-gray-900">InBody GBS</span>
          </div>
          <p className="text-sm text-gray-600">Global Business Support Dashboard</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">계정으로 계속하기</CardTitle>
            <CardDescription className="text-xs">
              회사 이메일을 사용해 주세요. 신규 가입 후 GBS 관리자의 승인이 있어야 정상 사용이 가능합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">로그인</TabsTrigger>
                <TabsTrigger value="signup">회원가입</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-4">
                <SignInForm onSuccess={() => router.replace(redirect)} />
              </TabsContent>
              <TabsContent value="signup" className="mt-4">
                <SignUpForm onSuccess={() => setTab('signin')} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-4">
          © 2026 InBody Co., Ltd.
        </p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('이메일과 비밀번호를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
      toast.success('로그인되었습니다.');
      onSuccess();
    } catch (error: unknown) {
      toast.error('로그인 실패', { description: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="signin-email" className="text-xs">이메일</Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          placeholder="name@inbody.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password" className="text-xs">비밀번호</Label>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        로그인
      </Button>
    </form>
  );
}

function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast.error('이메일·비밀번호·이름은 필수입니다.');
      return;
    }
    if (password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setSubmitting(true);
    try {
      await signUp({
        email: email.trim(),
        password,
        name: name.trim(),
        team: team.trim() || undefined,
      });
      toast.success('가입 완료', {
        description: 'GBS 관리자가 권한을 부여하면 사용 가능합니다.',
      });
      onSuccess();
    } catch (error: unknown) {
      toast.error('가입 실패', { description: getErrorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="signup-email" className="text-xs">이메일 (아이디)</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="name@inbody.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password" className="text-xs">비밀번호 (6자 이상)</Label>
        <Input
          id="signup-password"
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
        <Label htmlFor="signup-name" className="text-xs">이름</Label>
        <Input
          id="signup-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-team" className="text-xs">팀/법인 (선택)</Label>
        <Input
          id="signup-team"
          type="text"
          placeholder="예: InBody Japan, GBS"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          disabled={submitting}
        />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        가입하기
      </Button>
    </form>
  );
}
