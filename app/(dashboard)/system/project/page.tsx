'use client';

/**
 * 프로젝트 관리 페이지
 * 시스템 구축/개선 프로젝트 WBS 관리
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { getProjects, deleteProject } from '@/lib/services/projectService';
import { ProjectCard } from '@/components/system/ProjectCard';
import { ProjectDialog } from '@/components/system/ProjectDialog';
import type { Project, ProjectStatus } from '@/lib/types/system';
import type { Subsidiary } from '@/lib/supabase/types';

export default function ProjectPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [pmFilter, setPmFilter] = useState<string>('all');

  const loadData = async () => {
    try {
      setLoading(true);

      const [projectsData, subsidiariesData] = await Promise.all([
        getProjects(),
        supabase.from('subsidiaries').select('*').order('name'),
      ]);

      setProjects(projectsData);
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

  // 필터링된 프로젝트
  const filteredProjects = projects.filter((project) => {
    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const subsidiary = subsidiaries.find((s) => s.id === project.entity_id);
      if (
        !project.title.toLowerCase().includes(query) &&
        !subsidiary?.name.toLowerCase().includes(query) &&
        !project.category.toLowerCase().includes(query) &&
        !project.pm.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    // 상태 필터
    if (statusFilter !== 'all' && project.status !== statusFilter) {
      return false;
    }

    // Entity 필터
    if (entityFilter !== 'all' && project.entity_id !== entityFilter) {
      return false;
    }

    // PM 필터
    if (pmFilter !== 'all' && project.pm !== pmFilter) {
      return false;
    }

    return true;
  });

  // 고유한 PM 목록
  const uniquePMs = Array.from(new Set(projects.map((p) => p.pm))).sort();

  const handleDelete = async (projectId: string) => {
    if (!confirm('이 프로젝트를 삭제하시겠습니까? 모든 Task도 함께 삭제됩니다.')) return;

    try {
      await deleteProject(projectId);
      toast.success('프로젝트가 삭제되었습니다');
      loadData();
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast.error('삭제 실패');
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
      <div className="flex-shrink-0 space-y-4 pb-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Projects</h1>
            <p className="text-sm text-gray-600 mt-1">시스템 구축/개선 프로젝트 WBS 관리</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* 필터 및 검색 */}
        <div className="bg-white rounded-lg border p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="프로젝트명, 법인, 카테고리, PM으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="계획중">계획중</SelectItem>
                <SelectItem value="진행중">진행중</SelectItem>
                <SelectItem value="완료">완료</SelectItem>
                <SelectItem value="보류">보류</SelectItem>
                <SelectItem value="취소">취소</SelectItem>
              </SelectContent>
            </Select>

            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 Entity</SelectItem>
                {subsidiaries.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.name} ({sub.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={pmFilter} onValueChange={setPmFilter}>
              <SelectTrigger>
                <SelectValue placeholder="담당자" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 담당자</SelectItem>
                {uniquePMs.map((pm) => (
                  <SelectItem key={pm} value={pm}>
                    {pm}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 프로젝트 카드 리스트 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="space-y-4 pb-6">
          {filteredProjects.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <p className="text-gray-600 mb-2">표시할 프로젝트가 없습니다</p>
              <p className="text-sm text-gray-500">새로운 프로젝트를 등록해보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  subsidiary={subsidiaries.find((s) => s.id === project.entity_id)}
                  onClick={() => setSelectedProject(project)}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 프로젝트 생성 Dialog */}
      <ProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        subsidiaries={subsidiaries}
        onSuccess={loadData}
      />

      {/* 프로젝트 수정 Dialog */}
      {selectedProject && (
        <ProjectDialog
          open={!!selectedProject}
          onOpenChange={(open) => !open && setSelectedProject(null)}
          project={selectedProject}
          subsidiaries={subsidiaries}
          onSuccess={() => {
            loadData();
            // 수정 후 팝업 자동 종료
            setSelectedProject(null);
          }}
        />
      )}
    </div>
  );
}

