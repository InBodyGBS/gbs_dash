'use client';

import Link from 'next/link';
import { X, MessageSquare } from 'lucide-react';
import type { VoeInquiry, VoeStatus } from '@/lib/types/voe';

const STATUS_STYLES: Record<VoeStatus, { label: string; bg: string; text: string }> = {
  Pending: { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'In Progress': { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-700' },
  Resolved: { label: 'Resolved', bg: 'bg-green-100', text: 'text-green-700' },
};

interface OverviewReviewVoeDialogProps {
  open: boolean;
  onClose: () => void;
  entityName: string;
  categoryLabel: string;
  quarterLabel: string;
  threads: VoeInquiry[];
}

export function OverviewReviewVoeDialog({
  open,
  onClose,
  entityName,
  categoryLabel,
  quarterLabel,
  threads,
}: OverviewReviewVoeDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-900">VOE 문의·답변</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {entityName} · {categoryLabel} · {quarterLabel}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {threads.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 문의가 없습니다.</p>
          ) : (
            threads.map((item) => {
              const st = STATUS_STYLES[item.status] ?? STATUS_STYLES.Pending;
              const hasResponse = !!item.response?.trim();
              return (
                <div key={item.id} className="rounded-lg border border-gray-200 p-3 space-y-2 bg-gray-50/50">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <span className="text-xs font-medium text-gray-700 truncate flex-1 min-w-0" title={item.title}>
                      {item.title}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    {new Date(item.created_at).toLocaleString('ko-KR')}
                    {item.author ? ` · GBS ${item.author}` : ''}
                  </p>
                  <div>
                    <p className="text-[10px] font-medium text-gray-500 mb-0.5">문의</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.content}</p>
                  </div>
                  {hasResponse ? (
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                        <p className="text-[10px] font-medium text-blue-700">법인 답변</p>
                        {item.responded_by && (
                          <span className="text-[10px] text-blue-600">({item.responded_by})</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{item.response}</p>
                      {item.responded_at && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          {new Date(item.responded_at).toLocaleString('ko-KR')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5">아직 법인 답변이 없습니다.</p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center gap-2 flex-shrink-0">
          <Link href="/voe" className="text-xs text-blue-600 hover:underline" onClick={onClose}>
            VOE 페이지에서 전체 보기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
