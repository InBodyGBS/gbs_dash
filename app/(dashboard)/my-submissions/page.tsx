'use client';

/**
 * My Submissions
 * 법인 사용자가 본인 법인의 모든 카테고리/월별 제출 현황을 한 화면에서 확인하는 페이지.
 * - 분기말 카테고리(3·6·9·12월)와 월별 카테고리를 통합해 매트릭스로 표시
 * - 셀: 마감일·D-day·상태·최신 파일
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Download, FileSpreadsheet, RefreshCw, Lock } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { supabase } from '@/lib/supabase/client';
import {
  getMySubmissionsOverview,
  getSubmissionUrl,
  type MySubmissionCell,
  type MySubmissionsOverview,
  type MySubmissionStatus,
} from '@/lib/services/submissionService';
import {
  getCurrentUserRoleInfo,
  type CurrentUserRoleInfo,
} from '@/lib/services/userRoleService';
import {
  CLOSING_CATEGORIES_QUARTER_END,
  CLOSING_CATEGORIES_REGULAR,
  getCategoryById,
  isQuarterEndMonth,
  type ClosingCategory,
} from '@/lib/constants/closing-categories';
import type { Subsidiary } from '@/lib/supabase/types';

const STORAGE_KEY = 'my-submissions-filters';
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const STATUS_META: Record<
  MySubmissionStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  submitted: { label: '제출완료', bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  upcoming: { label: '마감임박', bg: '#FFFBEB', text: '#B45309', border: '#FCD34D' },
  overdue: { label: '지연', bg: '#FEF2F2', text: '#B91C1C', border: '#FCA5A5' },
  pending: { label: '대기', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' },
  none: { label: '해당없음', bg: '#FAFAFA', text: '#94A3B8', border: '#E2E8F0' },
};

interface SavedFilters {
  subsidiaryId: string;
  fiscalYear: string;
}

const loadSavedFilters = (): SavedFilters | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedFilters>;
    if (!parsed.subsidiaryId || !parsed.fiscalYear) return null;
    return { subsidiaryId: parsed.subsidiaryId, fiscalYear: parsed.fiscalYear };
  } catch {
    return null;
  }
};

const persistFilters = (filters: SavedFilters) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* ignore */
  }
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

/** 분기말+월별 카테고리 합집합 (중복 제거, 표시 순서는 분기말 먼저) */
const ALL_CATEGORIES: ClosingCategory[] = (() => {
  const seen = new Set<string>();
  const out: ClosingCategory[] = [];
  for (const c of [...CLOSING_CATEGORIES_QUARTER_END, ...CLOSING_CATEGORIES_REGULAR]) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
})();

const isCategoryActiveForMonth = (category: ClosingCategory, month: number): boolean => {
  const isQEnd = isQuarterEndMonth(month);
  if (isQEnd) {
    return CLOSING_CATEGORIES_QUARTER_END.some((c) => c.id === category.id);
  }
  return CLOSING_CATEGORIES_REGULAR.some((c) => c.id === category.id);
};

