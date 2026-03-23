'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Plus, RefreshCw, ChevronDown, ChevronUp, Clock, Send, Pencil, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { getVoeInquiries, updateVoeStatus } from '@/lib/services/voeService';
import { VoeSubmitDialog } from '@/components/voe/VoeSubmitDialog';
import type { VoeInquiry, VoeStatus, VoeDirection } from '@/lib/types/voe';

const STATUS_STYLES: Record<VoeStatus, { label: string; bg: string; text: string }> = {
  Pending:       { label: 'Pending',     bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'In Progress': { label: 'In Progress', bg: 'bg-blue-100',   text: 'text-blue-700'   },
  Resolved:      { label: 'Resolved',    bg: 'bg-green-100',  text: 'text-green-700'  },
};

const CATEGORY_COLORS: Record<string, string> = {
  General:    '#6B7280',
  Accounting: '#3B82F6',
  Tax:        '#8B5CF6',
  Closing:    '#F59E0B',
  System:     '#10B981',
  Other:      '#9CA3AF',
};

type FilterStatus = 'All' | VoeStatus;
const FILTERS: FilterStatus[] = ['All', 'Pending', 'In Progress', 'Resolved'];

type DirectionFilter = 'all' | 'entity_to_gbs' | 'gbs_to_entity';

const DIRECTION_LABELS: Record<VoeDirection, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
  entity_to_gbs: {
    label: '내 문의',
    icon: <ArrowUpRight className="w-3 h-3" />,
    bg: 'bg-blue-50',
    text: 'text-blue-600',
  },
  gbs_to_entity: {
    label: 'GBS 문의',
    icon: <ArrowDownLeft className="w-3 h-3" />,
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
  },
};

