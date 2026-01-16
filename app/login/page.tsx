'use client';

/**
 * 로그인 페이지
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmail, signUp } from '@/lib/auth';
import { supabase } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // 이미 로그인한 경우 대시보드로 리다이렉트
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const redirect = searchParams.get('redirect') || '/';
        router.push(redirect);
      }
    };

    checkAuth();
  }, [router, searchParams]);

  // 로그인 폼
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // 회원가입 폼
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupTeam, setSignupTeam] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('입력 오류', {
        description: '이메일과 비밀번호를 입력해주세요.',
      });
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(loginEmail, loginPassword);
      toast.success('로그인 성공!');
      const redirect = searchParams.get('redirect') || '/';
      router.push(redirect);
      router.refresh();
    } catch (error: any) {
      toast.error('로그인 실패', {
        description: error.message || '이메일 또는 비밀번호가 올바르지 않습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword || !signupName) {
      toast.error('입력 오류', {
        description: '이메일, 비밀번호, 이름을 입력해주세요.',
      });
      return;
    }

    setLoading(true);
    try {
      await signUp({
        email: signupEmail,
        password: signupPassword,
        name: signupName,
        team: signupTeam || undefined,
      });
      toast.success('회원가입 성공!', {
        description: '로그인 페이지로 이동합니다.',
      });
      // 회원가입 성공 후 로그인 탭으로 전환
      setIsLogin(true);
      setSignupEmail('');
      setSignupPassword('');
      setSignupName('');
      setSignupTeam('');
    } catch (error: any) {
      toast.error('회원가입 실패', {
        description: error.message || '회원가입 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">InBody</h1>
            <p className="text-gray-600">GBS Dashboard</p>
          </div>

          <Tabs value={isLogin ? 'login' : 'signup'} onValueChange={(value) => setIsLogin(value === 'login')}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">로그인</TabsTrigger>
              <TabsTrigger value="signup">회원가입</TabsTrigger>
            </TabsList>

            {/* 로그인 탭 */}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">이메일</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="mt-1"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">비밀번호</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="mt-1"
                    disabled={loading}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '로그인 중...' : '로그인'}
                </Button>
              </form>
            </TabsContent>

            {/* 회원가입 탭 */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="signup-email">이메일</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="mt-1"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signup-password">비밀번호</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="mt-1"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signup-name">이름</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="mt-1"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signup-team">팀 (선택사항)</Label>
                  <Input
                    id="signup-team"
                    type="text"
                    value={signupTeam}
                    onChange={(e) => setSignupTeam(e.target.value)}
                    placeholder="소속 팀을 입력하세요"
                    className="mt-1"
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '회원가입 중...' : '회원가입'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