export default function MySubmissionsPage() {
  const router = useRouter();
  const [allSubsidiaries, setAllSubsidiaries] = useState<Subsidiary[]>([]);
  const [roleInfo, setRoleInfo] = useState<CurrentUserRoleInfo | null>(null);
  const [subsidiaryId, setSubsidiaryId] = useState<string>('');
  const [fiscalYear, setFiscalYear] = useState<string>(String(new Date().getFullYear()));
  const [overview, setOverview] = useState<MySubmissionsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // 마운트 후 저장된 필터 복원 (SSR/CSR 일치 유지)
  useEffect(() => {
    const saved = loadSavedFilters();
    if (saved) {
      setSubsidiaryId(saved.subsidiaryId);
      setFiscalYear(saved.fiscalYear);
    }
    setHydrated(true);
  }, []);

  // 법인 목록 + 사용자 역할 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [subsRes, role] = await Promise.all([
        supabase.from('subsidiaries').select('*').order('name'),
        getCurrentUserRoleInfo(),
      ]);
      if (cancelled) return;

      if (subsRes.error) {
        toast.error('법인 목록 로드 실패', { description: subsRes.error.message });
        return;
      }
      const list = (subsRes.data || []) as Subsidiary[];
      setAllSubsidiaries(list);
      setRoleInfo(role);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 권한 범위 내 법인만 노출 (entity_user 면 자기 entity_code 만)
  const subsidiaries = useMemo(() => {
    if (!roleInfo || roleInfo.canSeeAll) return allSubsidiaries;
    if (roleInfo.entityCodes.length === 0) return [];
    const allowed = new Set(roleInfo.entityCodes);
    return allSubsidiaries.filter((s) => allowed.has(s.code));
  }, [allSubsidiaries, roleInfo]);

  const isLockedToEntity =
    Boolean(roleInfo) &&
    !roleInfo!.canSeeAll &&
    subsidiaries.length === 1;

  // 권한·목록 변경 시 셀렉터 기본값 보정
  useEffect(() => {
    if (!hydrated || subsidiaries.length === 0) return;
    const isCurrentValid = subsidiaries.some((s) => s.id === subsidiaryId);
    if (!isCurrentValid) {
      const saved = loadSavedFilters();
      const fallback =
        saved?.subsidiaryId && subsidiaries.some((s) => s.id === saved.subsidiaryId)
          ? saved.subsidiaryId
          : subsidiaries[0].id;
      setSubsidiaryId(fallback);
    }
  }, [hydrated, subsidiaries, subsidiaryId]);

  const loadOverview = useCallback(async () => {
    if (!subsidiaryId || !fiscalYear) return;
    setLoading(true);
    try {
      const data = await getMySubmissionsOverview(subsidiaryId, fiscalYear);
      setOverview(data);
    } catch (error) {
      toast.error('현황 로드 실패', { description: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [subsidiaryId, fiscalYear]);

  useEffect(() => {
    if (!hydrated) return;
    if (subsidiaryId && fiscalYear) {
      persistFilters({ subsidiaryId, fiscalYear });
      void loadOverview();
    }
  }, [hydrated, subsidiaryId, fiscalYear, loadOverview]);

  // (month, category) → cell 룩업
  const cellLookup = useMemo(() => {
    const map = new Map<string, MySubmissionCell>();
    if (!overview) return map;
    for (const c of overview.cells) {
      map.set(`${c.month}|${c.category}`, c);
    }
    return map;
  }, [overview]);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return [current + 1, current, current - 1, current - 2].map((y) => String(y));
  }, []);

  const handleDownload = async (cell: MySubmissionCell) => {
    if (!cell.latestSubmission) return;
    try {
      const url = await getSubmissionUrl(cell.latestSubmission.file_path);
      const link = document.createElement('a');
      link.href = url;
      link.download = cell.latestSubmission.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error('다운로드 실패', { description: getErrorMessage(error) });
    }
  };

  /**
   * 셀 클릭 → Submission 페이지 딥링크
   * - 신규 query params (year/month/subsidiary_id/category) 로 이동
   * - Submission 페이지가 query params 를 우선 적용한 뒤 localStorage 에 동기화
   */
  const handleCellNavigate = useCallback(
    (cell: MySubmissionCell) => {
      const params = new URLSearchParams({
        year: fiscalYear,
        month: String(cell.month),
        subsidiary_id: subsidiaryId,
        category: cell.category,
      });
      router.push(`/quarterly-closing/submission?${params.toString()}`);
    },
    [fiscalYear, subsidiaryId, router],
  );

  const selectedSubsidiary = subsidiaries.find((s) => s.id === subsidiaryId);

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Submissions</h1>
            <p className="text-sm text-gray-600 mt-1">
              법인별 분기·월 마감 자료 제출 현황을 한눈에 확인합니다.
            </p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-gray-600 flex items-center gap-1">
                Entity
                {isLockedToEntity && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                    <Lock className="h-3 w-3" />
                    역할 자동 적용
                  </span>
                )}
              </Label>
              <Select
                value={subsidiaryId}
                onValueChange={setSubsidiaryId}
                disabled={isLockedToEntity || subsidiaries.length === 0}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="법인 선택" />
                </SelectTrigger>
                <SelectContent>
                  {subsidiaries.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-gray-600">Fiscal Year</Label>
              <Select value={fiscalYear} onValueChange={setFiscalYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void loadOverview()}
              disabled={loading}
              title="새로고침"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </header>

        <SummaryCards overview={overview} loading={loading} />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {selectedSubsidiary?.name ?? 'Entity'} · {fiscalYear} 회계연도
              </CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                각 셀은 귀속월(1–12) × 카테고리. 마감일·상태·최신 파일을 표시합니다.
              </p>
            </div>
            <Legend />
          </CardHeader>
          <CardContent>
            {roleInfo && !roleInfo.canSeeAll && subsidiaries.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">
                연결된 법인이 없습니다. GBS 관리자에게 권한 설정을 요청해 주세요.
              </div>
            ) : (
              <SubmissionsMatrix
                cellLookup={cellLookup}
                loading={loading}
                hasData={Boolean(overview)}
                onDownload={handleDownload}
                onCellNavigate={handleCellNavigate}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// 요약 카드
// -----------------------------------------------------------------------------
function SummaryCards({
  overview,
  loading,
}: {
  overview: MySubmissionsOverview | null;
  loading: boolean;
}) {
  const items: Array<{ key: MySubmissionStatus; label: string; value: number }> = overview
    ? [
        { key: 'submitted', label: '제출완료', value: overview.totals.submitted },
        { key: 'upcoming', label: '마감임박 (D-7 이내)', value: overview.totals.upcoming },
        { key: 'overdue', label: '지연', value: overview.totals.overdue },
        { key: 'pending', label: '대기', value: overview.totals.pending },
      ]
    : [];

  if (!overview && !loading) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => {
        const meta = STATUS_META[it.key];
        return (
          <Card key={it.key}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: meta.text }}
                />
                <div className="flex-1">
                  <div className="text-xs text-gray-600">{it.label}</div>
                  <div className="text-2xl font-semibold text-gray-900 mt-0.5">{it.value}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
      {loading && items.length === 0 && (
        <Card>
          <CardContent className="py-4 text-sm text-gray-500">로딩 중…</CardContent>
        </Card>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      {(['submitted', 'upcoming', 'overdue', 'pending', 'none'] as MySubmissionStatus[]).map((k) => {
        const meta = STATUS_META[k];
        return (
          <span key={k} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: meta.text }}
            />
            <span className="text-gray-600">{meta.label}</span>
          </span>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// 매트릭스
// -----------------------------------------------------------------------------
function SubmissionsMatrix({
  cellLookup,
  loading,
  hasData,
  onDownload,
  onCellNavigate,
}: {
  cellLookup: Map<string, MySubmissionCell>;
  loading: boolean;
  hasData: boolean;
  onDownload: (cell: MySubmissionCell) => void;
  onCellNavigate: (cell: MySubmissionCell) => void;
}) {
  if (loading && !hasData) {
    return (
      <div className="py-12 text-center text-sm text-gray-500">데이터를 불러오는 중입니다…</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white text-left px-3 py-2 border-b border-r border-gray-200 min-w-[180px]">
              Category
            </th>
            {MONTHS.map((m) => (
              <th
                key={m}
                className={cn(
                  'px-2 py-2 border-b border-gray-200 text-center font-medium text-gray-700 min-w-[120px]',
                  isQuarterEndMonth(m) && 'bg-blue-50',
                )}
              >
                {m}월
                {isQuarterEndMonth(m) && (
                  <span className="block text-[10px] text-blue-700 font-normal">분기말</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_CATEGORIES.map((cat) => (
            <tr key={cat.id}>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-white text-left px-3 py-2 border-b border-r border-gray-200"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-medium text-gray-900">{cat.label}</span>
                </span>
              </th>
              {MONTHS.map((m) => {
                const active = isCategoryActiveForMonth(cat, m);
                const cell = cellLookup.get(`${m}|${cat.id}`);
                return (
                  <td
                    key={m}
                    className={cn(
                      'p-0 border-b border-gray-200 align-top',
                      !active && 'bg-gray-50/60',
                    )}
                  >
                    {active ? (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          onCellNavigate(cell ?? {
                            month: m,
                            category: cat.id,
                            dueDate: null,
                            dueConfirmed: false,
                            status: 'none',
                            daysToDue: null,
                            latestSubmission: null,
                            submissionCount: 0,
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onCellNavigate(cell ?? {
                              month: m,
                              category: cat.id,
                              dueDate: null,
                              dueConfirmed: false,
                              status: 'none',
                              daysToDue: null,
                              latestSubmission: null,
                              submissionCount: 0,
                            });
                          }
                        }}
                        title={`${cat.label} · ${m}월 제출 페이지로 이동`}
                        className="w-full h-full px-2 py-2 text-left cursor-pointer hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <CellContent cell={cell} onDownload={onDownload} />
                      </div>
                    ) : (
                      <div className="px-2 py-2 text-center text-[11px] text-gray-300">—</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellContent({
  cell,
  onDownload,
}: {
  cell: MySubmissionCell | undefined;
  onDownload: (cell: MySubmissionCell) => void;
}) {
  if (!cell) {
    const meta = STATUS_META.none;
    return (
      <div className="flex flex-col items-center gap-1">
        <Badge
          className="text-[10px] px-1.5 py-0"
          style={{
            backgroundColor: meta.bg,
            color: meta.text,
            border: `1px solid ${meta.border}`,
          }}
        >
          {meta.label}
        </Badge>
      </div>
    );
  }

  const meta = STATUS_META[cell.status];
  const dueLabel = cell.dueDate ? format(parseISO(cell.dueDate), 'MM/dd') : '—';
  const dDay =
    cell.daysToDue == null
      ? null
      : cell.daysToDue === 0
        ? 'D-day'
        : cell.daysToDue > 0
          ? `D-${cell.daysToDue}`
          : `D+${Math.abs(cell.daysToDue)}`;
  const category = getCategoryById(cell.category);

  return (
    <div className="flex flex-col gap-1.5">
      <Badge
        className="text-[10px] px-1.5 py-0 self-start"
        style={{
          backgroundColor: meta.bg,
          color: meta.text,
          border: `1px solid ${meta.border}`,
        }}
      >
        {meta.label}
        {dDay && cell.status !== 'submitted' && cell.status !== 'none' ? ` · ${dDay}` : ''}
      </Badge>
      <div className="text-[11px] text-gray-600">
        마감 <span className="font-medium text-gray-800">{dueLabel}</span>
        {cell.dueDate && cell.dueConfirmed && (
          <span className="ml-1 text-blue-700">✓확정</span>
        )}
      </div>
      {cell.latestSubmission ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDownload(cell);
          }}
          className="group flex items-start gap-1 text-left"
          title={`다운로드: ${cell.latestSubmission.file_name}`}
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
          <span className="text-[11px] text-gray-700 group-hover:text-blue-700 group-hover:underline truncate max-w-[120px]">
            {cell.latestSubmission.file_name}
          </span>
          <Download className="h-3 w-3 text-gray-400 group-hover:text-blue-700 flex-shrink-0 mt-0.5" />
        </button>
      ) : (
        <div className="text-[11px] text-gray-400">
          {category ? '미제출' : ''}
        </div>
      )}
      {cell.submissionCount > 1 && (
        <div className="text-[10px] text-gray-500">
          v{cell.latestSubmission?.version ?? cell.submissionCount} · 누적 {cell.submissionCount}회
        </div>
      )}
    </div>
  );
}
