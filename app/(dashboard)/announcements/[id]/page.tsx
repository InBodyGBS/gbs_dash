'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ArrowLeft, Send, Trash2, Pencil, Save, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getIsAdminUser } from '@/lib/auth/admin';
import type { AnnouncementRow, AnnouncementVisibility } from '@/lib/types/announcement';

interface Comment {
  id: string;
  announcement_id: string;
  author: string;
  content: string;
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

function normalizeAnnouncement(row: Record<string, unknown>): AnnouncementRow {
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

async function incrementViewCount(announcementId: string): Promise<number | null> {
  const res = await fetch(`/api/announcements/${announcementId}/view`, { method: 'POST' });
  if (res.ok) {
    const j = (await res.json()) as { view_count?: number };
    return typeof j.view_count === 'number' ? j.view_count : null;
  }
  const { data: row } = await supabase.from('announcements').select('view_count').eq('id', announcementId).single();
  const cur = typeof (row as { view_count?: number } | null)?.view_count === 'number'
    ? (row as { view_count: number }).view_count
    : 0;
  const next = cur + 1;
  const { error } = await supabase.from('announcements').update({ view_count: next }).eq('id', announcementId);
  if (error) return null;
  return next;
}

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const viewIncremented = useRef(false);

  const [data, setData] = useState<AnnouncementRow | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    type: string;
    title: string;
    author: string;
    content: string;
    visibility: AnnouncementVisibility;
  }>({ type: 'Notice', title: '', author: '', content: '', visibility: 'confidential' });

  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    viewIncremented.current = false;
    const load = async () => {
      const admin = await getIsAdminUser();
      setIsAdmin(admin);

      const [announcementResult, commentsResult] = await Promise.all([
        supabase.from('announcements').select('*').eq('id', id).single(),
        supabase
          .from('announcement_comments')
          .select('*')
          .eq('announcement_id', id)
          .order('created_at', { ascending: true }),
      ]);

      if (announcementResult.error || !announcementResult.data) {
        toast.error('공지사항을 찾을 수 없습니다.');
        router.push('/announcements');
        return;
      }

      const item = normalizeAnnouncement(announcementResult.data as Record<string, unknown>);

      if (item.visibility === 'confidential' && !admin) {
        toast.error('Confidential 공지는 관리자만 볼 수 있습니다.');
        router.replace('/announcements');
        return;
      }

      setData(item);
      setForm({
        type: item.type,
        title: item.title,
        author: item.author,
        content: item.content || '',
        visibility: item.visibility,
      });
      setEditMode(Boolean(!item.content && admin));
      setComments((commentsResult.data || []) as unknown as Comment[]);
      setLoading(false);
    };
    void load();
  }, [id, router]);

  useEffect(() => {
    if (!data || loading) return;
    if (viewIncremented.current) return;
    viewIncremented.current = true;
    void (async () => {
      const next = await incrementViewCount(data.id);
      if (next != null) {
        setData((prev) => (prev ? { ...prev, view_count: next } : prev));
      }
    })();
  }, [data, loading]);

  const canEdit = isAdmin;

  const handleSave = async () => {
    if (!canEdit) return;
    if (!form.title.trim() || !form.author.trim()) {
      toast.error('제목과 작성자를 입력해주세요.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('announcements')
      .update({
        type: form.type,
        title: form.title.trim(),
        author: form.author.trim(),
        content: form.content.trim() || null,
        visibility: form.visibility,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', id);
    setSaving(false);
    if (error) {
      toast.error('저장 실패: ' + error.message);
      return;
    }
    setData((prev) =>
      prev
        ? {
            ...prev,
            ...form,
            content: form.content.trim() || null,
            visibility: form.visibility,
          }
        : prev,
    );
    setEditMode(false);
    toast.success('저장되었습니다.');
  };

  const handleCommentSubmit = async () => {
    if (!commentAuthor.trim() || !commentContent.trim()) {
      toast.error('이름과 댓글 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    const { data: newComment, error } = await supabase
      .from('announcement_comments')
      .insert({
        announcement_id: id,
        author: commentAuthor.trim(),
        content: commentContent.trim(),
      } as never)
      .select()
      .single();
    setSubmitting(false);
    if (error) {
      toast.error('댓글 등록 실패: ' + error.message);
      return;
    }
    setComments((prev) => [...prev, newComment as unknown as Comment]);
    setCommentContent('');
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!isAdmin) {
      toast.error('댓글 삭제는 관리자만 가능합니다.');
      return;
    }
    const { error } = await supabase.from('announcement_comments').delete().eq('id', commentId);
    if (error) toast.error('삭제 실패: ' + error.message);
    else setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleDeleteAnnouncement = async () => {
    if (!canEdit) return;
    if (!confirm('이 공지사항을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      toast.error('삭제 실패: ' + error.message);
      return;
    }
    toast.success('삭제되었습니다.');
    router.push('/announcements');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push('/announcements')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </button>
          <div className="flex items-center gap-2">
            {canEdit && !editMode && (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  <Pencil className="w-4 h-4 mr-1" />
                  수정
                </Button>
                <Button variant="destructive" size="sm" onClick={() => void handleDeleteAnnouncement()}>
                  삭제
                </Button>
              </>
            )}
            {canEdit && editMode && (
              <div className="flex gap-2">
                {data.content && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setForm({
                        type: data.type,
                        title: data.title,
                        author: data.author,
                        content: data.content || '',
                        visibility: data.visibility,
                      });
                      setEditMode(false);
                    }}
                  >
                    <X className="w-4 h-4 mr-1" />
                    취소
                  </Button>
                )}
                <Button size="sm" onClick={() => void handleSave()} disabled={saving} style={{ backgroundColor: '#971B2F' }}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? '저장 중...' : '저장'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-8">
          {!editMode && (
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs px-2 py-0.5 rounded text-white"
                  style={{ backgroundColor: TYPE_COLORS[data.type] || '#9CA3AF' }}
                >
                  {data.type}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${data.visibility === 'confidential' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}
                >
                  {data.visibility === 'confidential' ? 'Confidential' : 'All announcement'}
                </span>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Eye className="w-4 h-4" />
                <span>조회 {data.view_count.toLocaleString()}</span>
              </div>
            </div>
          )}

          {editMode && canEdit ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="mb-1.5 block text-xs text-gray-500">Type</Label>
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
                  <Label className="mb-1.5 block text-xs text-gray-500">Author</Label>
                  <Input
                    value={form.author}
                    onChange={(e) => setForm({ ...form, author: e.target.value })}
                    placeholder="작성자"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-gray-500">공개 범위</Label>
                  <Select
                    value={form.visibility}
                    onValueChange={(v) =>
                      setForm({ ...form, visibility: v as AnnouncementVisibility })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confidential">Confidential (관리자만)</SelectItem>
                      <SelectItem value="all">All announcement (전체 읽기)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-gray-500">Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="공지 제목"
                  className="text-base font-medium"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-gray-500">Content</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="본문을 입력하세요..."
                  className="min-h-[360px] resize-none leading-relaxed"
                />
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{data.title}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-400 pb-5 border-b border-gray-100">
                <span>{data.author}</span>
                <span>·</span>
                <span>
                  {new Date(data.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </span>
              </div>
              <div className="pt-6 min-h-[200px]">
                {data.content ? (
                  <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.content}</p>
                ) : (
                  <p className="text-gray-400 italic">본문이 없습니다.</p>
                )}
              </div>
            </>
          )}
        </div>

        {!editMode && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              댓글 <span className="text-gray-400 font-normal text-sm">{comments.length}개</span>
            </h2>

            {comments.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">첫 댓글을 남겨보세요.</p>
            ) : (
              <div className="space-y-4 mb-6">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 flex-shrink-0">
                      {comment.author.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-800">{comment.author}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(comment.created_at).toLocaleDateString('ko-KR', {
                            month: '2-digit',
                            day: '2-digit',
                          })}{' '}
                          {new Date(comment.created_at).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteComment(comment.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-opacity flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <Input
                placeholder="이름"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                className="w-40 text-sm"
              />
              <div className="flex gap-2">
                <Textarea
                  placeholder="댓글을 입력하세요..."
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  className="flex-1 resize-none min-h-[80px] text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void handleCommentSubmit();
                  }}
                />
                <Button
                  onClick={() => void handleCommentSubmit()}
                  disabled={submitting}
                  className="self-end"
                  style={{ backgroundColor: '#971B2F' }}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-gray-400">Ctrl+Enter로 등록</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
