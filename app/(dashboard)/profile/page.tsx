'use client';

/**
 * 내 계정 설정 페이지
 * - 이메일 (읽기 전용)
 * - 이름 / 팀 (수정 가능 → user_profiles)
 * - 권한(role) 및 담당 법인 (읽기 전용 → user_roles + subsidiaries)
 *
 * 변경 사항은 본인의 user_profiles 행만 수정한다 (RLS: USING (auth.uid() = id)).
 * 권한·담당 법인 변경은 GBS 관리자(/gbs/users)에게 요청해야 한다.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Save,
  ShieldCheck,
  User as UserIcon,
  Mail,
  Users as UsersIcon,
  Building2,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

import { supabase } from '@/lib/supabase/client';
import { signOut } from '@/lib/auth';
import { getCurrentUserRoleInfo, type CurrentUserRoleInfo } from '@/lib/services/userRoleService';

interface ProfileForm {
  name: string;
  team: string;
}

interface SubsidiaryLite {
  id: string;
  code: string;
  name: string;
}

const ROLE_DISPLAY: Record<string, { label: string; description: string; bg: string; text: string }> = {
  gbs_admin: {
    label: 'GBS Admin',
    description: '본사 관리자 — 전체 법인 조회 + 권한 관리 가능',
    bg: '#FEF3C7',
    text: '#B45309',
  },
  entity_user: {
    label: 'Entity User',
    description: '법인 사용자 — 본인 담당 법인만 조회 가능',
    bg: '#EFF6FF',
    text: '#1D4ED8',
  },
  // 레거시 표시
  gbs_user: { label: 'GBS User (legacy)', description: '구 권한 — gbs_admin 동급으로 처리됨', bg: '#F3F4F6', text: '#6B7280' },
  executive: { label: 'Executive (legacy)', description: '구 권한 — gbs_admin 동급으로 처리됨', bg: '#F3F4F6', text: '#6B7280' },
};

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [email, setEmail] = useState<string>('');
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>({ name: '', team: '' });
  const [originalForm, setOriginalForm] = useState<ProfileForm>({ name: '', team: '' });

  const [roleInfo, setRoleInfo] = useState<CurrentUserRoleInfo | null>(null);
  const [entitySubs, setEntitySubs] = useState<SubsidiaryLite[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('로그인이 필요합니다.');
        router.replace('/login?redirect=/profile');
        return;
      }
      setEmail(user.email ?? '');

      // 프로필
      const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('name, team, created_at')
        .eq('id', user.id)
        .maybeSingle();
      if (profileErr) {
        console.warn('user_profiles 조회 실패:', profileErr.message);
      }
      const p = profile as { name?: string; team?: string | null; created_at?: string } | null;
      const initial = {
        name: p?.name ?? user.email?.split('@')[0] ?? '',
        team: p?.team ?? '',
      };
      setForm(initial);
      setOriginalForm(initial);
      setCreatedAt(p?.created_at ?? null);

      // 권한 정보
      const role = await getCurrentUserRoleInfo();
      setRoleInfo(role);

      // entity_user 인 경우 담당 법인 상세 조회
      if (role.entityCodes.length > 0) {
        const { data: subs } = await supabase
          .from('subsidiaries')
          .select('id, code, name')
          .in('code', role.entityCodes);
        setEntitySubs(((subs ?? []) as SubsidiaryLite[]) || []);
      } else {
        setEntitySubs([]);
      }
    } catch (e) {
      console.error(e);
      toast.error('프로필 로드 실패');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = form.name !== originalForm.name || form.team !== originalForm.team;

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('이름은 필수입니다.');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증 정보를 찾을 수 없습니다.');

      const payload = {
        id: user.id,
        email: user.email ?? '',
        name: form.name.trim(),
        team: form.team.trim() || null,
      };

      // upsert: 행이 없으면 새로 생성, 있으면 갱신
      const { error } = await supabase
        .from('user_profiles')
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;

      setOriginalForm({ name: form.name.trim(), team: form.team.trim() });
      toast.success('프로필이 저장되었습니다.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      toast.error('저장 실패', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = () => {
    router.push('/reset-password');
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      toast.success('로그아웃되었습니다.');
      router.push('/login');
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      toast.error('로그아웃 실패', { description: msg });
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        프로필 로드 중...
      </div>
    );
  }

  const roleKey = roleInfo?.role ?? null;
  const roleDisplay = roleKey ? ROLE_DISPLAY[roleKey] : null;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        {/* 헤더 */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">내 계정 설정</h1>
          <p className="text-sm text-gray-500 mt-1">
            기본 정보·권한·담당 법인을 확인하고 이름·팀을 수정할 수 있습니다.
          </p>
        </div>

        {/* 기본 정보 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-gray-500" />
              기본 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-email" className="text-xs flex items-center gap-1.5">
                <Mail className="h-3 w-3 text-gray-400" />
                이메일
              </Label>
              <Input id="profile-email" value={email} disabled className="bg-gray-50" />
              <p className="text-[11px] text-gray-400">이메일은 변경할 수 없습니다.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-xs">사용자 이름</Label>
              <Input
                id="profile-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="홍길동"
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="profile-team" className="text-xs flex items-center gap-1.5">
                <UsersIcon className="h-3 w-3 text-gray-400" />
                팀 / 소속
              </Label>
              <Input
                id="profile-team"
                value={form.team}
                onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))}
                placeholder="예: GBS, InBody Japan"
                disabled={saving}
              />
              <p className="text-[11px] text-gray-400">
                자유 입력 항목입니다. 권한과는 무관합니다.
              </p>
            </div>

            {createdAt && (
              <p className="text-[11px] text-gray-400">
                계정 생성: {new Date(createdAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}
              </p>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="gap-1.5"
                style={{ backgroundColor: '#971B2F' }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? '저장 중...' : '변경사항 저장'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 권한 정보 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gray-500" />
              권한
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 min-w-[80px]">현재 권한</span>
              {roleDisplay ? (
                <Badge
                  className="font-semibold"
                  style={{ backgroundColor: roleDisplay.bg, color: roleDisplay.text }}
                >
                  {roleDisplay.label}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-gray-500">
                  권한 미부여
                </Badge>
              )}
            </div>

            <div className="text-xs text-gray-600 leading-relaxed pl-[92px] -mt-1">
              {roleDisplay ? (
                roleDisplay.description
              ) : (
                <span className="text-amber-700">
                  GBS 관리자에게 권한 부여를 요청해 주세요. 현재는 임시로 전체 조회가 허용되어 있습니다.
                </span>
              )}
            </div>

            <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-[11px] text-gray-500 leading-relaxed">
              권한·담당 법인 변경은 본인이 직접 수정할 수 없습니다. 변경이 필요하면 GBS 관리자에게 요청해 주세요.
            </div>
          </CardContent>
        </Card>

        {/* 담당 법인 (entity_user 만 노출) */}
        {roleInfo && !roleInfo.canSeeAll && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-gray-500" />
                담당 법인
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entitySubs.length === 0 && roleInfo.entityCodes.length === 0 ? (
                <p className="text-sm text-amber-700">
                  Entity User 권한이지만 연결된 법인이 없습니다. GBS 관리자에게 법인 매핑을 요청해 주세요.
                </p>
              ) : entitySubs.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">권한 코드:</p>
                  <div className="flex flex-wrap gap-2">
                    {roleInfo.entityCodes.map((code) => (
                      <Badge key={code} variant="outline" className="font-mono">
                        {code}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[11px] text-amber-700 mt-2">
                    ※ 일부 코드가 subsidiaries 테이블과 매칭되지 않습니다.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {entitySubs.map((s) => (
                    <div key={s.id} className="py-2.5 flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-gray-900">{s.name}</span>
                        <span className="ml-2 text-xs text-gray-400 font-mono">{s.code}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 보안 / 세션 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-gray-500" />
              보안 · 세션
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">비밀번호 변경</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  이메일로 비밀번호 재설정 링크를 보내드립니다.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handlePasswordReset}>
                비밀번호 재설정
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">로그아웃</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  현재 세션을 종료합니다.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                disabled={signingOut}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
              >
                {signingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                로그아웃
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
