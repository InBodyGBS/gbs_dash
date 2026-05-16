'use client';

/**
 * 로그인 페이지
 * - 이메일·비밀번호 로그인 (Supabase Auth)
 * - 신규 사용자는 회원가입 → 가입 후 GBS 관리자의 승인이 있어야 권한 부여됨
 * - 이미 로그인한 사용자는 자동으로 redirect 대상으로 이동
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Loader2,
  Calendar,
  Upload,
  BookOpen,
  MessageSquare,
  Eye,
  AlertTriangle,
  MessagesSquare,
  ShieldCheck,
  User,
  Users,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { supabase } from '@/lib/supabase/client';
import { signInWithEmail, signUp } from '@/lib/auth';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { useT } from '@/lib/contexts/LanguageContext';

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

/**
 * Supabase Auth 에러를 사용자 친화 메시지(한국어 + 원인 설명)로 변환.
 * 공식 에러 코드/메시지 참고: https://supabase.com/docs/reference/javascript/auth-api
 */
function describeAuthError(e: unknown): { title: string; detail: string } {
  const raw = getErrorMessage(e).toLowerCase();
  // 1) 잘못된 자격증명 — 가장 흔한 케이스
  if (raw.includes('invalid login credentials') || raw.includes('invalid_credentials')) {
    return {
      title: '이메일 또는 비밀번호가 올바르지 않습니다.',
      detail:
        '가능한 원인:\n' +
        '  • 비밀번호가 틀렸음 (대소문자/공백 확인)\n' +
        '  • 이 이메일로 가입한 적이 없음 → "회원가입" 탭에서 가입 필요\n' +
        '  • 비밀번호를 잊었다면 아래 "비밀번호를 잊으셨나요?" 클릭',
    };
  }
  // 2) 이메일 인증 미완료
  if (raw.includes('email not confirmed') || raw.includes('email_not_confirmed')) {
    return {
      title: '이메일 인증이 완료되지 않았습니다.',
      detail: '가입 시 보낸 메일의 인증 링크를 클릭한 뒤 다시 로그인해 주세요.',
    };
  }
  // 3) 사용자 없음
  if (raw.includes('user not found')) {
    return {
      title: '등록되지 않은 이메일입니다.',
      detail: '"회원가입" 탭에서 먼저 계정을 만들어 주세요.',
    };
  }
  // 4) 횟수 초과 (rate limit)
  if (raw.includes('rate') && raw.includes('limit')) {
    return {
      title: '잠시 후 다시 시도해 주세요.',
      detail: '짧은 시간에 로그인 시도가 많아 일시적으로 차단되었습니다 (보통 60초 내 해제).',
    };
  }
  // 5) 네트워크/서버 오류
  if (raw.includes('failed to fetch') || raw.includes('network')) {
    return {
      title: '서버에 연결할 수 없습니다.',
      detail: '인터넷 연결 또는 Supabase 서버 상태를 확인해 주세요.',
    };
  }
  // 폴백: 원본 메시지 노출
  return {
    title: '로그인 실패',
    detail: getErrorMessage(e),
  };
}

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 px-6 py-12">
      <div className="w-full max-w-xl">
        {/* 우측 상단 — KR/EN 토글 */}
        <div className="flex justify-end mb-6">
          <LanguageToggle />
        </div>

        {/* 로고/타이틀 + 정보 버튼 */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-4 mb-3">
            <Building2 className="h-12 w-12" style={{ color: '#971B2F' }} />
            <span className="text-4xl font-bold text-gray-900 tracking-tight">
              <BrandName />
            </span>
            <AboutInfoButton />
          </div>
          <p className="text-base text-gray-500">
            <BrandTagline />
          </p>
        </div>

        {/* 로그인/회원가입 카드 — 가운데 정렬 */}
        <Card className="shadow-md">
          <CardHeader className="pb-4 pt-6 px-8">
            <CardTitle className="text-xl">계정으로 계속하기 / Continue</CardTitle>
            <CardDescription className="text-sm mt-1.5">
              회사 이메일을 사용해 주세요. 신규 가입 후 GBS 관리자의 승인이 있어야 정상 사용이 가능합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="grid grid-cols-2 w-full h-11">
                <TabsTrigger value="signin" className="text-sm">로그인</TabsTrigger>
                <TabsTrigger value="signup" className="text-sm">회원가입</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-6">
                <SignInForm onSuccess={() => router.replace(redirect)} />
              </TabsContent>
              <TabsContent value="signup" className="mt-6">
                <SignUpForm onSuccess={() => setTab('signin')} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-400 mt-8">
          © 2026 InBody Co., Ltd.
        </p>
      </div>
    </div>
  );
}

/**
 * 브랜드명 옆에 표시되는 작은 정보 버튼 — 클릭 시 "이 대시보드란?" 다이얼로그를 띄운다.
 */
function AboutInfoButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1.5 transition-colors"
        title={t('about.title')}
        aria-label={t('about.title')}
      >
        <Info className="h-6 w-6" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">{t('about.title')}</DialogTitle>
          </DialogHeader>
          <AboutContent />
        </DialogContent>
      </Dialog>
    </>
  );
}

