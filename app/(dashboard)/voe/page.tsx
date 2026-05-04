'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Plus, RefreshCw, ChevronDown, ChevronUp, Clock, Send, Pencil, X, ArrowUpRight, ArrowDownLeft, Shield } from 'lucide-react';
import {
  getVoeInquiries,
  updateVoeStatus,
  updateVoeEntityResponse,
  updateVoeStatusOnly,
  updateVoeContent,
  markVoeAsSeen,
} from '@/lib/services/voeService';
import { VoeSubmitDialog } from '@/components/voe/VoeSubmitDialog';
import { getCurrentUserRoleInfo } from '@/lib/services/userRoleService';
import { supabase } from '@/lib/supabase/client';
import type { VoeInquiry, VoeStatus, VoeDirection } from '@/lib/types/voe';

const STATUS_STYLES: Record<VoeStatus, { label: string; bg: string; text: string }> = {
  Pending:       { label: 'Pending',     bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'In Progress': { label: 'In Progress', bg: 'bg-blue-100',   text: 'text-blue-700'   },
  Resolved:      { label: 'Resolved',    bg: 'bg-green-100',  text: 'text-green-700'  },
};

type FilterStatus = 'All' | VoeStatus;
const FILTERS: FilterStatus[] = ['All', 'Pending', 'In Progress', 'Resolved'];

type DirectionFilter = 'all' | 'entity_to_gbs' | 'gbs_to_entity';

/**
 * Direction 라벨은 보는 사람의 역할에 따라 달라진다.
 *   - entity_user: '내 문의' (entity_to_gbs) / 'GBS 문의' (gbs_to_entity)
 *   - gbs_admin: '법인 문의' (entity_to_gbs) / 'GBS 문의' (gbs_to_entity)
 *
 * scope = 'user' | 'admin' 으로 분기.
 */
type DirectionLabelScope = 'user' | 'admin';
const DIRECTION_LABELS_BY_SCOPE: Record<
  DirectionLabelScope,
  Record<VoeDirection, { label: string; icon: React.ReactNode; bg: string; text: string }>
> = {
  user: {
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
  },
  admin: {
    entity_to_gbs: {
      label: '법인 문의',
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
  },
};

type ResponseThreadItem = {
  header: string | null;
  content: string;
  timestampMs: number;
};

function parseKoreanTimestampFromHeader(header: string): number | null {
  const m = header.match(
    /^\[(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2}):(\d{2})\]/,
  );
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const meridiem = m[4];
  let hour = Number(m[5]);
  const minute = Number(m[6]);
  const second = Number(m[7]);

  if (meridiem === '오전') {
    if (hour === 12) hour = 0;
  } else if (hour < 12) {
    hour += 12;
  }
  return new Date(year, month, day, hour, minute, second).getTime();
}

function parseThreadBlocks(
  rawInput: string,
  appendTag: string,
  baseTimestampISO?: string | null,
): ResponseThreadItem[] {
  const raw = rawInput.trim();
  if (!raw) return [];

  const baseTs = baseTimestampISO ? new Date(baseTimestampISO).getTime() : 0;
  const chunks = raw.split('\n\n---\n').map((c) => c.trim()).filter(Boolean);
  return chunks.map((chunk, idx) => {
    const lines = chunk.split('\n');
    const first = lines[0]?.trim() ?? '';
    const hasHeader = /^\[.*\].*\(.+\)$/.test(first) && first.includes(appendTag);
    if (hasHeader) {
      return {
        header: first,
        content: lines.slice(1).join('\n').trim(),
        timestampMs: parseKoreanTimestampFromHeader(first) ?? baseTs + idx + 1,
      };
    }
    return {
      header: idx === 0 ? '최초 답변' : null,
      content: chunk,
      timestampMs: baseTs + idx,
    };
  });
}

function VoeDetailRow({
  item,
  onUpdate,
  directionScope,
}: {
  item: VoeInquiry;
  onUpdate: () => void;
  /** 라벨 표기 관점 — 'user' = 본인 법인 시점, 'admin' = 본사 시점 */
  directionScope: DirectionLabelScope;
}) {
  const direction = item.direction ?? 'entity_to_gbs';
  const isGbsToEntity = direction === 'gbs_to_entity';

  const [expanded, setExpanded] = useState(false);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [showStatusManager, setShowStatusManager] = useState(false);
  const [appendMode, setAppendMode] = useState(false);
  const [inquiryText, setInquiryText] = useState('');
  const [inquiryAuthor, setInquiryAuthor] = useState(item.author ?? '');
  const [responseText, setResponseText] = useState(item.response ?? '');
  const [respondedBy, setRespondedBy] = useState(item.responded_by ?? '');
  const [newStatus, setNewStatus] = useState<VoeStatus>(
    item.status === 'Pending' ? 'Resolved' : item.status
  );
  const [gbsStatusDraft, setGbsStatusDraft] = useState<VoeStatus>(item.status);
  const [gbsStatusSaving, setGbsStatusSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inquirySaving, setInquirySaving] = useState(false);
  const statusSectionRef = useRef<HTMLDivElement>(null);

  const s = STATUS_STYLES[item.status];
  const hasResponse = !!item.response;
  const contentThreads = parseThreadBlocks(item.content ?? '', '(추가 문의)', item.created_at);
  const responseThreads = parseThreadBlocks(item.response ?? '', '(추가 답변)', item.responded_at ?? item.updated_at);
  const timelineThreads = useMemo(() => {
    if (!isGbsToEntity) return [];
    const inquiryEntries = contentThreads.map((t, idx) => ({
      id: `q-${item.id}-${idx}`,
      kind: '문의' as const,
      timestampMs: t.timestampMs,
      header: t.header ?? '최초 문의',
      content: t.content,
    }));
    const responseEntries = responseThreads.map((t, idx) => ({
      id: `a-${item.id}-${idx}`,
      kind: '답변' as const,
      timestampMs: t.timestampMs,
      header: t.header ?? '최초 답변',
      content: t.content,
    }));
    return [...inquiryEntries, ...responseEntries].sort((a, b) => a.timestampMs - b.timestampMs);
  }, [contentThreads, isGbsToEntity, item.id, responseThreads]);

  useEffect(() => {
    setGbsStatusDraft(item.status);
  }, [item.id, item.status]);

  useEffect(() => {
    setInquiryAuthor(item.author ?? '');
  }, [item.id, item.author]);

  useEffect(() => {
    if (!expanded) {
      setShowStatusManager(false);
    }
  }, [expanded]);

  const handleSaveInquiry = async () => {
    if (!inquiryText.trim() || !inquiryAuthor.trim()) return;
    setInquirySaving(true);
    try {
      const nowLabel = new Date().toLocaleString('ko-KR');
      const mergedContent = `${item.content}\n\n---\n[${nowLabel}] ${inquiryAuthor.trim()} (추가 문의)\n${inquiryText.trim()}`;
      await updateVoeContent(item.id, mergedContent);
      setInquiryText('');
      setShowInquiryForm(false);
      onUpdate();
    } finally {
      setInquirySaving(false);
    }
  };

  const handleSaveResponse = async () => {
    if (!responseText.trim() || !respondedBy.trim()) return;
    setSaving(true);
    try {
      if (isGbsToEntity) {
        const nowLabel = new Date().toLocaleString('ko-KR');
        const mergedResponse =
          appendMode && hasResponse
            ? `${item.response}\n\n---\n[${nowLabel}] ${respondedBy.trim()} (추가 답변)\n${responseText.trim()}`
            : responseText.trim();
        await updateVoeEntityResponse(item.id, mergedResponse, respondedBy.trim());
      } else {
        await updateVoeStatus(item.id, newStatus, responseText.trim(), respondedBy.trim());
      }
      setShowResponseForm(false);
      setAppendMode(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const handleGbsStatusOnlySave = async () => {
    setGbsStatusSaving(true);
    try {
      await updateVoeStatusOnly(item.id, gbsStatusDraft);
      onUpdate();
    } finally {
      setGbsStatusSaving(false);
    }
  };

  const handleCancelResponse = () => {
    setResponseText(item.response ?? '');
    setRespondedBy(item.responded_by ?? '');
    setNewStatus(item.status === 'Pending' ? 'Resolved' : item.status);
    setShowResponseForm(false);
    setAppendMode(false);
  };

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3">
          {(() => {
            const d = DIRECTION_LABELS_BY_SCOPE[directionScope][direction];
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
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-500">문의 내용</p>
                  {isGbsToEntity && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowInquiryForm((v) => !v);
                      }}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      추가 문의
                    </button>
                  )}
                </div>
                {isGbsToEntity ? (
                  <div className="space-y-2">
                    {timelineThreads.map((thread) => (
                      <div
                        key={thread.id}
                        className={thread.kind === '문의'
                          ? 'rounded-lg border border-gray-200 bg-white p-2.5'
                          : 'rounded-lg border border-blue-100 bg-white p-2.5'}
                      >
                        <p className={thread.kind === '문의'
                          ? 'text-[10px] font-medium text-gray-600 mb-1'
                          : 'text-[10px] font-medium text-blue-600 mb-1'}>
                          {thread.kind} · {thread.header}
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{thread.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                )}
                {isGbsToEntity && showInquiryForm && (
                  <div
                    className="mt-3 border-t border-gray-200 pt-3 space-y-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs font-medium text-blue-700">GBS 추가 문의 작성</p>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">작성자 *</label>
                        <input
                          type="text"
                          value={inquiryAuthor}
                          onChange={(e) => setInquiryAuthor(e.target.value)}
                          placeholder="이름"
                          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">추가 문의 내용 *</label>
                        <textarea
                          value={inquiryText}
                          onChange={(e) => setInquiryText(e.target.value)}
                          rows={3}
                          placeholder="기존 문의 아래에 추가할 내용을 입력하세요."
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowInquiryForm(false);
                          setInquiryText('');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveInquiry}
                        disabled={inquirySaving || !inquiryAuthor.trim() || !inquiryText.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {inquirySaving ? '저장 중...' : '추가 문의 저장'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 기존 답변 표시 */}
              {hasResponse && !showResponseForm && (
                <div className="border-t border-blue-100 pt-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                      <p className="text-xs font-medium text-blue-600">
                        {isGbsToEntity ? '법인 답변' : 'GBS 답변'}
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
                    <div className="flex items-center gap-2">
                      {isGbsToEntity && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAppendMode(true);
                            setResponseText('');
                            setShowResponseForm(true);
                          }}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Send className="w-3 h-3" />
                          추가 답변
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAppendMode(false);
                          setResponseText(item.response ?? '');
                          setShowResponseForm(true);
                        }}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        수정
                      </button>
                      {isGbsToEntity && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStatusManager(true);
                            statusSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className="text-xs text-amber-700 hover:text-amber-900 transition-colors"
                        >
                          상태 변경
                        </button>
                      )}
                    </div>
                  </div>
                  {isGbsToEntity ? null : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.response}</p>
                  )}
                </div>
              )}

              {/* 답변 대기 안내 + 답변 달기 버튼 */}
              {!hasResponse && !showResponseForm && (
                <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-yellow-600">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {isGbsToEntity
                        ? '법인 답변을 기다리고 있습니다.'
                        : '아직 답변이 등록되지 않았습니다.'}
                    </span>
                  </div>
                  {/* 나중에 권한 체크로 교체 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setAppendMode(false); setShowResponseForm(true); }}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    {isGbsToEntity ? '답변하기' : '답변 달기'}
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
                      {isGbsToEntity
                        ? appendMode
                          ? '법인 추가 답변 작성'
                          : hasResponse
                          ? '법인 답변 수정'
                          : '법인 답변 작성'
                        : hasResponse
                          ? '답변 수정'
                          : 'GBS 답변 작성'}
                    </p>
                  </div>

                  {isGbsToEntity && (
                    <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                      GBS 문의는 <strong>상태 변경 없이</strong> 답변만 저장됩니다. 문의 종료·진행 상태는 아래{' '}
                      <strong>상태 관리 (GBS)</strong>에서만 변경할 수 있습니다.
                    </p>
                  )}

                  <div className={isGbsToEntity ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3'}>
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
                    {!isGbsToEntity && (
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
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">답변 내용 *</label>
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder={appendMode ? '기존 답변 아래에 추가할 내용을 입력하세요.' : '문의에 대한 답변을 작성해주세요.'}
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
                      {saving ? '저장 중...' : appendMode ? '추가 답변 저장' : isGbsToEntity ? '답변만 저장' : '답변 저장'}
                    </button>
                  </div>
                </div>
              )}

              {/* GBS 문의: 상태는 GBS 담당자만 별도 저장 (법인 답변 폼과 분리) */}
              {isGbsToEntity && showStatusManager && (
                <div
                  ref={statusSectionRef}
                  className="border-t border-amber-100 pt-4 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-amber-700" />
                    <p className="text-xs font-semibold text-amber-900">상태 관리 (GBS)</p>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    Pending / In Progress / Resolved 는 GBS 담당자가 확정합니다. 법인 답변 저장과 별개입니다.
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[180px]">
                      <label className="block text-xs text-gray-500 mb-1">문의 상태</label>
                      <select
                        value={gbsStatusDraft}
                        onChange={(e) => setGbsStatusDraft(e.target.value as VoeStatus)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleGbsStatusOnlySave}
                      disabled={gbsStatusSaving || gbsStatusDraft === item.status}
                      className="px-3 py-1.5 text-sm font-medium text-amber-900 bg-amber-100 border border-amber-200 rounded-lg hover:bg-amber-200 disabled:opacity-50 disabled:hover:bg-amber-100"
                    >
                      {gbsStatusSaving ? '저장 중...' : '상태만 저장'}
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
  /** entity_user 인 경우 본인 법인 식별자(이름/코드). gbs_admin 이면 null = 전체 보기 */
  const [scopeIdentifiers, setScopeIdentifiers] = useState<Set<string> | null>(null);
  const [scopeLabel, setScopeLabel] = useState<string>('');
  /** 본인 담당 법인 이름 목록 — 새 문의 등록 시 자동 채움 (entity_user 만) */
  const [myEntityNames, setMyEntityNames] = useState<string[] | undefined>(undefined);
  /** 로그인 사용자 이름 — 작성자 자동 입력 */
  const [myDisplayName, setMyDisplayName] = useState<string>('');
  /** 이번 방문에서 새로 보이는 항목 수 — 페이지 진입 시 한 번만 계산되어 배너에 표시 */
  const [newSinceLastVisit, setNewSinceLastVisit] = useState<number>(0);

  const load = async () => {
    setLoading(true);
    try {
      // 1) 권한 조회 — entity_user 면 본인 법인 식별자 집합 생성
      const roleInfo = await getCurrentUserRoleInfo();
      let identifiers: Set<string> | null = null;
      let entityNamesForDialog: string[] | undefined = undefined;
      if (!roleInfo.canSeeAll) {
        // entity_user: code + name 모두 매칭 대상
        if (roleInfo.entityCodes.length === 0) {
          identifiers = new Set();
        } else {
          const { data: subs } = await supabase
            .from('subsidiaries')
            .select('code, name')
            .in('code', roleInfo.entityCodes);
          const rows = (subs ?? []) as { code: string; name: string }[];
          identifiers = new Set();
          rows.forEach((s) => {
            identifiers!.add(s.code);
            identifiers!.add(s.name);
          });
          // 새 문의 다이얼로그에 자동 채울 법인 이름 목록
          entityNamesForDialog = rows.map((s) => s.name);
        }
        setScopeLabel(roleInfo.entityCodes.join(', '));
      } else {
        setScopeLabel('');
      }
      setScopeIdentifiers(identifiers);
      setMyEntityNames(entityNamesForDialog);

      // 1-b) 로그인 사용자 이름 조회 (작성자 자동 채우기용)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('name')
          .eq('id', user.id)
          .maybeSingle();
        const name = (profile as { name?: string } | null)?.name;
        setMyDisplayName(name || user.email?.split('@')[0] || '');
      }

      // 2) VOE 데이터 조회 후 entity 필터 적용
      const data = await getVoeInquiries();
      const scoped = identifiers
        ? data.filter((v) => identifiers!.has(v.entity_name))
        : data;
      setInquiries(scoped);
    } catch (err) {
      console.error('VOE load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // 페이지 진입 시: 마지막 방문 이후 새로 갱신된 항목 수 계산 → 배너 표시 → 본 시각 갱신
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lastSeen = typeof window !== 'undefined'
        ? window.localStorage.getItem('gbs_voe_last_seen_at') ?? '1970-01-01T00:00:00.000Z'
        : '1970-01-01T00:00:00.000Z';
      // 권한·필터 결과를 받기 전이라도 lastSeen 만 읽어서 표시용 카운트로 활용 가능.
      // 정확한 카운트는 inquiries 가 로드된 뒤 useEffect 로 다시 계산.
      void lastSeen; // 위 코드는 의도적 — 실제 계산은 아래 useEffect
      if (cancelled) return;
    })();
    void load();
    return () => { cancelled = true; };
  }, []);

  // inquiries 가 로드된 뒤 lastSeen 기준으로 새 항목 카운트 계산.
  // 본 후에는 markVoeAsSeen() 으로 lastSeen 을 현재 시각으로 갱신.
  useEffect(() => {
    if (loading || inquiries.length === 0) {
      // 로딩 중이거나 데이터가 0건이면 배너 숨김. 단 0건이어도 lastSeen 은 갱신해야 사이드바 배지가 사라짐.
      if (!loading) markVoeAsSeen();
      return;
    }
    const lastSeen = typeof window !== 'undefined'
      ? window.localStorage.getItem('gbs_voe_last_seen_at') ?? '1970-01-01T00:00:00.000Z'
      : '1970-01-01T00:00:00.000Z';
    const lastSeenTs = new Date(lastSeen).getTime();
    const newCount = inquiries.filter((v) => {
      const ts = v.updated_at ? new Date(v.updated_at).getTime() : 0;
      return ts > lastSeenTs;
    }).length;
    setNewSinceLastVisit(newCount);
    // 페이지를 보고 있다는 의미이므로 즉시 'seen' 처리 — 다음 사이드바 갱신 시 배지 0
    markVoeAsSeen();
  }, [loading, inquiries]);

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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">VOE</h1>
              {scopeLabel && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono font-semibold">
                  {scopeLabel}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              Voice of Entity — 법인 담당자 문의
              {scopeLabel && <span className="ml-1 text-gray-500">· 본인 법인 항목만 표시</span>}
            </p>
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

        {/* 새 답변/문의 알림 배너 — 마지막 방문 이후 갱신된 항목이 있을 때만 */}
        {newSinceLastVisit > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-200 text-blue-700 flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-900">
                {scopeIdentifiers
                  ? `새 답변·문의 ${newSinceLastVisit}건이 도착했습니다.`
                  : `법인으로부터 새 답변·문의 ${newSinceLastVisit}건이 도착했습니다.`}
              </p>
              <p className="text-xs text-blue-700">
                마지막 방문 이후 업데이트된 항목입니다. 아래 목록에서 확인하세요.
              </p>
            </div>
            <button
              onClick={() => setNewSinceLastVisit(0)}
              className="text-xs text-blue-700 font-medium hover:underline whitespace-nowrap px-2 py-1"
            >
              확인
            </button>
          </div>
        )}

        {/* 방향 탭 — admin/user 에 따라 라벨 분기 */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          {([
            { key: 'all', label: '전체' },
            {
              key: 'entity_to_gbs',
              label: scopeIdentifiers ? '내 문의' : '법인 문의',
            },
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
                  <VoeDetailRow
                    key={item.id}
                    item={item}
                    onUpdate={load}
                    directionScope={scopeIdentifiers ? 'user' : 'admin'}
                  />
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
        entityNames={myEntityNames}
        defaultAuthor={myDisplayName}
      />
    </div>
  );
}
