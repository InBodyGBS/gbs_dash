'use client';

import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Send, Edit2, Trash2, X, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  getSubmissionComments,
  createSubmissionComment,
  updateSubmissionComment,
  deleteSubmissionComment,
} from '@/lib/services/submissionService';
import type { Submission, SubmissionComment } from '@/lib/types/submission';

interface SubmissionCommentDialogProps {
  open: boolean;
  onClose: () => void;
  submission: Submission | null;
}

export function SubmissionCommentDialog({
  open,
  onClose,
  submission,
}: SubmissionCommentDialogProps) {
  const [comments, setComments] = useState<SubmissionComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && submission) {
      loadComments();
    } else {
      setComments([]);
      setMessage('');
      setEditingId(null);
      setEditMessage('');
    }
  }, [open, submission]);

  const loadComments = async () => {
    if (!submission) return;

    try {
      setLoading(true);
      const data = await getSubmissionComments(submission.id);
      setComments(data);
      // 스크롤을 맨 아래로
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }, 100);
    } catch (error: any) {
      console.error('Failed to load comments:', error);
      toast.error('댓글 로드 실패', {
        description: error.message || '댓글을 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!submission || !message.trim()) return;

    setSending(true);
    try {
      const newComment = await createSubmissionComment(submission.id, message);
      setComments([...comments, newComment]);
      setMessage('');
      toast.success('댓글이 등록되었습니다.');
      // 스크롤을 맨 아래로
      setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }, 100);
    } catch (error: any) {
      toast.error('댓글 작성 실패', {
        description: error.message || '댓글을 작성하는 중 오류가 발생했습니다.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleStartEdit = (comment: SubmissionComment) => {
    setEditingId(comment.id);
    setEditMessage(comment.message);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditMessage('');
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editMessage.trim()) return;

    try {
      const updated = await updateSubmissionComment(commentId, editMessage);
      setComments(comments.map((c) => (c.id === commentId ? updated : c)));
      setEditingId(null);
      setEditMessage('');
      toast.success('댓글이 수정되었습니다.');
    } catch (error: any) {
      toast.error('댓글 수정 실패', {
        description: error.message || '댓글을 수정하는 중 오류가 발생했습니다.',
      });
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;

    try {
      await deleteSubmissionComment(commentId);
      setComments(comments.filter((c) => c.id !== commentId));
      toast.success('댓글이 삭제되었습니다.');
    } catch (error: any) {
      toast.error('댓글 삭제 실패', {
        description: error.message || '댓글을 삭제하는 중 오류가 발생했습니다.',
      });
    }
  };

  const handleExportComments = () => {
    if (comments.length === 0) {
      toast.error('다운로드할 댓글이 없습니다.');
      return;
    }

    // 엑셀 데이터 생성
    const excelData = comments.map((comment, index) => ({
      '순번': index + 1,
      '작성자': comment.user_name || comment.user_email || comment.created_by || '익명',
      '이메일': comment.user_email || '',
      '작성일시': format(new Date(comment.created_at), 'yyyy-MM-dd HH:mm:ss'),
      '수정일시': format(new Date(comment.updated_at), 'yyyy-MM-dd HH:mm:ss'),
      '수정여부': comment.edited ? 'Y' : 'N',
      '댓글내용': comment.message,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '댓글 로그');

    // 컬럼 너비 설정
    const colWidths = [
      { wch: 8 },  // 순번
      { wch: 20 }, // 작성자
      { wch: 30 }, // 이메일
      { wch: 20 }, // 작성일시
      { wch: 20 }, // 수정일시
      { wch: 10 }, // 수정여부
      { wch: 50 }, // 댓글내용
    ];
    ws['!cols'] = colWidths;

    const fileName = `댓글로그_${submission?.file_name.replace(/\.(xlsx?|xls)$/i, '')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success('댓글 로그가 다운로드되었습니다.', {
      description: fileName,
    });
  };

  if (!submission) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{submission.file_name}</DialogTitle>
            {comments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportComments}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                댓글 로그 다운로드
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4" ref={scrollAreaRef}>
          <div className="space-y-4 py-4">
            {loading ? (
              <div className="text-center py-8">
                <div
                  className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
                  style={{ borderColor: '#971B2F' }}
                ></div>
                <p className="text-gray-600 mt-4">로딩 중...</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>아직 댓글이 없습니다.</p>
                <p className="text-sm mt-2">첫 번째 댓글을 작성해보세요.</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  {editingId === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                        className="min-h-[100px]"
                        placeholder="댓글을 수정하세요..."
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSaveEdit(comment.id)}
                          style={{ backgroundColor: '#971B2F' }}
                        >
                          저장
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                          취소
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {comment.user_name || comment.user_email || comment.created_by || '익명'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {format(new Date(comment.created_at), 'yyyy-MM-dd HH:mm')}
                            {comment.edited && <span className="ml-2">(수정됨)</span>}
                            {comment.user_email && (
                              <span className="ml-2 text-gray-400">({comment.user_email})</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(comment)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(comment.id)}
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.message}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className="min-h-[80px] flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSend();
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              style={{ backgroundColor: '#971B2F' }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Enter + Cmd/Ctrl로 전송
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
