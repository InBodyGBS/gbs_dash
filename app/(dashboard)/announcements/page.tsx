'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Plus, Trash2, RefreshCw, Send, Lock, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getIsAdminUser } from '@/lib/auth/admin';
import type { AnnouncementRow, AnnouncementVisibility } from '@/lib/types/announcement';

const ANNOUNCEMENT_TYPES = ['Notice', 'Events', 'Mail', 'Update', 'Alert'];

const TYPE_COLORS: Record<string, string> = {
  Notice: '#EF4444',
  Events: '#9CA3AF',
  Mail: '#F59E0B',
  Update: '#3B82F6',
  Alert: '#EF4444',
};

function normalizeRow(row: Record<string, unknown>): AnnouncementRow {
  const v = row.visibility;
  const vis: AnnouncementVisibility = v === 'all' ? 'all' : 'confidential';
  const vc = row.view_count;
  return {
    id: String(row.id),
    type: String(row.type ?? ''),
    title: String(row.title ?? ''),
    author: String(row.author ?? ''),
    content: row.content != null ? String(row.content) : null,
    visibility: vis,
    view_count: typeof vc === 'number' ? vc : 0,
    created_at: String(row.created_at ?? ''),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
  };
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  /** 기본: Confidential */
  const [scopeTab, setScopeTab] = useState<AnnouncementVisibility>('confidential');

  const [form, setForm] = useState({ type: 'Notice', title: '', author: '' });

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    const admin = await getIsAdminUser();
    setIsAdmin(admin);

    let q = supabase.from('announcements').select('*').order('created_at', { ascending: false });

    if (scopeTab === 'confidential') {
      if (!admin) {
        setAnnouncements([]);
        setLoading(false);
        return;
      }
      q = q.eq('visibility', 'confidential');
    } else {
      q = q.eq('visibility', 'all');
    }

    const { data, error } = await q;
    if (error) {
      toast.error('불러오기 실패: ' + error.message);
      setAnnouncements([]);
    } else {
      setAnnouncements((data || []).map((r) => normalizeRow(r as Record<string, unknown>)));
    }
    setLoading(false);
  }, [scopeTab]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const handleRegisterSubmit = async () => {
    if (!isAdmin) {
      toast.error('등록은 관리자만 가능합니다.');
      return;
    }
    if (!form.title.trim() || !form.author.trim()) {
      toast.error('제목과 작성자를 입력해주세요.');
      return;
    }
    setSubmitting(true);
    const visibility = scopeTab;

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        type: form.type,
        title: form.title.trim(),
        author: form.author.trim(),
        content: null,
        visibility,
      } as never)
      .select('id')
      .single();

    setSubmitting(false);
    if (error) {
      toast.error('등록 실패: ' + error.message);
      return;
    }
    const inserted = data as { id: string };
    toast.success('본문 작성 화면으로 이동합니다.');
    setForm({ type: 'Notice', title: '', author: '' });
    setDialogOpen(false);
    router.push(`/announcements/${inserted.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) toast.error('삭제 실패: ' + error.message);
    else {
      toast.success('삭제되었습니다.');
      setDeleteId(null);
      void load();
    }
  };

  const colCount = isAdmin ? 6 : 5;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
            <p className="text-sm text-gray-400 mt-0.5">공지사항</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                style={{ backgroundColor: '#971B2F' }}
              >
                <Plus className="w-4 h-4 mr-1" />
                등록
              </Button>
            )}
          </div>
        </div>

        {/* Confidential | All announcement */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-1 w-fit">
          <button
            type="button"
            onClick={() => setScopeTab('confidential')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              scopeTab === 'confidential'
                ? 'bg-slate-900 text-white'
                : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            <Lock className="w-4 h-4" />
            Confidential
          </button>
          <button
            type="button"
            onClick={() => setScopeTab('all')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              scopeTab === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-gray-600 hover:bg-gray-50',
            )}
          >
            <Globe className="w-4 h-4" />
            All announcement
          </button>
        </div>

        {scopeTab === 'confidential' && !isAdmin && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Confidential 공지는 관리자만 목록 조회·읽기·작성·수정·삭제할 수 있습니다.
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 w-24">Type</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Title</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 w-32">Author</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 w-20">Views</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 w-28">Created</th>
                {isAdmin && <th className="px-5 py-3 w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={colCount} className="px-5 py-3">
                      <div className="h-5 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : scopeTab === 'confidential' && !isAdmin ? (
                <tr>
                  <td colSpan={colCount} className="px-5 py-12 text-center text-gray-400">
                    관리자만 목록을 볼 수 있습니다.
                  </td>
                </tr>
              ) : announcements.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-5 py-12 text-center text-gray-400">
                    등록된 공지사항이 없습니다.
                  </td>
                </tr>
              ) : (
                announcements.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span
                        className="inline-block text-xs px-2 py-0.5 rounded text-white"
                        style={{ backgroundColor: TYPE_COLORS[item.type] || '#9CA3AF' }}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => router.push(`/announcements/${item.id}`)}
                        className="text-gray-800 font-medium hover:text-blue-600 hover:underline text-left"
                      >
                        {item.title}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{item.author}</td>
                    <td className="px-5 py-3 text-gray-600 tabular-nums">{item.view_count}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(item.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setDeleteId(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>공지사항 등록</DialogTitle>
            <p className="text-xs text-gray-500 pt-1">
              등록 후 본문 작성 화면으로 이동합니다. ({scopeTab === 'confidential' ? 'Confidential' : 'All announcement'})
            </p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Title</Label>
              <Input
                placeholder="공지 제목 입력"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Author</Label>
              <Input
                placeholder="작성자 입력"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => void handleRegisterSubmit()}
              disabled={submitting}
              style={{ backgroundColor: '#971B2F' }}
              className="gap-1.5"
            >
              <Send className="w-4 h-4" />
              {submitting ? '처리 중...' : '본문 작성으로 이동'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>공지사항 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">이 공지사항을 삭제하시겠습니까?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={() => deleteId && void handleDelete(deleteId)}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
