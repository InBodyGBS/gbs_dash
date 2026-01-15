'use client';

import { useEffect, useState } from 'react';
import { FileText, Clock, CheckCircle, TrendingUp, Plus, Tag, Building2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getAllIssues } from '@/lib/services/issueService';
import { supabase } from '@/lib/supabase/client';
import type { Issue, IssueFilters, IssueSortOption } from '@/lib/types/issue';
import type { Subsidiary } from '@/lib/supabase/types';
import { ISSUE_STATUS_LIST } from '@/lib/constants/issue-categories';
import { IssueCard } from '@/components/issue/IssueCard';
import { IssueCreateDialog } from '@/components/issue/IssueCreateDialog';
import { IssueDetailDialog } from '@/components/issue/IssueDetailDialog';
import { StatCard } from '@/components/issue/StatCard';
import { FilterCard } from '@/components/issue/FilterCard';
import { CategoryFilterDialog } from '@/components/issue/CategoryFilterDialog';
import { EntityFilterDialog } from '@/components/issue/EntityFilterDialog';
import { exportIssuesToExcel } from '@/lib/utils/exportExcel';

export default function IssuePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  
  // 필터 다이얼로그 상태
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);

  // 필터 및 정렬 상태
  const [filters, setFilters] = useState<IssueFilters>({
    search: '',
    categories: [],
    entities: [],
    statuses: [],
  });
  const [sortBy, setSortBy] = useState<IssueSortOption>('created_desc');

  // 데이터 로드
  const loadData = async () => {
    try {
      setLoading(true);

      // 이슈 및 법인 데이터 병렬 로드
      const [issuesData, subsidiariesData] = await Promise.all([
        getAllIssues(),
        supabase.from('subsidiaries').select('*').order('name'),
      ]);

      console.log('📊 Loaded Issues:', issuesData.length);
      console.log('🏢 Loaded Subsidiaries:', subsidiariesData.data?.length || 0);
      console.log('🏢 Subsidiaries Data:', subsidiariesData.data);

      setIssues(issuesData);
      setSubsidiaries(subsidiariesData.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('데이터 로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 필터링 및 정렬
  const filteredAndSortedIssues = () => {
    let result = [...issues];

    // 검색 필터
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter((issue) => {
        const subsidiary = subsidiaries.find((s) => s.id === issue.entity_id);
        return (
          issue.title.toLowerCase().includes(searchLower) ||
          issue.category.toLowerCase().includes(searchLower) ||
          subsidiary?.name.toLowerCase().includes(searchLower)
        );
      });
    }

    // 카테고리 필터
    if (filters.categories.length > 0) {
      result = result.filter((issue) => filters.categories.includes(issue.category));
    }

    // Entity 필터
    if (filters.entities.length > 0) {
      result = result.filter((issue) => filters.entities.includes(issue.entity_id));
    }

    // 상태 필터
    if (filters.statuses.length > 0) {
      result = result.filter((issue) => filters.statuses.includes(issue.status));
    }

    // 정렬
    switch (sortBy) {
      case 'created_desc':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'created_asc':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'entity':
        result.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
        break;
      case 'category':
        result.sort((a, b) => a.category.localeCompare(b.category));
        break;
    }

    return result;
  };

  const displayedIssues = filteredAndSortedIssues();
  
  // 통계 계산
  const total = issues.length;
  const completed = issues.filter((issue) => issue.status === '완료').length;
  const inProgress = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const stats = {
    total,
    inProgress,
    completed,
    completionRate,
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setFilters({
      search: '',
      categories: [],
      entities: [],
      statuses: [],
    });
    toast.success('모든 필터가 해제되었습니다');
  };

  // Excel 다운로드
  const handleExportExcel = () => {
    if (issues.length === 0) {
      toast.error('다운로드할 이슈가 없습니다');
      return;
    }
    
    try {
      exportIssuesToExcel(issues, subsidiaries);
      toast.success('Excel 파일이 다운로드되었습니다');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Excel 다운로드 실패');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-screen overflow-hidden">
      <div className="flex-shrink-0 space-y-6 pb-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Issue Management</h1>
            <p className="text-sm text-gray-600 mt-1">해외법인 이슈 통합 관리</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-2" />
              Excel 다운로드
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Issue
            </Button>
          </div>
        </div>

        {/* 통계 및 필터 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <StatCard
            title="전체 이슈"
            value={stats.total}
            icon={<FileText className="w-5 h-5" />}
            color="blue"
            onClick={handleResetFilters}
          />
          <StatCard
            title="확인 중"
            value={stats.inProgress}
            icon={<Clock className="w-5 h-5" />}
            color="orange"
            onClick={() => {
              const isActive = filters.statuses.includes('확인 중');
              setFilters({
                ...filters,
                statuses: isActive ? [] : ['확인 중'],
              });
            }}
            isActive={filters.statuses.includes('확인 중')}
          />
          <StatCard
            title="완료"
            value={stats.completed}
            icon={<CheckCircle className="w-5 h-5" />}
            color="green"
            onClick={() => {
              const isActive = filters.statuses.includes('완료');
              setFilters({
                ...filters,
                statuses: isActive ? [] : ['완료'],
              });
            }}
            isActive={filters.statuses.includes('완료')}
          />
          <StatCard
            title="완료율"
            value={`${stats.completionRate}%`}
            icon={<TrendingUp className="w-5 h-5" />}
            color="purple"
          />
          <FilterCard
            title="카테고리"
            value={filters.categories.length > 0 ? `${filters.categories.length}개` : '전체'}
            icon={<Tag className="w-5 h-5" />}
            color="gray"
            onClick={() => setCategoryDialogOpen(true)}
            isActive={filters.categories.length > 0}
          />
          <FilterCard
            title="Entity"
            value={filters.entities.length > 0 ? `${filters.entities.length}개` : '전체'}
            icon={<Building2 className="w-5 h-5" />}
            color="gray"
            onClick={() => setEntityDialogOpen(true)}
            isActive={filters.entities.length > 0}
          />
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-lg border p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 검색 */}
            <div className="md:col-span-1">
              <Input
                placeholder="제목, 카테고리, Entity로 검색..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full"
              />
            </div>

            {/* 정렬 */}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as IssueSortOption)}>
              <SelectTrigger>
                <SelectValue placeholder="정렬" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">최신순</SelectItem>
                <SelectItem value="created_asc">오래된순</SelectItem>
                <SelectItem value="entity">Entity순</SelectItem>
                <SelectItem value="category">카테고리순</SelectItem>
              </SelectContent>
            </Select>

            {/* 상태 필터 */}
            <Select
              value={filters.statuses[0] || 'all'}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  statuses: value === 'all' ? [] : [value as any],
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                {ISSUE_STATUS_LIST.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 이슈 목록 - 스크롤 가능 영역 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-4 pb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              📋 이슈 목록 ({displayedIssues.length}개)
            </h2>
          </div>

          {displayedIssues.length === 0 ? (
            <div className="bg-white rounded-lg border p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">표시할 이슈가 없습니다</p>
              <p className="text-sm text-gray-500">새로운 이슈를 등록해보세요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  subsidiary={subsidiaries.find((s) => s.id === issue.entity_id)}
                  onClick={() => setSelectedIssue(issue)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 이슈 생성 다이얼로그 */}
      <IssueCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        subsidiaries={subsidiaries}
        onSuccess={loadData}
      />

      {/* 이슈 상세 다이얼로그 */}
      {selectedIssue && (
        <IssueDetailDialog
          issue={selectedIssue}
          subsidiary={subsidiaries.find((s) => s.id === selectedIssue.entity_id)}
          open={!!selectedIssue}
          onOpenChange={(open) => !open && setSelectedIssue(null)}
          onUpdate={async () => {
            await loadData();
            // 업데이트 후 최신 이슈 데이터로 selectedIssue 업데이트
            const updatedIssues = await getAllIssues();
            const updatedIssue = updatedIssues.find((i) => i.id === selectedIssue.id);
            if (updatedIssue) {
              // 완료 처리된 경우 팝업 닫기
              if (updatedIssue.status === '완료') {
                setSelectedIssue(null);
              } else {
                setSelectedIssue(updatedIssue);
              }
            }
          }}
          onDelete={loadData}
        />
      )}

      {/* 카테고리 필터 다이얼로그 */}
      <CategoryFilterDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        selectedCategories={filters.categories}
        onApply={(categories) => setFilters({ ...filters, categories })}
      />

      {/* Entity 필터 다이얼로그 */}
      <EntityFilterDialog
        open={entityDialogOpen}
        onOpenChange={setEntityDialogOpen}
        selectedEntities={filters.entities}
        subsidiaries={subsidiaries}
        onApply={(entities) => setFilters({ ...filters, entities })}
      />
    </div>
  );
}
