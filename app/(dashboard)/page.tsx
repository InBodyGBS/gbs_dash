'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { RefreshCw, ChevronRight, Calendar, Clock, Megaphone } from 'lucide-react';
import { ScheduleCalendar } from '@/components/dashboard/ScheduleCalendar';

interface Announcement {
  id: string;
  type: string;
  title: string;
  author: string;
  created_at: string;
}

const ANNOUNCEMENT_TYPE_COLORS: Record<string, string> = {
  Notice: '#EF4444',
  Events: '#9CA3AF',
  Mail: '#F59E0B',
  Update: '#3B82F6',
  Alert: '#EF4444',
};

export default function DashboardPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [stats, setStats] = useState({ announcements: 0, upcoming: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [announcementsResult, upcomingResult, overdueResult] = await Promise.all([
        supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('schedule_items')
          .select('id', { count: 'exact' })
          .eq('status', 'planned')
          .gte('planned_date', today)
          .lte('planned_date', in30Days),
        supabase
          .from('schedule_items')
          .select('id', { count: 'exact' })
          .eq('status', 'planned')
          .lt('planned_date', today),
      ]);

      const announcementsData = (announcementsResult.data || []) as Announcement[];
      setAnnouncements(announcementsData);
      setStats({
        announcements: announcementsData.length,
        upcoming: upcomingResult.count || 0,
        overdue: overdueResult.count || 0,
      });
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">GBS Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Last updated: {lastRefreshed.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Megaphone className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500 font-medium">Announcements</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.announcements}</p>
            <p className="text-xs text-gray-400 mt-1">최근 공지</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500 font-medium">Upcoming Deadlines</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.upcoming}</p>
            <p className="text-xs text-gray-400 mt-1">30일 이내</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-red-500" />
              <span className="text-xs text-gray-500 font-medium">Overdue</span>
            </div>
            <p className="text-3xl font-bold text-red-600">{stats.overdue}</p>
            <p className="text-xs text-gray-400 mt-1">기한 초과</p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-5 gap-5" style={{ minHeight: '520px' }}>

          {/* Closing Schedule Calendar (3/5) */}
          <div className="col-span-3 bg-white rounded-xl border border-gray-200 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                <h2 className="font-semibold text-gray-900">Closing Schedule</h2>
              </div>
              <Link
                href="/quarterly-closing/calendar"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex-1 p-4 min-h-0">
              <ScheduleCalendar />
            </div>
          </div>

          {/* Announcements (2/5) */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-blue-500" />
                <h2 className="font-semibold text-gray-900">Announcements</h2>
              </div>
              <Link
                href="/announcements"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                View All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : announcements.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                  등록된 공지사항이 없습니다.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">Type</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">Title</th>
                      <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500">Author</th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {announcements.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => window.location.href = `/announcements/${item.id}`}
                      >
                        <td className="px-3 py-2.5">
                          <span
                            className="inline-block text-xs px-1.5 py-0.5 rounded text-white whitespace-nowrap"
                            style={{ backgroundColor: ANNOUNCEMENT_TYPE_COLORS[item.type] || '#9CA3AF' }}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 max-w-[120px]">
                          <span className="truncate block" title={item.title}>{item.title}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{item.author}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-gray-400 whitespace-nowrap">
                          {new Date(item.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