function BrandName() {
  const t = useT();
  return <>{t('brand.name')}</>;
}

function BrandTagline() {
  const t = useT();
  return <>{t('brand.tagline')}</>;
}

// -----------------------------------------------------------------------------

/**
 * 다이얼로그 안에 들어가는 "이 대시보드란?" 컨텐츠.
 * - 법인 담당자 / GBS 팀 두 관점으로 구성
 * - 색감 톤: 슬레이트 베이스 + 섹션별 단일 액센트 (User=slate, Admin=brand red)
 */
function AboutContent() {
  const t = useT();

  const userBullets = [
    { Icon: Calendar,       titleKey: 'about.user.1.title',  descKey: 'about.user.1.desc'  },
    { Icon: Upload,         titleKey: 'about.user.2.title',  descKey: 'about.user.2.desc'  },
    { Icon: BookOpen,       titleKey: 'about.user.3.title',  descKey: 'about.user.3.desc'  },
    { Icon: MessageSquare,  titleKey: 'about.user.4.title',  descKey: 'about.user.4.desc'  },
  ];

  const adminBullets = [
    { Icon: Eye,            titleKey: 'about.admin.1.title', descKey: 'about.admin.1.desc' },
    { Icon: AlertTriangle,  titleKey: 'about.admin.2.title', descKey: 'about.admin.2.desc' },
    { Icon: MessagesSquare, titleKey: 'about.admin.3.title', descKey: 'about.admin.3.desc' },
    { Icon: ShieldCheck,    titleKey: 'about.admin.4.title', descKey: 'about.admin.4.desc' },
  ];

  const renderBullets = (
    items: typeof userBullets,
    accent: { iconBg: string; iconColor: string },
  ) => (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
      {items.map((p, i) => (
        <li key={i} className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: accent.iconBg, color: accent.iconColor }}
          >
            <p.Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 leading-tight">
              {t(p.titleKey)}
            </p>
            <p className="text-xs text-slate-500 mt-1 leading-snug">
              {t(p.descKey)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      {/* 한 줄 요약 */}
      <p className="text-sm text-slate-600 leading-relaxed mb-5">
        {t('about.summary')}
      </p>

      {/* 법인 담당자 관점 — 슬레이트 톤 */}
      <section className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 text-slate-700">
            <User className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {t('about.user.heading')}
          </p>
        </div>
        {renderBullets(userBullets, {
          iconBg: '#F1F5F9',
          iconColor: '#475569',
        })}
      </section>

      <div className="border-t border-slate-100 my-4" />

      {/* GBS 팀 관점 — 브랜드 InBody Red 액센트 */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#FBE8EC', color: '#971B2F' }}
          >
            <Users className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#7A1626' }}>
            {t('about.admin.heading')}
          </p>
        </div>
        {renderBullets(adminBullets, {
          iconBg: '#FBE8EC',
          iconColor: '#971B2F',
        })}
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ title: string; detail: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    if (!email || !password) {
      const info = { title: '입력값 누락', detail: '이메일과 비밀번호를 모두 입력해 주세요.' };
      setErrorInfo(info);
      toast.error(info.title);
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password, remember);
      toast.success('로그인되었습니다.');
      onSuccess();
    } catch (error: unknown) {
      const info = describeAuthError(error);
      setErrorInfo(info);
      toast.error(info.title, { description: info.detail.split('\n')[0] });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email" className="text-sm">이메일</Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          placeholder="name@inbody.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          required
          className="h-11 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password" className="text-sm">비밀번호</Label>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          required
          className="h-11 text-sm"
        />
      </div>

      {/* 인라인 에러 박스: 사라지지 않고 화면에 계속 표시 */}
      {errorInfo && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <p className="font-semibold mb-1">{errorInfo.title}</p>
          <pre className="whitespace-pre-wrap font-sans text-xs text-red-700 leading-snug">
            {errorInfo.detail}
          </pre>
        </div>
      )}

      {/* 로그인 정보 저장 (Remember me) */}
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          disabled={submitting}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
        <span>로그인 정보 저장 (30일간 유지)</span>
      </label>

      <Button type="submit" className="w-full h-11 text-sm" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        로그인
      </Button>
      <div className="text-center pt-1">
        <Link
          href="/reset-password"
          className="text-sm text-gray-600 hover:text-blue-700 hover:underline"
        >
          비밀번호를 잊으셨나요?
        </Link>
      </div>
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-email" className="text-sm">이메일 (아이디)</Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          placeholder="name@inbody.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          required
          className="h-11 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password" className="text-sm">비밀번호 (6자 이상)</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          required
          minLength={6}
          className="h-11 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-name" className="text-sm">이름</Label>
        <Input
          id="signup-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          required
          className="h-11 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-team" className="text-sm">팀/법인 (선택)</Label>
        <Input
          id="signup-team"
          type="text"
          placeholder="예: InBody Japan, GBS"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          disabled={submitting}
          className="h-11 text-sm"
        />
      </div>
      <Button type="submit" className="w-full h-11 text-sm" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        가입하기
      </Button>
    </form>
  );
}
