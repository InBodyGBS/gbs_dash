'use client';

import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { createGbsToEntityInquiry } from '@/lib/services/voeService';

interface ReviewCommentDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  entityName: string;
  categoryLabel: string;
  categoryId: string;
  quarterId: string;
  quarterLabel: string; // e.g. "2025 1Q"
}

export function ReviewCommentDialog({
  open,
  onClose,
  onSubmitted,
  entityName,
  categoryLabel,
  categoryId,
  quarterId,
  quarterLabel,
}: ReviewCommentDialogProps) {
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !content.trim()) {
      setError('담당자 이름과 문의 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createGbsToEntityInquiry({
        title: `[${quarterLabel}] ${categoryLabel} 검토 문의`,
        content: content.trim(),
        entityName,
        author: author.trim(),
        sourceCategory: categoryId,
        sourceQuarterId: quarterId,
      });
      setContent('');
      setAuthor('');
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">검토 문의 등록</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {entityName} · {categoryLabel} · {quarterLabel}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              GBS 담당자 *
              {/* 나중에 로그인 사용자로 자동 주입 예정 */}
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="이름"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">문의 내용 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`${entityName}에 ${categoryLabel} 관련 문의/코멘트를 작성해주세요.`}
              rows={5}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? '등록 중...' : '문의 전송'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