function VoeDetailRow({ item, onUpdate }: { item: VoeInquiry; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseText, setResponseText] = useState(item.response ?? '');
  const [respondedBy, setRespondedBy] = useState(item.responded_by ?? '');
  const [newStatus, setNewStatus] = useState<VoeStatus>(
    item.status === 'Pending' ? 'Resolved' : item.status
  );
  const [saving, setSaving] = useState(false);

  const s = STATUS_STYLES[item.status];
  const hasResponse = !!item.response;

  const handleSaveResponse = async () => {
    if (!responseText.trim() || !respondedBy.trim()) return;
    setSaving(true);
    try {
      await updateVoeStatus(item.id, newStatus, responseText.trim(), respondedBy.trim());
      setShowResponseForm(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const handleCancelResponse = () => {
    setResponseText(item.response ?? '');
    setRespondedBy(item.responded_by ?? '');
    setNewStatus(item.status === 'Pending' ? 'Resolved' : item.status);
    setShowResponseForm(false);
  };

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3">
          {(() => {
            const d = DIRECTION_LABELS[item.direction ?? 'entity_to_gbs'];
            return (
              <span className={`inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${d.bg} ${d.text}`}>
                {d.icon}{d.label}
              </span>
            );
          })()}
        </td>
        <td className="px-4 py-3 text-sm text-gray-800 font-medium max-w-xs">
          <span className="truncate block" title={item.title}>{item.title}</span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{item.entity_name}</td>
        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{item.author}</td>
        <td className="px-4 py-3">
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>
            {s.label}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
          {new Date(item.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
        </td>
        <td className="px-4 py-3 text-gray-400">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-blue-50/30">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-4">

              {/* 문의 내용 */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">문의 내용</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>
              </div>

              {/* 기존 답변 표시 */}
              {hasResponse && !showResponseForm && (
                <div className="border-t border-blue-100 pt-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                      <p className="text-xs font-medium text-blue-600">
                        {item.direction === 'gbs_to_entity' ? '법인 답변' : 'GBS 답변'}
                        {item.responded_by && (
                          <span className="text-gray-400 font-normal ml-1">— {item.responded_by}</span>
                        )}
                        {item.responded_at && (
                          <span className="text-gray-400 font-normal ml-1">
                            ({new Date(item.responded_at).toLocaleDateString('ko-KR')})
                          </span>
                        )}
                      </p>
                    </div>
                    {/* 답변 수정 버튼 — 나중에 관리자 권한 체크로 교체 */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowResponseForm(true); }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      수정
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.response}</p>
                </div>
              )}

              {/* 답변 대기 안내 + 답변 달기 버튼 */}
              {!hasResponse && !showResponseForm && (
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-yellow-600">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {item.direction === 'gbs_to_entity'
                        ? '법인 답변을 기다리고 있습니다.'
                        : '아직 답변이 등록되지 않았습니다.'}
                    </span>
                  </div>
                  {/* 나중에 권한 체크로 교체 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowResponseForm(true); }}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    {item.direction === 'gbs_to_entity' ? '답변하기' : '답변 달기'}
                  </button>
                </div>
              )}

              {/* 인라인 답변 작성 폼 */}
              {showResponseForm && (
                <div
                  className="border-t border-blue-100 pt-4 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                    <p className="text-xs font-medium text-blue-600">
                      {hasResponse ? '답변 수정' : 'GBS 답변 작성'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        답변자 *
                        {/* 나중에 로그인 사용자 이름으로 자동 주입 예정 */}
                      </label>
                      <input
                        type="text"
                        value={respondedBy}
                        onChange={(e) => setRespondedBy(e.target.value)}
                        placeholder="이름"
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">상태 변경</label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as VoeStatus)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">답변 내용 *</label>
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="문의에 대한 답변을 작성해주세요."
                      rows={4}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleCancelResponse}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      취소
                    </button>
                    <button
                      onClick={handleSaveResponse}
                      disabled={saving || !responseText.trim() || !respondedBy.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {saving ? '저장 중...' : '답변 저장'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function VoePage() {
  const [inquiries, setInquiries] = useState<VoeInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('All');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [showDialog, setShowDialog] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getVoeInquiries();
      setInquiries(data);
    } catch (err) {
      console.error('VOE load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const directionFiltered = directionFilter === 'all'
    ? inquiries
    : inquiries.filter((i) => (i.direction ?? 'entity_to_gbs') === directionFilter);

  const filtered = filter === 'All'
    ? directionFiltered
    : directionFiltered.filter((i) => i.status === filter);

  const counts = {
    All: directionFiltered.length,
    Pending: directionFiltered.filter((i) => i.status === 'Pending').length,
    'In Progress': directionFiltered.filter((i) => i.status === 'In Progress').length,
    Resolved: directionFiltered.filter((i) => i.status === 'Resolved').length,
  };

  const directionCounts = {
    all: inquiries.length,
    entity_to_gbs: inquiries.filter((i) => (i.direction ?? 'entity_to_gbs') === 'entity_to_gbs').length,
    gbs_to_entity: inquiries.filter((i) => i.direction === 'gbs_to_entity').length,
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">VOE</h1>
            <p className="text-sm text-gray-400 mt-0.5">Voice of Entity — 법인 담당자 문의</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </button>
            <button
              onClick={() => setShowDialog(true)}
              className="flex items-center gap-2 px-4 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              새 문의
            </button>
          </div>
        </div>

        {/* 방향 탭 */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {([
            { key: 'all', label: '전체' },
            { key: 'entity_to_gbs', label: '내 문의' },
            { key: 'gbs_to_entity', label: 'GBS 문의' },
          ] as { key: DirectionFilter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDirectionFilter(key)}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-md transition-colors ${
                directionFilter === key
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {key === 'entity_to_gbs' && <ArrowUpRight className="w-3 h-3" />}
              {key === 'gbs_to_entity' && <ArrowDownLeft className="w-3 h-3" />}
              {label}
              <span className={`ml-1 text-xs ${directionFilter === key ? 'text-gray-300' : 'text-gray-400'}`}>
                {directionCounts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Status Filter tabs */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {f}
              <span className={`ml-1.5 text-xs ${filter === f ? 'text-blue-100' : 'text-gray-400'}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <MessageSquare className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">
                {filter === 'All' ? '등록된 문의가 없습니다.' : `${filter} 상태의 문의가 없습니다.`}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Direction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Entity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Author</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((item) => (
                  <VoeDetailRow key={item.id} item={item} onUpdate={load} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <VoeSubmitDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        onSubmitted={load}
      />
    </div>
  );
}
