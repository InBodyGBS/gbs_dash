'use client';

/**
 * 제출 로그 테이블 컴포넌트
 * Schedule 페이지에서 제출 기록을 표시
 */

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Download, FileSpreadsheet, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import { getSubmissionUrl } from '@/lib/services/submissionService';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';
import { toast } from 'sonner';
import type { Subsidiary } from '@/lib/supabase/types';

interface SubmissionLog {
  id: string;
  quarter_id: string | null;
  subsidiary_id: string | null;
  fiscal_year: string | null;
  entity_name: string | null;
  category: string;
  file_name: string;
  file_path: string;
  file_size: number;
  version: number;
  submitted_at: string;
  subsidiary?: {
    id: string;
    name: string;
    code: string;
  };
  quarter?: {
    id: string;
    year: number;
    quarter: number;
  };
}

interface SubmissionLogTableProps {
  selectedYear?: string;
  selectedQuarter?: string;
  selectedSubsidiaryId?: string | null;
}

export function SubmissionLogTable({
  selectedYear,
  selectedQuarter,
  selectedSubsidiaryId,
}: SubmissionLogTableProps) {
  const [submissions, setSubmissions] = useState<SubmissionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<string>(selectedYear || '');
  const [filterQuarter, setFilterQuarter] = useState<string>(selectedQuarter || '');
  const [filterSubsidiaryId, setFilterSubsidiaryId] = useState<string | null>(
    selectedSubsidiaryId || null
  );
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);

  // 법인 목록 로드
  useEffect(() => {
    const loadSubsidiaries = async () => {
      const { data, error } = await supabase
        .from('subsidiaries')
        .select('*')
        .order('name');

      if (error) {
        console.error('Failed to load subsidiaries:', error);
      } else {
        const EXCLUDED = ['Germany', 'UK', 'Singapore'];
        setSubsidiaries(
          (data || []).filter((s) => !EXCLUDED.some((ex) => s.name.includes(ex)))
        );
      }
    };

    loadSubsidiaries();
  }, []);

  // 제출 로그 로드
  useEffect(() => {
    loadSubmissions();
  }, [filterYear, filterQuarter, filterSubsidiaryId, filterCategory]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('submissions')
        .select(`
          *,
          subsidiaries:subsidiary_id (
            id,
            name,
            code
          ),
          quarters:quarter_id (
            id,
            year,
            quarter
          )
        `)
        .order('submitted_at', { ascending: false });

      // 필터 적용
      if (filterSubsidiaryId && filterSubsidiaryId !== 'all') {
        query = query.eq('subsidiary_id', filterSubsidiaryId);
      }

      if (filterCategory && filterCategory !== 'all') {
        query = query.eq('category', filterCategory);
      }

      // Quarter 필터 (year와 quarter로 필터링)
      if (filterYear && filterQuarter && filterQuarter !== 'all') {
        // 먼저 해당 year와 quarter의 quarter_id를 찾아야 함
        const { data: quarterData } = await supabase
          .from('quarters')
          .select('id')
          .eq('year', parseInt(filterYear))
          .eq('quarter', parseInt(filterQuarter))
          .maybeSingle();

        if (quarterData) {
          query = query.eq('quarter_id', (quarterData as { id: string }).id);
        } else {
          // 해당 quarter가 없으면 빈 결과 반환
          setSubmissions([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === '42P01') {
          console.warn('submissions 테이블이 존재하지 않습니다.');
          setSubmissions([]);
        } else {
          throw error;
        }
      } else {
        setSubmissions((data || []) as any[]);
      }
    } catch (error: any) {
      console.error('Failed to load submissions:', error);
      toast.error('제출 로그 조회 실패', {
        description: error.message || '제출 로그를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (submission: SubmissionLog) => {
    try {
      const url = await getSubmissionUrl(submission.file_path);
      const link = document.createElement('a');
      link.href = url;
      link.download = submission.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('다운로드 시작', {
        description: `${submission.file_name} 다운로드가 시작되었습니다.`,
      });
    } catch (error: any) {
      toast.error('다운로드 실패', {
        description: error.message || '파일 다운로드 중 오류가 발생했습니다.',
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryLabel = (categoryId: string): string => {
    return CLOSING_CATEGORIES.find((cat) => cat.id === categoryId)?.label || categoryId;
  };

  const getCategoryColor = (categoryId: string): string => {
    return CLOSING_CATEGORIES.find((cat) => cat.id === categoryId)?.color || '#6B7280';
  };

  const getFiscalPeriod = (submission: SubmissionLog): string => {
    if (submission.quarter) {
      return `${submission.quarter.year}년 ${submission.quarter.quarter}Q`;
    }
    return '-';
  };

  const filteredSubmissions = useMemo(() => {
    return submissions;
  }, [submissions]);

  const clearFilters = () => {
    setFilterYear('');
    setFilterQuarter('');
    setFilterSubsidiaryId(null);
    setFilterCategory('all');
  };

  return (
    <div className="space-y-4">
      {/* 필터 영역 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">필터:</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">귀속연도:</span>
            <Input
              type="number"
              placeholder="2026"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-24"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">분기:</span>
            <Select value={filterQuarter || 'all'} onValueChange={(value) => setFilterQuarter(value === 'all' ? '' : value)}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="1">1Q</SelectItem>
                <SelectItem value="2">2Q</SelectItem>
                <SelectItem value="3">3Q</SelectItem>
                <SelectItem value="4">4Q</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Entity:</span>
            <Select
              value={filterSubsidiaryId || 'all'}
              onValueChange={(value) => setFilterSubsidiaryId(value === 'all' ? null : value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {subsidiaries.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">카테고리:</span>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {CLOSING_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            필터 초기화
          </Button>
        </div>
      </div>

      {/* 제출 로그 테이블 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
              style={{ borderColor: '#971B2F' }}
            ></div>
            <p className="text-gray-600 mt-4">로딩 중...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="p-8 text-center">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">제출 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    제출일시
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    귀속연도
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    ENTITY
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    카테고리
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    파일명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    파일 크기
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    버전
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {format(new Date(submission.submitted_at), 'yyyy-MM-dd HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {submission.fiscal_year || getFiscalPeriod(submission) || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {submission.entity_name || 
                       (submission.subsidiary
                         ? `${submission.subsidiary.name} (${submission.subsidiary.code})`
                         : '-')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className="text-xs"
                        style={{
                          backgroundColor: `${getCategoryColor(submission.category)}1A`,
                          color: getCategoryColor(submission.category),
                          border: `1px solid ${getCategoryColor(submission.category)}33`,
                        }}
                      >
                        {getCategoryLabel(submission.category)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{submission.file_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatFileSize(submission.file_size)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <Badge variant="outline" className="text-xs">
                        v{submission.version}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(submission)}
                        className="flex items-center gap-1"
                      >
                        <Download className="h-4 w-4" />
                        다운로드
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
