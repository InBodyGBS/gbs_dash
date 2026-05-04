'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Calendar,
  Megaphone,
  MessageSquare,
  ChevronRight,
  ListChecks,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CircleDashed,
  ShieldCheck,
  Building2,
  UserPlus,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { ScheduleCalendar } from '@/components/dashboard/ScheduleCalendar';
import { getVoeInquiries, getUnreadVoeCount } from '@/lib/services/voeService';
import { getCurrentUserRoleInfo } from '@/lib/services/userRoleService';
import { getPendingUserCount } from '@/lib/services/userManagementService';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';
import { useT } from '@/lib/contexts/LanguageContext';
import type { VoeInquiry, VoeStatus } from '@/lib/types/voe';

/* ────────────────────────────────────────────────────────────────────────────
 * 두 가지 뷰 모델
 *  - UserDeadline    : entity_user 가 보는 "내가 제출해야 할 것"
 *  - AdminDeadline   : gbs_admin 이 보는 "법인별 제출 진행률"
 * ──────────────────────────────────────────────────────────────────────────── */

interface UserDeadline {
  id: string;
  planned_date: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  /** 'submitted' | 'pending' | 'overdue' */
  status: 'submitted' | 'pending' | 'overdue';
}

interface AdminDeadline {
  /** date|category 합성 key */
  key: string;
  planned_date: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  totalSubs: number;
  submittedSubs: number;
}

interface EntityProgress {
  subsidiaryId: string;
  subsidiaryName: string;
  total: number;
  submitted: number;
  /** 가장 가까운 미제출 마감의 D-day. 없으면 null */
  earliestPendingDday: number | null;
}

