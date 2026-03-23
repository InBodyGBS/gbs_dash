'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ArrowLeft, Send, Trash2, Pencil, Save, X } from 'lucide-react';
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

interface Announcement {
  id: string;
  type: string;
  title: string;
  author: string;
  content: string | null;
  created_at: string;
}

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

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = useState<Announcement | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'Notice', title: '', author: '', content: '' });

  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
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

      const item = announcementResult.data as unknown as Announcement;
      setData(item);
      setForm({
        type: item.type,
        title: item.title,
        author: item.author,
        content: item.content || '',
      });
      // 본문이 없으면 바로 편집 모드로
      setEditMode(!item.content);
      setComments((commentsResult.data || []) as unknown as Comment[]);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSave = async () => {
    if (!form.title.trim() || !form.author.trim()) {
      toast.error('제목과 작성자를 입력해주세요.');
      return;
    }
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('announcements')
      .update({
        type: form.type,
        title: form.title.trim(),
        author: form.author.trim(),
        content: form.content.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    setSaving(false);
    if (error) {
      toast.error('저장 실패: ' + error.message);
      return;
    }
    setData((prev) => prev ? { ...prev, ...form, content: form.content.trim() || null } : prev);
    setEditMode(false);
    toast.success('저장되었습니다.');
  };

  const handleCommentSubmit = async () => {
    if (!commentAuthor.trim() || !commentContent.trim()) {
      toast.error('이름과 댓글 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newComment, error } = await (supabase as any)
      .from('announcement_comments')
      .insert({ announcement_id: id, author: commentAuthor.trim(), content: commentContent.trim() })
      .select()
      .single();
    setSubmitting(false);
    if (error) { toast.error('댓글 등록 실패: ' + error.message); return; }
    setComments((prev) => [...prev, newComment as unknown as Comment]);
    setCommentContent('');
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from('announcement_comments').delete().eq('id', commentId);
    if (error) toast.error('삭제 실패: ' + error.message);
    else setComments((prev) => prev.filter((c) => c.id !== commentId));
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

        {/* 상단 네비 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/announcements')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </button>
          {!editMode ? (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Pencil className="w-4 h-4 mr-1" />
              수정
            </Button>
          ) : (
            <div className="flex gap-2">
              {data.content && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setForm({ type: data.type, title: data.title, author: data.author, content: data.content || '' });
                    setEditMode(false);
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  취소
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saving} style={{ backgroundColor: '#971B2F' }}>
                <Save className="w-4 h-4 mr-1" />
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          )}
        </div>

        {/* 본문 영역 */}
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          {editMode ? (
            /* ── 편집 모드 ── */
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="mb-1.5 block text-xs text-gray-500">Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ANNOUNCEMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
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
            /* ── 읽기 모드 ── */
            <>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="text-xs px-2 py-0.5 rounded text-white"
                  style={{ backgroundColor: TYPE_COLORS[data.type] || '#9CA3AF' }}
                >
                  {data.type}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">{data.title}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-400 pb-5 border-b border-gray-100">
                <span>{data.author}</span>
                <span>·</span>
                <span>
                  {new Date(data.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
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

        {/* 댓글 — 읽기 모드일 때만 표시 */}
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
                            month: '2-digit', day: '2-digit',
                          })}{' '}
                          {new Date(comment.created_at).toLocaleTimeString('ko-KR', {
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition-opacity flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCommentSubmit(); }}
                />
                <Button
                  onClick={handleCommentSubmit}
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
