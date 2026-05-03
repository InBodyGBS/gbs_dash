'use client';

/**
 * GBS 관리자 — 사용자/역할 관리 페이지
 *
 * 탭 구성:
 * - Pending  : 가입했으나 역할 미부여 (승인 대상)
 * - Active   : 역할이 부여된 사용자 (변경/회수)
 * - Audit    : 역할 변경 감사 로그
 *
 * 권한: gbs_admin 이 아니면 진입 불가 (배너 안내).
 */

import { Fragment, useEffect, useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Loader2, Search, ShieldAlert, ShieldCheck, UserCheck, UserX, History, RefreshCw, Lock, KeyRound, Save } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

import { supabase } from '@/lib/supabase/client';
import { getCurrentUserRoleInfo } from '@/lib/services/userRoleService';
import {
  listAdminUsers,
  upsertUserRole,
  removeUserRoles,
  listAuditLog,
  type AdminUserRow,
  type AdminUserRole,
  type AuditLogEntry,
} from '@/lib/services/userManagementService';
import {
  getAllRolePagePermissions,
  setRolePagePermissions,
  type ManagedRole,
} from '@/lib/services/rolePagePermissionService';
import { getPagesByGroup } from '@/lib/constants/pages';
import type { Subsidiary } from '@/lib/supabase/types';

// 2-tier 권한: 신규 부여 가능한 role 만 옵션으로 노출
const ROLE_OPTIONS: Array<{ value: 'entity_user' | 'gbs_admin'; label: string; hint: string }> = [
  { value: 'entity_user', label: 'Entity User', hint: '법인 사용자 (entity_code 필수)' },
  { value: 'gbs_admin', label: 'GBS Admin', hint: '본사 관리자 — 전체 법인 조회 + 권한 관리' },
];

// 표시용 배지 — 레거시 gbs_user/executive 도 화면에서 깨지지 않도록 유지 (회색 처리)
const ROLE_BADGE: Record<AdminUserRole['role'], { bg: string; text: string }> = {
  entity_user: { bg: '#EFF6FF', text: '#1D4ED8' },
  gbs_admin: { bg: '#FEF3C7', text: '#B45309' },
  gbs_user: { bg: '#F3F4F6', text: '#6B7280' },
  executive: { bg: '#F3F4F6', text: '#6B7280' },
};

const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return '알 수 없는 오류';
};