const VOE_STATUS_STYLES: Record<VoeStatus, { bg: string; text: string }> = {
  Pending:       { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  'In Progress': { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  Resolved:      { bg: 'bg-green-100',  text: 'text-green-700'  },
};

/** D-day 계산 (오늘 기준) */
function calcDday(plannedDate: string): { label: string; tone: 'urgent' | 'soon' | 'normal' } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = plannedDate.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { label: 'D-day', tone: 'urgent' };
  if (diffDays < 0) return { label: `D+${Math.abs(diffDays)}`, tone: 'urgent' };
  if (diffDays <= 3) return { label: `D-${diffDays}`, tone: 'urgent' };
  if (diffDays <= 7) return { label: `D-${diffDays}`, tone: 'soon' };
  return { label: `D-${diffDays}`, tone: 'normal' };
}

/** 진행률(0~1)에 따른 색상/라벨 */
function progressTone(rate: number): { bar: string; text: string } {
  if (rate >= 1) return { bar: 'bg-emerald-500', text: 'text-emerald-700' };
  if (rate >= 0.5) return { bar: 'bg-amber-500', text: 'text-amber-700' };
  return { bar: 'bg-red-500', text: 'text-red-700' };
}

/**
 * schedule_item 의 planned_date 로부터 "유효 제출 윈도우" 산출.
 *
 * FC 컨벤션: 캘린더 N 월의 schedule_item = (N-1)월 귀속 마감.
 * 윈도우 = "귀속월 25일" ~ "그 다음 캘린더월 말일 23:59:59"
 *   - 예: 캘린더 5/12 (귀속 4월) → 윈도우: 2026-04-25 00:00 ~ 2026-05-31 23:59
 *
 * 같은 분기(quarter) 안에서 다른 귀속월 제출이 잘못 매칭되는 문제를 방지.
 */
function getSubmissionWindow(plannedDate: string): { start: Date; end: Date } {
  const [py, pm] = plannedDate.split('-').map(Number);
  // 귀속월 = 캘린더월 - 1 (1-12, 1월이면 전년 12월)
  let attribMonth = pm - 1;
  let attribYear = py;
  if (attribMonth === 0) {
    attribMonth = 12;
    attribYear = py - 1;
  }
  // 시작: 귀속월 25일 00:00 (귀속월 1-indexed → monthIndex = attribMonth - 1)
  const start = new Date(attribYear, attribMonth - 1, 25, 0, 0, 0, 0);
  // 끝: 그 다음 캘린더월 말일 23:59:59
  //   = (귀속월 + 1) 1-indexed 의 말일
  //   = monthIndex (attribMonth + 1) 의 0일 = monthIndex (attribMonth) 의 말일
  //   ※ 귀속월 12 일 때도 JS Date 의 month overflow 가 자동 처리해줌
  const end = new Date(attribYear, attribMonth + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export default function DashboardPage() {
  const t = useT();
  const [stats, setStats] = useState({ announcements: 0, upcoming: 0, pendingVoe: 0 });
  const [userDeadlines, setUserDeadlines] = useState<UserDeadline[]>([]);
  const [adminDeadlines, setAdminDeadlines] = useState<AdminDeadline[]>([]);
  const [entityProgress, setEntityProgress] = useState<EntityProgress[]>([]);
  const [taskList, setTaskList] = useState<VoeInquiry[]>([]);
  /** admin 전용 — 승인 대기 사용자 수 */
  const [pendingUserCount, setPendingUserCount] = useState<number>(0);
  /** 모든 사용자 — 마지막 VOE 방문 이후 새 답변/문의 수 */
  const [voeUnreadCount, setVoeUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  /** 'admin' | 'user' — Upcoming Deadlines 위젯 모드 */
  const [viewMode, setViewMode] = useState<'admin' | 'user'>('admin');
  /** entity_user 인 경우 본인 법인 코드(들) */
  const [scopeLabel, setScopeLabel] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const in15Days = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // ── 권한 조회
      const roleInfo = await getCurrentUserRoleInfo();
      const isUserMode = !roleInfo.canSeeAll; // entity_user 면 user 뷰
      setViewMode(isUserMode ? 'user' : 'admin');

      // admin 모드면 승인 대기 사용자 수 조회 (배너용)
      if (!isUserMode) {
        getPendingUserCount().then((cnt) => setPendingUserCount(cnt));
      } else {
        setPendingUserCount(0);
      }

      // 모든 사용자 — VOE 미확인 카운트 (배너용)
      getUnreadVoeCount().then((cnt) => setVoeUnreadCount(cnt));

      // ── entity_user → entity_code → subsidiary_id 매핑
      // 추가로: VOE entity_name 필터용 식별자 집합도 같이 만든다 (code + name 모두 포함)
      let allowedSubsidiaryIds: string[] | null = null;
      let allowedEntityIdentifiers: Set<string> | null = null;
      if (isUserMode) {
        if (roleInfo.entityCodes.length === 0) {
          allowedSubsidiaryIds = [];
          allowedEntityIdentifiers = new Set();
        } else {
          const { data: subs } = await supabase
            .from('subsidiaries')
            .select('id, code, name')
            .in('code', roleInfo.entityCodes);
          const rows = (subs ?? []) as { id: string; code: string; name: string }[];
          allowedSubsidiaryIds = rows.map((s) => s.id);
          // VOE.entity_name 이 'InBody Japan' 같은 이름인 경우와 'JP' 같은 코드인 경우 둘 다 매칭
          allowedEntityIdentifiers = new Set();
          rows.forEach((s) => {
            allowedEntityIdentifiers!.add(s.code);
            allowedEntityIdentifiers!.add(s.name);
          });
        }
        setScopeLabel(roleInfo.entityCodes.join(', '));
      } else {
        setScopeLabel('');
      }

      // ── 1) Announcements 카운트
      const announcementsQuery = supabase
        .from('announcements')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', last7Days);

      // ── 2) schedule_items 조회 (15일 이내, status='planned')
      let upcomingListQuery = supabase
        .from('schedule_items')
        .select('id, planned_date, category, subsidiary_id, quarter_id', { count: 'exact' })
        .eq('status', 'planned')
        .gte('planned_date', today)
        .lte('planned_date', in15Days)
        .order('planned_date', { ascending: true })
        .limit(200);

      if (isUserMode) {
        if (!allowedSubsidiaryIds || allowedSubsidiaryIds.length === 0) {
          upcomingListQuery = upcomingListQuery.in('subsidiary_id', ['00000000-0000-0000-0000-000000000000']);
        } else {
          upcomingListQuery = upcomingListQuery.in('subsidiary_id', allowedSubsidiaryIds);
        }
      }

      const [announcementsResult, upcomingListResult, voeResult] = await Promise.all([
        announcementsQuery,
        upcomingListQuery,
        getVoeInquiries().catch(() => []),
      ]);

      type ScheduleRow = {
        id: string;
        planned_date: string;
        category: string;
        subsidiary_id: string;
        quarter_id: string | null;
      };
      const scheduleRows = ((upcomingListResult.data ?? []) as ScheduleRow[]).filter(
        (r) => r.quarter_id !== null,
      );

      // ── 3) submissions 조회 (해당 schedule_items 의 quarter_id 기준)
      //   submitted_at 까지 함께 가져와서 "귀속월 윈도우" 안의 제출만 매칭
      const quarterIds = [...new Set(scheduleRows.map((r) => r.quarter_id!).filter(Boolean))];
      const submittedTimes = new Map<string, string[]>(); // key: quarter|sub|category → submitted_at[]
      if (quarterIds.length > 0) {
        let subQuery = supabase
          .from('submissions')
          .select('quarter_id, subsidiary_id, category, submitted_at')
          .in('quarter_id', quarterIds);

        if (isUserMode && allowedSubsidiaryIds && allowedSubsidiaryIds.length > 0) {
          subQuery = subQuery.in('subsidiary_id', allowedSubsidiaryIds);
        }

        const { data: subData } = await subQuery;
        const subRows = (subData ?? []) as Array<{
          quarter_id: string;
          subsidiary_id: string;
          category: string;
          submitted_at: string | null;
        }>;
        for (const s of subRows) {
          if (!s.submitted_at) continue;
          const key = `${s.quarter_id}|${s.subsidiary_id}|${s.category}`;
          const arr = submittedTimes.get(key) ?? [];
          arr.push(s.submitted_at);
          submittedTimes.set(key, arr);
        }
      }

      /** 특정 schedule_item 에 대해 "유효 윈도우 내 제출" 존재 여부 */
      const isSubmittedInWindow = (
        quarterId: string,
        subId: string,
        category: string,
        plannedDate: string,
      ): boolean => {
        const key = `${quarterId}|${subId}|${category}`;
        const times = submittedTimes.get(key);
        if (!times || times.length === 0) return false;
        const win = getSubmissionWindow(plannedDate);
        return times.some((t) => {
          const ts = new Date(t).getTime();
          return ts >= win.start.getTime() && ts <= win.end.getTime();
        });
      };

      const todayDateOnly = new Date();
      todayDateOnly.setHours(0, 0, 0, 0);

      if (isUserMode) {
        // ── User 뷰: 각 schedule_item 마다 본인 제출 상태 표기
        const enriched: UserDeadline[] = scheduleRows.map((r) => {
          const cat = CLOSING_CATEGORIES.find((c) => c.id === r.category);
          const submitted = isSubmittedInWindow(r.quarter_id!, r.subsidiary_id, r.category, r.planned_date);
          const [py, pm, pd] = r.planned_date.split('-').map(Number);
          const planned = new Date(py, pm - 1, pd);
          const isOverdue = !submitted && planned.getTime() < todayDateOnly.getTime();
          const status: UserDeadline['status'] = submitted
            ? 'submitted'
            : isOverdue
              ? 'overdue'
              : 'pending';
          return {
            id: r.id,
            planned_date: r.planned_date,
            category: r.category,
            categoryLabel: cat?.label || r.category,
            categoryColor: cat?.color || '#9CA3AF',
            status,
          };
        });
        // 같은 카테고리/날짜 중복 제거 (사용자가 여러 법인 담당이면 중복 가능)
        const dedup = new Map<string, UserDeadline>();
        enriched.forEach((d) => {
          const k = `${d.planned_date}|${d.category}`;
          // 가장 우선순위 높은 status 유지: overdue > pending > submitted
          const prev = dedup.get(k);
          const order = { overdue: 3, pending: 2, submitted: 1 } as const;
          if (!prev || order[d.status] > order[prev.status]) dedup.set(k, d);
        });
        setUserDeadlines(Array.from(dedup.values()).slice(0, 30));
        setAdminDeadlines([]);
        setEntityProgress([]);
      } else {
        // ── Admin 뷰: (date, category) 단위로 그룹핑 + 진행률 계산
        const groupMap = new Map<string, AdminDeadline & { totalKeys: Set<string>; submittedKeys: Set<string> }>();
        // 법인별 진척률 누적 — 동시에 만든다 (한 번 순회로 두 가지 다 산출)
        type EntityAcc = {
          subsidiaryId: string;
          // (category|planned_date) 키로 dedup — 같은 schedule_item 이 여러 번 카운트되지 않게
          seen: Set<string>;
          total: number;
          submitted: number;
          earliestPendingTs: number | null;
        };
        const entityMap = new Map<string, EntityAcc>();
        const todayTs = todayDateOnly.getTime();

        scheduleRows.forEach((r) => {
          const key = `${r.planned_date}|${r.category}`;
          const cat = CLOSING_CATEGORIES.find((c) => c.id === r.category);
          if (!groupMap.has(key)) {
            groupMap.set(key, {
              key,
              planned_date: r.planned_date,
              category: r.category,
              categoryLabel: cat?.label || r.category,
              categoryColor: cat?.color || '#9CA3AF',
              totalSubs: 0,
              submittedSubs: 0,
              totalKeys: new Set(),
              submittedKeys: new Set(),
            });
          }
          const entry = groupMap.get(key)!;
          const submitted = isSubmittedInWindow(
            r.quarter_id!,
            r.subsidiary_id,
            r.category,
            r.planned_date,
          );

          // [Admin Deadlines] 같은 법인이 여러 행 가질 수 있음 — 법인 단위로 dedup
          if (!entry.totalKeys.has(r.subsidiary_id)) {
            entry.totalKeys.add(r.subsidiary_id);
            entry.totalSubs++;
            if (submitted) {
              entry.submittedKeys.add(r.subsidiary_id);
              entry.submittedSubs++;
            }
          }

          // [Entity Progress] 법인별 누적
          const eAcc = entityMap.get(r.subsidiary_id) ?? {
            subsidiaryId: r.subsidiary_id,
            seen: new Set<string>(),
            total: 0,
            submitted: 0,
            earliestPendingTs: null,
          };
          const itemKey = `${r.category}|${r.planned_date}`;
          if (!eAcc.seen.has(itemKey)) {
            eAcc.seen.add(itemKey);
            eAcc.total++;
            if (submitted) {
              eAcc.submitted++;
            } else {
              // 미제출 — 가장 빠른 미제출 일정의 timestamp 추적
              const [py, pm, pd] = r.planned_date.split('-').map(Number);
              const ts = new Date(py, pm - 1, pd).getTime();
              if (eAcc.earliestPendingTs === null || ts < eAcc.earliestPendingTs) {
                eAcc.earliestPendingTs = ts;
              }
            }
          }
          entityMap.set(r.subsidiary_id, eAcc);
        });

        const adminList = Array.from(groupMap.values())
          .map((g) => ({
            key: g.key,
            planned_date: g.planned_date,
            category: g.category,
            categoryLabel: g.categoryLabel,
            categoryColor: g.categoryColor,
            totalSubs: g.totalSubs,
            submittedSubs: g.submittedSubs,
          }))
          .slice(0, 30);
        setAdminDeadlines(adminList);
        setUserDeadlines([]);

        // 법인 ID → 이름 매핑 (전체 법인 목록을 한 번 더 fetch 하지 않으려 in() 으로 추출)
        const entitySubIds = Array.from(entityMap.keys());
        let nameById = new Map<string, string>();
        if (entitySubIds.length > 0) {
          const { data: subsData } = await supabase
            .from('subsidiaries')
            .select('id, name')
            .in('id', entitySubIds);
          nameById = new Map(
            ((subsData ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]),
          );
        }

        const progressList: EntityProgress[] = Array.from(entityMap.values())
          .filter((e) => e.total > 0)
          .map((e) => {
            let earliestPendingDday: number | null = null;
            if (e.earliestPendingTs !== null) {
              earliestPendingDday = Math.round(
                (e.earliestPendingTs - todayTs) / (1000 * 60 * 60 * 24),
              );
            }
            return {
              subsidiaryId: e.subsidiaryId,
              subsidiaryName: nameById.get(e.subsidiaryId) || '(이름 없음)',
              total: e.total,
              submitted: e.submitted,
              earliestPendingDday,
            };
          })
          .sort((a, b) => {
            // 1) 진척률 낮은 법인 먼저 (admin이 신경써야 할 곳)
            const ra = a.submitted / a.total;
            const rb = b.submitted / b.total;
            if (ra !== rb) return ra - rb;
            // 2) 동률이면 가장 가까운 미제출 D-day 가 작은 순
            const da = a.earliestPendingDday ?? 9999;
            const db = b.earliestPendingDday ?? 9999;
            if (da !== db) return da - db;
            // 3) 이름 사전순
            return a.subsidiaryName.localeCompare(b.subsidiaryName);
          });
        setEntityProgress(progressList);
      }

      const voeData = voeResult as VoeInquiry[];

      // entity_user 면 본인 법인 관련 VOE 만 노출 (entity_name 매칭)
      const scopedVoeData = (() => {
        if (!isUserMode) return voeData;
        if (!allowedEntityIdentifiers || allowedEntityIdentifiers.size === 0) return [];
        return voeData.filter((v) => allowedEntityIdentifiers!.has(v.entity_name));
      })();

      const pendingTasks = scopedVoeData.filter((v) => v.status !== 'Resolved');

      setStats({
        announcements: announcementsResult.count || 0,
        upcoming: upcomingListResult.count || 0,
        pendingVoe: pendingTasks.length,
      });
      setTaskList(pendingTasks.slice(0, 10));
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="h-full overflow-hidden bg-gray-50 flex flex-col">
      <div className="p-4 flex-1 flex flex-col gap-3 min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
            <p className="text-sm text-gray-400">
              {t('dashboard.last_updated')}: {lastRefreshed.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </button>
        </div>

        {/* 승인 대기 알림 배너 — admin 전용, pending 사용자 있을 때만 */}
        {viewMode === 'admin' && pendingUserCount > 0 && (
          <Link
            href="/gbs/users"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors flex-shrink-0 group"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-amber-200 text-amber-700 flex-shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                {t('dashboard.pending_users.title', { count: pendingUserCount })}
              </p>
              <p className="text-xs text-amber-700">
                {t('dashboard.pending_users.desc')}
              </p>
            </div>
            <span className="text-xs text-amber-700 font-medium group-hover:underline whitespace-nowrap">
              {t('dashboard.pending_users.cta')}
              <ChevronRight className="w-3.5 h-3.5 inline -mt-0.5 ml-0.5" />
            </span>
          </Link>
        )}

        {/* VOE 새 답변·문의 배너 — 모든 사용자, 미확인 항목 있을 때만 */}
        {voeUnreadCount > 0 && (
          <Link
            href="/voe"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors flex-shrink-0 group"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-200 text-blue-700 flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-900">
                {viewMode === 'user'
                  ? `새 답변·문의 ${voeUnreadCount}건이 도착했습니다.`
                  : `법인으로부터 새 답변·문의 ${voeUnreadCount}건이 도착했습니다.`}
              </p>
              <p className="text-xs text-blue-700">
                마지막 VOE 방문 이후 업데이트된 항목입니다.
              </p>
            </div>
            <span className="text-xs text-blue-700 font-medium group-hover:underline whitespace-nowrap">
              VOE로 이동
              <ChevronRight className="w-3.5 h-3.5 inline -mt-0.5 ml-0.5" />
            </span>
          </Link>
        )}

        {/* Stats Row — 컴팩트한 한 줄 레이아웃 (라벨/숫자/보조 텍스트가 같은 행) */}
        <div className="grid grid-cols-3 gap-3 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <Megaphone className="w-6 h-6 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 font-medium">{t('dashboard.stats.announcements')}</p>
              <p className="text-xs text-gray-400">{t('dashboard.stats.announcements_hint')}</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">{stats.announcements}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 font-medium">{t('dashboard.stats.upcoming_deadlines')}</p>
              <p className="text-xs text-gray-400 truncate">
                {t('dashboard.stats.upcoming_hint')}{scopeLabel ? ` · ${scopeLabel}` : ''}
              </p>
            </div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">{stats.upcoming}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 font-medium">{t('dashboard.stats.pending_voe')}</p>
              <p className="text-xs text-gray-400">{t('dashboard.stats.pending_voe_hint')}</p>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${stats.pendingVoe > 0 ? 'text-yellow-500' : 'text-gray-900'}`}>
              {stats.pendingVoe}
            </p>
          </div>
        </div>

        {/* Main Grid: Closing Schedule + Right Column — flex-1 로 남은 높이 모두 차지 */}
        <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">

          {/* Closing Schedule Calendar (col-span-2) */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <h2 className="font-semibold text-gray-900">{t('dashboard.closing_schedule')}</h2>
              </div>
            </div>
            <div className="flex-1 p-4 min-h-0">
              <ScheduleCalendar />
            </div>
          </div>

          {/* Right Column: Upcoming Deadlines + Tasks */}
          <div className="col-span-1 flex flex-col gap-3 min-h-0">

            {/* Upcoming Deadlines — admin/user 분기 */}
            <div className="bg-white rounded-xl border border-gray-200 flex flex-col flex-1 min-h-0">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900">
                    {viewMode === 'user' ? t('dashboard.my_deadlines') : t('dashboard.all_deadlines')}
                  </h3>
                  {viewMode === 'admin' ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Admin
                    </span>
                  ) : scopeLabel ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-mono font-semibold">
                      {scopeLabel}
                    </span>
                  ) : null}
                </div>
                <Link
                  href={viewMode === 'user' ? '/my-submissions' : '/quarterly-closing/overview'}
                  className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline flex-shrink-0"
                >
                  View All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-3 space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-7 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : viewMode === 'user' ? (
                  <UserDeadlinesList items={userDeadlines} />
                ) : (
                  <AdminDeadlinesList items={adminDeadlines} />
                )}
              </div>
            </div>

            {/* 하단 위젯 — admin: Entity Progress / user: Tasks(VOE) */}
            {viewMode === 'admin' ? (
              <div className="bg-white rounded-xl border border-gray-200 flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <h3 className="font-semibold text-gray-900">{t('dashboard.entity_progress')}</h3>
                    {entityProgress.length > 0 && (
                      <span className="text-xs text-gray-400">({entityProgress.length})</span>
                    )}
                  </div>
                  <Link
                    href="/quarterly-closing/overview"
                    className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline flex-shrink-0"
                  >
                    View All <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="p-3 space-y-2">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-7 bg-gray-100 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : entityProgress.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-400 text-xs px-4 text-center">
                      15일 이내 추적 가능한 법인 마감이 없습니다.
                    </div>
                  ) : (
                    <EntityProgressList items={entityProgress} />
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 flex flex-col flex-1 min-h-0">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-yellow-500" />
                    <h3 className="font-semibold text-gray-900">{t('dashboard.tasks')}</h3>
                    {stats.pendingVoe > 0 && (
                      <span className="text-xs text-gray-400">({stats.pendingVoe})</span>
                    )}
                  </div>
                  <Link
                    href="/voe"
                    className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline"
                  >
                    View All <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="p-3 space-y-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-7 bg-gray-100 rounded animate-pulse" />
                      ))}
                    </div>
                  ) : taskList.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-400 text-base px-4 text-center">
                      미완료 작업이 없습니다.
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {taskList.map((item) => {
                        const s = VOE_STATUS_STYLES[item.status];
                        return (
                          <li
                            key={item.id}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
                            onClick={() => (window.location.href = '/voe')}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-base text-gray-800 truncate font-medium" title={item.title}>
                                  {item.title}
                                </p>
                                <p className="text-sm text-gray-400 mt-0.5">
                                  {item.entity_name}
                                  {item.category && (
                                    <span className="ml-1 text-gray-400">· {item.category}</span>
                                  )}
                                </p>
                              </div>
                              <span className={`text-sm px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${s.bg} ${s.text}`}>
                                {item.status}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Subcomponents
 * ──────────────────────────────────────────────────────────────────────────── */

function formatDateLabel(planned: string): string {
  return new Date(planned).toLocaleDateString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
}

function UserDeadlinesList({ items }: { items: UserDeadline[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-base px-4 text-center">
        15일 이내 본인 마감이 없습니다.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-gray-50">
      {items.map((item) => {
        const dday = calcDday(item.planned_date);
        const ddayClass =
          dday.tone === 'urgent'
            ? 'bg-red-50 text-red-700'
            : dday.tone === 'soon'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-gray-50 text-gray-600';

        const statusMeta =
          item.status === 'submitted'
            ? { Icon: CheckCircle2, label: '제출완료', className: 'text-emerald-600' }
            : item.status === 'overdue'
              ? { Icon: AlertTriangle, label: '지연', className: 'text-red-600' }
              : { Icon: CircleDashed, label: '미제출', className: 'text-amber-600' };

        return (
          <li
            key={`${item.planned_date}-${item.category}`}
            className="px-4 py-3 hover:bg-gray-50"
            onClick={() => (window.location.href = '/my-submissions')}
            style={{ cursor: 'pointer' }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.categoryColor }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-base text-gray-800 truncate font-medium" title={item.categoryLabel}>
                  {item.categoryLabel}
                </p>
                <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
                  <span>{formatDateLabel(item.planned_date)}</span>
                  <span className="text-gray-300">·</span>
                  <span className={`flex items-center gap-1 font-medium ${statusMeta.className}`}>
                    <statusMeta.Icon className="w-3.5 h-3.5" />
                    {statusMeta.label}
                  </span>
                </p>
              </div>
              <span
                className={`text-sm px-2 py-0.5 rounded font-semibold whitespace-nowrap ${ddayClass}`}
              >
                {dday.label}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AdminDeadlinesList({ items }: { items: AdminDeadline[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-400 text-base px-4 text-center">
        15일 이내 예정된 마감이 없습니다.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-gray-50">
      {items.map((item) => {
        const dday = calcDday(item.planned_date);
        const ddayClass =
          dday.tone === 'urgent'
            ? 'bg-red-50 text-red-700'
            : dday.tone === 'soon'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-gray-50 text-gray-600';

        const rate = item.totalSubs === 0 ? 0 : item.submittedSubs / item.totalSubs;
        const tone = progressTone(rate);
        const ratePercent = Math.round(rate * 100);

        return (
          <li
            key={item.key}
            className="px-4 py-3 hover:bg-gray-50"
            onClick={() => (window.location.href = '/quarterly-closing/overview')}
            style={{ cursor: 'pointer' }}
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.categoryColor }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-base text-gray-800 truncate font-medium" title={item.categoryLabel}>
                  {item.categoryLabel}
                </p>
                <p className="text-sm text-gray-400 mt-0.5">{formatDateLabel(item.planned_date)}</p>
              </div>
              <span
                className={`text-sm px-2 py-0.5 rounded font-semibold whitespace-nowrap ${ddayClass}`}
              >
                {dday.label}
              </span>
            </div>
            {/* 진행률 바 */}
            <div className="flex items-center gap-2 pl-5">
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${tone.bar} transition-all`}
                  style={{ width: `${ratePercent}%` }}
                />
              </div>
              <span className={`text-sm font-semibold tabular-nums ${tone.text}`}>
                {item.submittedSubs}/{item.totalSubs}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 법인별 마감 진척률 — admin 전용 위젯.
 * 진척률 낮은 법인이 위로 정렬되어 admin 이 우선 챙겨야 할 곳을 빠르게 인지할 수 있다.
 */
function EntityProgressList({ items }: { items: EntityProgress[] }) {
  return (
    <ul className="divide-y divide-gray-50">
      {items.map((e) => {
        const rate = e.total === 0 ? 0 : e.submitted / e.total;
        const tone = progressTone(rate);
        const ratePercent = Math.round(rate * 100);

        // 미제출 마감 D-day 가 가장 시급한 라벨로 사용
        let ddayBadge: { label: string; cls: string } | null = null;
        if (e.earliestPendingDday !== null) {
          const d = e.earliestPendingDday;
          const label =
            d === 0 ? 'D-day' : d < 0 ? `D+${Math.abs(d)}` : `D-${d}`;
          const cls =
            d <= 3
              ? 'bg-red-50 text-red-700'
              : d <= 7
                ? 'bg-amber-50 text-amber-700'
                : 'bg-gray-50 text-gray-600';
          ddayBadge = { label, cls };
        }

        return (
          <li
            key={e.subsidiaryId}
            className="px-4 py-3 hover:bg-gray-50 cursor-pointer"
            onClick={() => (window.location.href = '/quarterly-closing/overview')}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 min-w-0">
                <p className="text-base text-gray-800 truncate font-medium" title={e.subsidiaryName}>
                  {e.subsidiaryName}
                </p>
              </div>
              {ddayBadge && (
                <span
                  className={`text-sm px-2 py-0.5 rounded font-semibold whitespace-nowrap ${ddayBadge.cls}`}
                >
                  {ddayBadge.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${tone.bar} transition-all`}
                  style={{ width: `${ratePercent}%` }}
                />
              </div>
              <span className={`text-sm font-semibold tabular-nums ${tone.text}`}>
                {e.submitted}/{e.total}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
