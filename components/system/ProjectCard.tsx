'use client';

/**
 * 프로젝트 카드 컴포넌트
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, User, CheckCircle, Clock, AlertCircle, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Project, Task } from '@/lib/types/system';
import type { Subsidiary } from '@/lib/supabase/types';
import { getTasks } from '@/lib/services/projectService';
import { differenceInDays, format } from 'date-fns';

interface ProjectCardProps {
  project: Project;
  subsidiary?: Subsidiary;
  onClick: () => void;
}

const STATUS_CONFIG: Record<
  Project['status'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  계획중: {
    label: '계획중',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: <Clock className="w-3 h-3" />,
  },
  진행중: {
    label: '진행중',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  완료: {
    label: '완료',
    color: 'bg-green-100 text-green-800 border-green-300',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  보류: {
    label: '보류',
    color: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: <Pause className="w-3 h-3" />,
  },
  취소: {
    label: '취소',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

const TASK_STATUS_ICONS: Record<Task['status'], React.ReactNode> = {
  계획중: <Clock className="w-3 h-3 text-gray-500" />,
  진행중: <AlertCircle className="w-3 h-3 text-blue-500" />,
  완료: <CheckCircle className="w-3 h-3 text-green-500" />,
  지연: <AlertCircle className="w-3 h-3 text-red-500" />,
  보류: <Pause className="w-3 h-3 text-orange-500" />,
};

export function ProjectCard({ project, subsidiary, onClick }: ProjectCardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const taskList = await getTasks(project.id);
        setTasks(taskList);
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [project.id]);

  const statusConfig = STATUS_CONFIG[project.status];
  const completedTasks = tasks.filter((t) => t.status === '완료').length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // D-DAY 계산
  const dDay = project.due_date
    ? differenceInDays(new Date(project.due_date), new Date())
    : null;
  const dDayText = dDay !== null ? (dDay > 0 ? `D-${dDay}` : dDay === 0 ? 'D-Day' : `D+${Math.abs(dDay)}`) : null;

  // 미리보기 Task (최대 5개)
  const previewTasks = tasks.slice(0, 5);
  const remainingTasks = tasks.length - previewTasks.length;

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow border-l-4"
      style={{ borderLeftColor: getStatusColor(project.status) }}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{project.title}</h3>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <span>{subsidiary?.name || 'Unknown'}</span>
              <span>|</span>
              <span>{project.category}</span>
              <Badge variant="outline" className={cn('ml-2 text-xs', statusConfig.color)}>
                {statusConfig.icon}
                <span className="ml-1">{statusConfig.label}</span>
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>PM: {project.pm}</span>
              </div>
              {project.due_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Due: {format(new Date(project.due_date), 'yyyy-MM-dd')}</span>
                </div>
              )}
              {dDayText && (
                <div
                  className={cn(
                    'font-semibold',
                    dDay < 0 ? 'text-red-600' : dDay === 0 ? 'text-orange-600' : 'text-blue-600'
                  )}
                >
                  {dDayText}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* 진행률 */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>WBS Progress</span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Task 리스트 */}
        {loading ? (
          <div className="text-xs text-gray-400">로딩 중...</div>
        ) : totalTasks > 0 ? (
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-700 mb-2">
              Tasks ({completedTasks}/{totalTasks}):
            </div>
            {previewTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 text-xs text-gray-600">
                {TASK_STATUS_ICONS[task.status]}
                <span className="flex-1 truncate">{task.title}</span>
                {task.assignee && (
                  <span className="text-gray-400 text-[10px]">({task.assignee})</span>
                )}
                {task.due_date && (
                  <span className="text-gray-400 text-[10px]">
                    D-{differenceInDays(new Date(task.due_date), new Date())}
                  </span>
                )}
              </div>
            ))}
            {remainingTasks > 0 && (
              <div className="text-xs text-gray-400 italic">+ {remainingTasks} more tasks</div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">No tasks yet</div>
        )}
      </CardContent>
    </Card>
  );
}

function getStatusColor(status: Project['status']): string {
  switch (status) {
    case '계획중':
      return '#9CA3AF';
    case '진행중':
      return '#3B82F6';
    case '완료':
      return '#10B981';
    case '보류':
      return '#F59E0B';
    case '취소':
      return '#EF4444';
    default:
      return '#9CA3AF';
  }
}

