'use client';

/**
 * 프로젝트 생성/수정 Dialog
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import type { Project, Task, SystemCategory, ProjectStatus, TaskStatus } from '@/lib/types/system';
import type { Subsidiary } from '@/lib/supabase/types';
import {
  createProject,
  updateProject,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  updateProjectProgress,
} from '@/lib/services/projectService';
import { format } from 'date-fns';
import { TaskList } from './TaskList';

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
  subsidiaries: Subsidiary[];
  onSuccess: () => void;
}

const SYSTEM_CATEGORIES: SystemCategory[] = [
  'ERP',
  'CRM',
  '생산관리',
  '물류',
  '회계',
  'CS',
  'Payroll',
  '기타',
];

const PROJECT_STATUSES: ProjectStatus[] = ['계획중', '진행중', '완료', '보류', '취소'];

export function ProjectDialog({
  open,
  onOpenChange,
  project,
  subsidiaries,
  onSuccess,
}: ProjectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    entity_id: '',
    category: '' as SystemCategory | '',
    status: '계획중' as ProjectStatus,
    pm: '',
    start_date: '',
    due_date: '',
    description: '',
  });

  useEffect(() => {
    if (project) {
      setFormData({
        title: project.title,
        entity_id: project.entity_id,
        category: project.category,
        status: project.status,
        pm: project.pm,
        start_date: project.start_date ? format(new Date(project.start_date), 'yyyy-MM-dd') : '',
        due_date: project.due_date ? format(new Date(project.due_date), 'yyyy-MM-dd') : '',
        description: project.description || '',
      });
      loadTasks();
    } else {
      setFormData({
        title: '',
        entity_id: '',
        category: '' as SystemCategory | '',
        status: '계획중',
        pm: '',
        start_date: '',
        due_date: '',
        description: '',
      });
      setTasks([]);
    }
    setActiveTab('overview');
  }, [project, open]);

  const loadTasks = async () => {
    if (!project) return;
    try {
      const taskList = await getTasks(project.id);
      setTasks(taskList);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.entity_id || !formData.category || !formData.pm) {
      toast.error('필수 항목을 모두 입력해주세요');
      return;
    }

    try {
      setLoading(true);

      const projectData = {
        title: formData.title,
        entity_id: formData.entity_id,
        category: formData.category,
        status: formData.status,
        pm: formData.pm,
        start_date: formData.start_date || null,
        due_date: formData.due_date || null,
        description: formData.description || null,
        created_by: '조승현', // TODO: 실제 사용자 인증 연동
      };

      if (project) {
        await updateProject(project.id, projectData);
        toast.success('프로젝트가 수정되었습니다');
      } else {
        await createProject(projectData);
        toast.success('프로젝트가 생성되었습니다');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save project:', error);
      toast.error('저장 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = async () => {
    if (project) {
      await loadTasks();
      await updateProjectProgress(project.id);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[70vw] !w-[70vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? '프로젝트 수정' : 'New Project'}</DialogTitle>
        </DialogHeader>

        {project ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">개요</TabsTrigger>
              <TabsTrigger value="wbs">WBS</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">
                      프로젝트명 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="entity_id">
                      Entity <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.entity_id}
                      onValueChange={(value) => setFormData({ ...formData, entity_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="법인 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {subsidiaries.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name} ({sub.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">
                      카테고리 <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value as SystemCategory })
                      }
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="status">상태</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value as ProjectStatus })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pm">
                      PM <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="pm"
                      value={formData.pm}
                      onChange={(e) => setFormData({ ...formData, pm: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="due_date">Due Date</Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">설명</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    취소
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? '저장 중...' : '저장'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="wbs" className="mt-4">
              <TaskList
                projectId={project.id}
                tasks={tasks}
                onUpdate={handleTaskUpdate}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">
                  프로젝트명 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="entity_id">
                  Entity <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.entity_id}
                  onValueChange={(value) => setFormData({ ...formData, entity_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="법인 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {subsidiaries.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name} ({sub.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">
                  카테고리 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value as SystemCategory })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {SYSTEM_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="pm">
                  PM <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="pm"
                  value={formData.pm}
                  onChange={(e) => setFormData({ ...formData, pm: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '생성 중...' : '생성하기'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

