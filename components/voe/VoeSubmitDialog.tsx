'use client';

import { useState } from 'react';
import { X, Send } from 'lucide-react';
import { createVoeInquiry } from '@/lib/services/voeService';
import type { VoeCategory } from '@/lib/types/voe';

const VOE_CATEGORIES: VoeCategory[] = ['General', 'Accounting', 'Tax', 'Closing', 'System', 'Other'];

interface VoeSubmitDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  /**
   * 권한 부여 후 로그인 사용자의 법인이 자동으로 주입될 예정.
   * 현재는 undefined → 수기 입력 필드 노출.
   */
  entityName?: string;
}

export function VoeSubmitDialog({ open, onClose, onSubmitted, entityName }: VoeSubmitDialogProps) {
  // entityName prop이 없을 때만 사용되는 수기 입력 상태
  const [entityNameInput, setEntityNameInput] = useState('');

  const [form, setForm] = useState({
    title: '',
    category: 'General' as VoeCategory,
    author: '',
    content: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 실제 사용할 법인명: prop 우선, 없으면 수기 입력값
  const resolvedEntityName = entityName ?? entityNameInput;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !resolvedEntityName || !form.author || !form.content) {
      setError('모든 필드를 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createVoeInquiry({ ...form, entity_name: resolvedEntityName, direction: 'entity_to_gbs', source_category: null, source_quarter_id: null });
      setForm({ title: '', category: 'General', author: '', content: '' });
      setEntityNameInput('');
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '제출 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">새 문의 등록</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                법인명 *
                {entityName && (
                  <span className="ml-1.5 text-xs text-blue-500 font-normal">(자동)</span>
                )}
              </label>
              {entityName ? (
                /* 권한 부여 후: prop으로 자동 주입된 법인명 표시 */
                <div className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg bg-gray-50 text-gray-700">
                  {entityName}
                </div>
              ) : (
                /* 현재: 수기 입력 */
                <input
                  type="text"
                  value={entityNameInput}
                  onChange={(e) => setEntityNameInput(e.target.value)}
                  placeholder="예: InBody USA"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">작성자 *</label>
              <input
                type="text"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                placeholder="이름"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">제목 *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="문의 제목을 입력하세요"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">카테고리</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as VoeCategory })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {VOE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">문의 내용 *</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="GBS에 문의하실 내용을 자세히 작성해주세요."
              rows={5}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
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
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? '제출 중...' : '문의 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
