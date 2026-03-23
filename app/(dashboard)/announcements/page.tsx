'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
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

interface Announcement {
  id: string;
  type: string;
  title: string;
  author: string;
  created_at: string;
}

const ANNOUNCEMENT_TYPES = ['Notice', 'Events', 'Mail', 'Update', 'Alert'];

const TYPE_COLORS: Record<string, string> = {
  Notice: '#EF4444',
  Events: '#9CA3AF',
  Mail: '#F59E0B',
  Update: '#3B82F6',
  Alert: '#EF4444',
};

export default function AnnouncementsPage() {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ type: 'Notice', title: '', author: '' });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('불러오기 실패: ' + error.message);
    else setAnnouncements((data || []) as unknown as Announcement[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.author.trim()) {
      toast.error('제목과 작성자를 입력해주세요.');
      return;
    }
    setSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('announcements').insert({
      type: form.type,
      title: form.title.trim(),
      author: form.author.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error('등록 실패: ' + error.message);
    } else {
      toast.success('공지사항이 등록되었습니다.');
      setForm({ type: 'Notice', title: '', author: '' });
      setDialogOpen(false);
      load();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) toast.error('삭제 실패: ' + error.message);
    else {
      toast.success('삭제되었습니다.');
      setDeleteId(null);
      load();
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
            <p className="text-sm text-gray-400 mt-0.5">공지사항 관리</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)} style={{ backgroundColor: '#971B2F' }}>
              <Plus className="w-4 h-4 mr-1" />
              등록
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 w-24">Type</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">Title</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 w-32">Author</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 w-28">Created</th>
                <th className="px-5 py-3 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-5 py-3">
                      <div className="h-5 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : announcements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
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
                        onClick={() => router.push(`/announcements/${item.id}`)}
                        className="text-gray-800 font-medium hover:text-blue-600 hover:underline text-left"
                      >
                        {item.title}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{item.author}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">
                      {new Date(item.created_at).toLocaleDateString('ko-KR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => setDeleteId(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 등록 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>공지사항 등록</DialogTitle>
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
                    <SelectItem key={t} value={t}>{t}</SelectItem>
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
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Author</Label>
              <Input
                placeholder="작성자 입력"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              style={{ backgroundColor: '#971B2F' }}
            >
              {submitting ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>공지사항 삭제</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">이 공지사항을 삭제하시겠습니까?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>취소</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