export default function UsersAdminPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<AdminUserRow | null>(null);
  const [tab, setTab] = useState<'pending' | 'active' | 'audit' | 'permissions'>('pending');

  // 권한 확인
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const info = await getCurrentUserRoleInfo();
      if (cancelled) return;
      setIsAdmin(info.role === 'gbs_admin');
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersList, subsRes, audit] = await Promise.all([
        listAdminUsers(),
        supabase.from('subsidiaries').select('*').order('name'),
        listAuditLog(200),
      ]);
      setUsers(usersList);
      if (subsRes.error) {
        toast.error('법인 목록 로드 실패', { description: subsRes.error.message });
      } else {
        setSubsidiaries((subsRes.data || []) as Subsidiary[]);
      }
      setAuditEntries(audit);
    } catch (e) {
      toast.error('로드 실패', { description: getErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadAll();
  }, [isAdmin, loadAll]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = users.filter((u) => (tab === 'pending' ? u.status === 'pending' : u.status === 'active'));
    if (!q) return base;
    return base.filter((u) =>
      [u.email, u.name ?? '', u.team ?? '', ...u.roles.map((r) => r.entity_code ?? '')]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [users, search, tab]);

  const codeToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subsidiaries) m.set(s.code, s.name);
    return m;
  }, [subsidiaries]);

  if (!authChecked) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> 권한 확인 중…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-5 w-5" /> 접근 권한 없음
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600">
            이 페이지는 <strong>GBS Admin</strong> 권한이 있는 사용자만 사용할 수 있습니다.
            권한이 필요하시면 GBS 팀에 문의해 주세요.
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingCount = users.filter((u) => u.status === 'pending').length;
  const activeCount = users.filter((u) => u.status === 'active').length;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-amber-700" />
              사용자 권한 관리
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              회원가입한 사용자에게 역할(role)과 법인(entity_code)을 부여합니다. 모든 변경은 감사 로그에 자동 기록됩니다.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            새로고침
          </Button>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="pending">
                Pending {pendingCount > 0 && <Badge className="ml-2 bg-amber-100 text-amber-800 border-amber-200">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="active">
                Active <span className="ml-2 text-xs text-gray-500">({activeCount})</span>
              </TabsTrigger>
              <TabsTrigger value="permissions">
                <KeyRound className="h-4 w-4 mr-1" /> Page Access
              </TabsTrigger>
              <TabsTrigger value="audit">
                <History className="h-4 w-4 mr-1" /> Audit Log
              </TabsTrigger>
            </TabsList>
            {tab !== 'audit' && tab !== 'permissions' && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="이메일·이름·법인 검색"
                  className="pl-8 w-[280px]"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
          </div>

          <TabsContent value="pending" className="mt-4">
            <UsersTable
              users={filteredUsers}
              loading={loading}
              codeToName={codeToName}
              onEdit={setEditTarget}
              onRemove={null}
              emptyMessage="승인 대기 사용자가 없습니다."
            />
          </TabsContent>

          <TabsContent value="active" className="mt-4">
            <UsersTable
              users={filteredUsers}
              loading={loading}
              codeToName={codeToName}
              onEdit={setEditTarget}
              onRemove={async (u, reason) => {
                try {
                  await removeUserRoles({ userId: u.id, reason });
                  toast.success('권한 회수 완료', { description: u.email });
                  await loadAll();
                } catch (e) {
                  toast.error('권한 회수 실패', { description: getErrorMessage(e) });
                }
              }}
              emptyMessage="활성 사용자가 없습니다."
            />
          </TabsContent>

          <TabsContent value="permissions" className="mt-4">
            <PageAccessMatrix />
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <AuditLogTable entries={auditEntries} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>

      <RoleEditDialog
        open={editTarget !== null}
        target={editTarget}
        subsidiaries={subsidiaries}
        onClose={() => setEditTarget(null)}
        onSubmit={async (role, entityCodes, reason) => {
          if (!editTarget) return;
          try {
            await upsertUserRole({ userId: editTarget.id, role, entityCodes, reason });
            toast.success('역할 적용 완료', { description: editTarget.email });
            setEditTarget(null);
            await loadAll();
          } catch (e) {
            toast.error('역할 적용 실패', { description: getErrorMessage(e) });
          }
        }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------

/**
 * 역할 × 페이지 접근 매트릭스.
 * - gbs_admin 컬럼은 잠금 (항상 전체 허용)
 * - entity_user 만 체크박스 편집 → 저장 시 role_page_permissions 통째 교체
 */
function PageAccessMatrix() {
  const [loadingPerm, setLoadingPerm] = useState(true);
  const [savingPerm, setSavingPerm] = useState(false);
  const [entityPages, setEntityPages] = useState<Set<string>>(new Set());
  const [originalEntityPages, setOriginalEntityPages] = useState<Set<string>>(new Set());

  const groups = useMemo(() => getPagesByGroup(), []);

  const load = useCallback(async () => {
    setLoadingPerm(true);
    try {
      const all = await getAllRolePagePermissions();
      setEntityPages(new Set(all.entity_user));
      setOriginalEntityPages(new Set(all.entity_user));
    } catch (e) {
      toast.error('권한 로드 실패', { description: getErrorMessage(e) });
    } finally {
      setLoadingPerm(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = useMemo(() => {
    if (entityPages.size !== originalEntityPages.size) return true;
    for (const id of entityPages) {
      if (!originalEntityPages.has(id)) return true;
    }
    return false;
  }, [entityPages, originalEntityPages]);

  const togglePage = (pageId: string, role: ManagedRole) => {
    if (role === 'gbs_admin') return; // 잠금
    setEntityPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const toggleAllInGroup = (pageIds: string[], allOn: boolean) => {
    setEntityPages((prev) => {
      const next = new Set(prev);
      if (allOn) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSavingPerm(true);
    try {
      await setRolePagePermissions('entity_user', Array.from(entityPages));
      setOriginalEntityPages(new Set(entityPages));
      toast.success('페이지 접근 권한이 저장되었습니다.');
    } catch (e) {
      toast.error('저장 실패', { description: getErrorMessage(e) });
    } finally {
      setSavingPerm(false);
    }
  };

  if (loadingPerm) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> 권한 로드 중…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-gray-500" />
              역할별 페이지 접근 권한
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              <strong className="text-gray-700">GBS Admin</strong>은 항상 모든 페이지에 접근할 수 있습니다 (잠금).
              <strong className="text-gray-700 ml-1">Entity User</strong>는 체크된 페이지만 접근 가능합니다.
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={!isDirty || savingPerm}
            className="gap-1.5"
            style={{ backgroundColor: '#971B2F' }}
          >
            {savingPerm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {savingPerm ? '저장 중...' : '변경사항 저장'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm border-t border-gray-200">
          <thead className="bg-gray-50 text-gray-700 sticky top-0">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium w-[60%]">페이지</th>
              <th className="text-center px-4 py-2.5 font-medium">
                <div className="flex items-center justify-center gap-1.5">
                  <span>GBS Admin</span>
                  <Lock className="h-3 w-3 text-gray-400" />
                </div>
              </th>
              <th className="text-center px-4 py-2.5 font-medium">Entity User</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ group, pages }) => {
              const groupIds = pages.map((p) => p.id);
              const allOn = groupIds.every((id) => entityPages.has(id));
              const someOn = groupIds.some((id) => entityPages.has(id));
              return (
                <Fragment key={`group-${group}`}>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td className="px-4 py-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {group}
                    </td>
                    <td className="px-4 py-1.5 text-center text-xs text-gray-400">—</td>
                    <td className="px-4 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleAllInGroup(groupIds, allOn)}
                        className={cn(
                          'text-[11px] underline-offset-2 hover:underline',
                          allOn ? 'text-gray-500' : someOn ? 'text-blue-600' : 'text-blue-600',
                        )}
                      >
                        {allOn ? '모두 해제' : '모두 선택'}
                      </button>
                    </td>
                  </tr>
                  {pages.map((p) => {
                    const entityChecked = entityPages.has(p.id);
                    return (
                      <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-800">{p.label}</span>
                            <span className="text-[11px] text-gray-400 font-mono">{p.path}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Checkbox checked disabled aria-label="GBS Admin 항상 허용" />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Checkbox
                            checked={entityChecked}
                            onCheckedChange={() => togglePage(p.id, 'entity_user')}
                            aria-label={`Entity User: ${p.label}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------

function UsersTable({
  users,
  loading,
  codeToName,
  onEdit,
  onRemove,
  emptyMessage,
}: {
  users: AdminUserRow[];
  loading: boolean;
  codeToName: Map<string, string>;
  onEdit: (u: AdminUserRow) => void;
  onRemove: ((u: AdminUserRow, reason: string) => Promise<void>) | null;
  emptyMessage: string;
}) {
  if (loading && users.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> 로딩 중…
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">{emptyMessage}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Team</th>
              <th className="text-left px-4 py-2 font-medium">Role / Entities</th>
              <th className="text-left px-4 py-2 font-medium">가입일</th>
              <th className="text-right px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-4 py-2 font-mono text-xs text-gray-800">{u.email}</td>
                <td className="px-4 py-2">{u.name ?? <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-2 text-gray-600">{u.team ?? <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-2">
                  <RolesCell roles={u.roles} codeToName={codeToName} />
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {format(new Date(u.created_at), 'yyyy-MM-dd')}
                </td>
                <td className="px-4 py-2 text-right space-x-1 whitespace-nowrap">
                  <Button size="sm" variant="outline" onClick={() => onEdit(u)}>
                    <UserCheck className="h-4 w-4 mr-1" />
                    {u.status === 'pending' ? '승인' : '변경'}
                  </Button>
                  {onRemove && (
                    <RemoveButton user={u} onRemove={onRemove} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function RolesCell({ roles, codeToName }: { roles: AdminUserRole[]; codeToName: Map<string, string> }) {
  if (roles.length === 0) {
    return <Badge variant="outline" className="text-gray-500">미부여</Badge>;
  }
  // 같은 role 끼리 묶어서 표시
  const grouped = new Map<string, Array<string | null>>();
  for (const r of roles) {
    const arr = grouped.get(r.role) || [];
    arr.push(r.entity_code);
    grouped.set(r.role, arr);
  }
  return (
    <div className="flex flex-col gap-1">
      {[...grouped.entries()].map(([role, codes]) => {
        const meta = ROLE_BADGE[role as AdminUserRole['role']] ?? { bg: '#F1F5F9', text: '#475569' };
        return (
          <div key={role} className="flex items-center gap-1.5 flex-wrap">
            <Badge
              className="text-xs"
              style={{ backgroundColor: meta.bg, color: meta.text, border: `1px solid ${meta.text}33` }}
            >
              {role}
            </Badge>
            {codes
              .filter((c): c is string => Boolean(c))
              .map((code) => (
                <span key={code} className="text-xs text-gray-600">
                  {codeToName.get(code) ?? code} <span className="text-gray-400">({code})</span>
                </span>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function RemoveButton({
  user,
  onRemove,
}: {
  user: AdminUserRow;
  onRemove: (u: AdminUserRow, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50">
          <UserX className="h-4 w-4 mr-1" /> 회수
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>권한 회수</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{user.email}</strong> 의 모든 역할을 제거합니다. 사용자는 다시 Pending 상태가 됩니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">사유 (감사 로그에 기록)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 퇴사, 조직 변경" />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 hover:bg-red-700"
            onClick={async (e) => {
              e.preventDefault();
              await onRemove(user, reason);
              setOpen(false);
              setReason('');
            }}
          >
            회수
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// -----------------------------------------------------------------------------

function RoleEditDialog({
  open,
  target,
  subsidiaries,
  onClose,
  onSubmit,
}: {
  open: boolean;
  target: AdminUserRow | null;
  subsidiaries: Subsidiary[];
  onClose: () => void;
  onSubmit: (role: AdminUserRole['role'], entityCodes: string[], reason: string) => Promise<void>;
}) {
  const [role, setRole] = useState<AdminUserRole['role']>('entity_user');
  const [entityCodes, setEntityCodes] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!target) return;
    const existing = target.roles[0]?.role as AdminUserRole['role'] | undefined;
    // 레거시 역할(gbs_user / executive)은 신규 부여 불가 — 편집 시 'gbs_admin' 으로 정규화
    const normalized: AdminUserRole['role'] =
      existing === 'entity_user' || existing === 'gbs_admin'
        ? existing
        : existing
          ? 'gbs_admin'
          : 'entity_user';
    setRole(normalized);
    setEntityCodes(target.roles.map((r) => r.entity_code).filter((c): c is string => Boolean(c)));
    setReason('');
  }, [target]);

  const toggleCode = (code: string) => {
    setEntityCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const handleSubmit = async () => {
    if (!target) return;
    if (role === 'entity_user' && entityCodes.length === 0) {
      toast.error('Entity User 는 최소 1개 법인을 선택해야 합니다.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(role, entityCodes, reason);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{target?.status === 'pending' ? '사용자 승인' : '역할 변경'}</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block">대상: <strong>{target?.email}</strong></span>
            {target?.name && <span className="block text-xs text-gray-500">{target.name}</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">역할</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AdminUserRole['role'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-[11px] text-gray-500">{opt.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {role === 'entity_user' && (
            <div className="space-y-1.5">
              <Label className="text-sm">접근 가능한 법인</Label>
              <div className="border border-gray-200 rounded-md max-h-[200px] overflow-y-auto">
                {subsidiaries.length === 0 && (
                  <div className="p-3 text-xs text-gray-500">법인 목록을 불러오지 못했습니다.</div>
                )}
                {subsidiaries.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={entityCodes.includes(s.code)}
                      onCheckedChange={() => toggleCode(s.code)}
                    />
                    <span className="flex-1">{s.name}</span>
                    <span className="text-xs text-gray-500 font-mono">{s.code}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-gray-500">여러 법인을 담당하는 사용자라면 모두 선택하세요.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm">사유 (감사 로그에 기록, 선택)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 신규 입사 / 부서 이동" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {target?.status === 'pending' ? '승인하기' : '저장하기'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------

function AuditLogTable({ entries, loading }: { entries: AuditLogEntry[]; loading: boolean }) {
  if (loading && entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> 로딩 중…
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          감사 로그가 비어 있습니다. <br />
          <span className="text-xs text-gray-400">
            (테이블이 없다면 <code>docs/user-role-changes-schema.sql</code> 을 Supabase 에 적용하세요.)
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left px-4 py-2 font-medium">시각</th>
              <th className="text-left px-4 py-2 font-medium">Action</th>
              <th className="text-left px-4 py-2 font-medium">대상</th>
              <th className="text-left px-4 py-2 font-medium">변경</th>
              <th className="text-left px-4 py-2 font-medium">관리자</th>
              <th className="text-left px-4 py-2 font-medium">사유</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-gray-100 align-top">
                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                  {format(new Date(e.created_at), 'yyyy-MM-dd HH:mm')}
                </td>
                <td className="px-4 py-2">
                  <ActionBadge action={e.action} />
                </td>
                <td className="px-4 py-2">
                  <div className="text-xs font-mono text-gray-800">{e.target_email ?? '(unknown)'}</div>
                  {e.target_name && <div className="text-xs text-gray-500">{e.target_name}</div>}
                </td>
                <td className="px-4 py-2 text-xs">
                  <StateDiff before={e.before_state} after={e.after_state} />
                </td>
                <td className="px-4 py-2 text-xs text-gray-700">
                  {e.actor_email ?? '(system)'}
                </td>
                <td className="px-4 py-2 text-xs text-gray-700">
                  {e.reason || <span className="text-gray-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ActionBadge({ action }: { action: AuditLogEntry['action'] }) {
  const map: Record<AuditLogEntry['action'], { bg: string; text: string; label: string }> = {
    approve: { bg: '#ECFDF5', text: '#047857', label: '승인' },
    update: { bg: '#EFF6FF', text: '#1D4ED8', label: '변경' },
    remove: { bg: '#FEF2F2', text: '#B91C1C', label: '회수' },
  };
  const m = map[action];
  return (
    <Badge className="text-xs" style={{ backgroundColor: m.bg, color: m.text, border: `1px solid ${m.text}33` }}>
      {m.label}
    </Badge>
  );
}

function StateDiff({
  before,
  after,
}: {
  before: AuditLogEntry['before_state'];
  after: AuditLogEntry['after_state'];
}) {
  const renderState = (s: AuditLogEntry['before_state']) => {
    if (!s || s.length === 0) return <span className="text-gray-400">없음</span>;
    return (
      <div className="space-y-0.5">
        {s.map((row, i) => {
          const codes = (row.entity_codes || []).filter((c): c is string => Boolean(c));
          return (
            <div key={i}>
              <span className="font-mono">{row.role}</span>
              {codes.length > 0 && <span className="text-gray-500"> · {codes.join(', ')}</span>}
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      {renderState(before)}
      <span className="text-gray-400">→</span>
      {renderState(after)}
    </div>
  );
}
