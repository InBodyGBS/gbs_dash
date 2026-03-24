'use client';

/**
 * Task 리스트 컴포넌트
 */

import { useState, useEffect } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CheckCircle, Clock, AlertCircle, Pause, Plus, Trash2, Edit, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { Task, TaskStatus, Project, TaskHistory } from '@/lib/types/system';
import {
  createTask,
  updateTask,
  deleteTask,
  getProject,
  getTaskHistories,
  createTaskHistory,
  updateTaskHistory,
  deleteTaskHistory,
} from '@/lib/services/projectService';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { exportWBSToExcel, exportTaskHistoriesToExcel } from '@/lib/utils/exportExcel';

interface TaskListProps {
  projectId: string;
  tasks: Task[];
  onUpdate: () => void;
}

const TASK_STATUSES: TaskStatus[] = ['계획중', '진행중', '완료', '지연', '보류'];

const TASK_STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  계획중: <Clock className="w-4 h-4 text-gray-500" />,
  진행중: <AlertCircle className="w-4 h-4 text-blue-500" />,
  완료: <CheckCircle className="w-4 h-4 text-green-500" />,
  지연: <AlertCircle className="w-4 h-4 text-red-500" />,
  보류: <Pause className="w-4 h-4 text-orange-500" />,
};

export function TaskList({ projectId, tasks, onUpdate }: TaskListProps) {
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [histories, setHistories] = useState<TaskHistory[]>([]);
  const [historyFormOpen, setHistoryFormOpen] = useState(false);
  const [editingHistory, setEditingHistory] = useState<TaskHistory | null>(null);

  // 프로젝트 정보 로드
  useEffect(() => {
    const loadProject = async () => {
      try {
        const projectData = await getProject(projectId);
        setProject(projectData);
      } catch (error) {
        console.error('Failed to load project:', error);
      }
    };
    loadProject();
  }, [projectId]);
  const [formData, setFormData] = useState({
    task_number: '',
    title: '',
    description: '',
    assignee: '',
    status: '계획중' as TaskStatus,
    due_date: '',
    estimated_hours: '',
  });

  const handleOpenDialog = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        task_number: task.task_number,
        title: task.title,
        description: task.description || '',
        assignee: task.assignee,
        status: task.status,
        due_date: task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : '',
        estimated_hours: task.estimated_hours?.toString() || '',
      });
    } else {
      setEditingTask(null);
      // 다음 task_number 생성
      const maxNumber = tasks.reduce((max, t) => {
        const num = parseInt(t.task_number.split('.')[0] || '0');
        return Math.max(max, num);
      }, 0);
      const nextNumber = maxNumber + 1;
      setFormData({
        task_number: `${nextNumber}.1`,
        title: '',
        description: '',
        assignee: '',
        status: '계획중',
        due_date: '',
        estimated_hours: '',
      });
    }
    setTaskDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setTaskDialogOpen(false);
    setEditingTask(null);
    setFormData({
      task_number: '',
      title: '',
      description: '',
      assignee: '',
      status: '계획중',
      due_date: '',
      estimated_hours: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.task_number || !formData.title || !formData.assignee) {
      toast.error('필수 항목을 모두 입력해주세요');
      return;
    }

    try {
      const taskData = {
        project_id: projectId,
        task_number: formData.task_number,
        title: formData.title,
        description: formData.description || null,
        assignee: formData.assignee,
        status: formData.status,
        due_date: formData.due_date || null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        order_index: tasks.length,
      };

      if (editingTask) {
        const updateData: typeof taskData & { completed_date?: string | null } = { ...taskData };
        // 완료 상태로 변경 시 completed_date 설정
        if (formData.status === '완료' && editingTask.status !== '완료') {
          updateData.completed_date = new Date().toISOString();
        } else if (formData.status !== '완료') {
          updateData.completed_date = null;
        }
        await updateTask(editingTask.id, updateData);
        toast.success('Task가 수정되었습니다');
      } else {
        await createTask(taskData);
        toast.success('Task가 생성되었습니다');
      }

      handleCloseDialog();
      onUpdate();
    } catch (error) {
      console.error('Failed to save task:', error);
      toast.error('저장 실패');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('이 Task를 삭제하시겠습니까?')) return;

    try {
      await deleteTask(taskId);
      toast.success('Task가 삭제되었습니다');
      onUpdate();
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('삭제 실패');
    }
  };

  // Task를 번호별로 그룹화
  const groupedTasks = tasks.reduce((acc, task) => {
    const mainNumber = task.task_number.split('.')[0];
    if (!acc[mainNumber]) {
      acc[mainNumber] = [];
    }
    acc[mainNumber].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const handleExportWBS = async () => {
    if (!project) {
      toast.error('프로젝트 정보를 불러올 수 없습니다');
      return;
    }

    try {
      exportWBSToExcel(project, tasks);
      toast.success('Task Excel 파일이 다운로드되었습니다');
    } catch (error) {
      console.error('Failed to export Task:', error);
      toast.error('Task 다운로드 실패');
    }
  };

  const handleOpenHistoryDialog = async (task: Task) => {
    setSelectedTask(task);
    setHistoryDialogOpen(true);
    try {
      const taskHistories = await getTaskHistories(task.id);
      setHistories(taskHistories);
    } catch (error) {
      console.error('Failed to load histories:', error);
      toast.error('히스토리 조회 실패');
    }
  };

  const handleCloseHistoryDialog = () => {
    setHistoryDialogOpen(false);
    setSelectedTask(null);
    setHistories([]);
    setHistoryFormOpen(false);
    setEditingHistory(null);
  };

  const handleOpenHistoryForm = (history?: TaskHistory) => {
    if (history) {
      setEditingHistory(history);
    } else {
      setEditingHistory(null);
    }
    setHistoryFormOpen(true);
  };

  const handleCloseHistoryForm = () => {
    setHistoryFormOpen(false);
    setEditingHistory(null);
  };

  const handleSaveHistory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTask) return;

    const formData = new FormData(e.currentTarget);
    const historyData = {
      task_id: selectedTask.id,
      request_date: formData.get('request_date')?.toString() || null,
      response_date: formData.get('response_date')?.toString() || null,
      description: formData.get('description')?.toString() || null,
      completion_date: formData.get('completion_date')?.toString() || null,
    };

    try {
      if (editingHistory) {
        await updateTaskHistory(editingHistory.id, historyData);
        toast.success('히스토리가 수정되었습니다');
      } else {
        await createTaskHistory(historyData);
        toast.success('히스토리가 추가되었습니다');
      }
      handleCloseHistoryForm();
      // 히스토리 목록 새로고침
      const taskHistories = await getTaskHistories(selectedTask.id);
      setHistories(taskHistories);
    } catch (error) {
      console.error('Failed to save history:', error);
      toast.error('저장 실패');
    }
  };

  const handleDeleteHistory = async (historyId: string) => {
    if (!confirm('이 히스토리를 삭제하시겠습니까?')) return;

    try {
      await deleteTaskHistory(historyId);
      toast.success('히스토리가 삭제되었습니다');
      if (selectedTask) {
        const taskHistories = await getTaskHistories(selectedTask.id);
        setHistories(taskHistories);
      }
    } catch (error) {
      console.error('Failed to delete history:', error);
      toast.error('삭제 실패');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">📋 Task</h3>
        <div className="flex items-center gap-2">
          <Button onClick={handleExportWBS} variant="outline" size="sm" disabled={!project || tasks.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export Task
          </Button>
          <Button onClick={() => handleOpenDialog()} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedTasks)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([mainNumber, taskGroup]) => (
            <div key={mainNumber} className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 w-12">상태</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 w-20">번호</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 min-w-[200px]">Task 명</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 w-24">담당자</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 w-32">Due Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 w-20">D-DAY</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700 min-w-[140px]">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskGroup
                      .sort((a, b) => a.task_number.localeCompare(b.task_number))
                      .map((task) => {
                        const dDay = task.due_date
                          ? differenceInDays(new Date(task.due_date), new Date())
                          : null;

                        return (
                          <tr
                            key={task.id}
                            className={cn(
                              'border-b hover:bg-gray-50',
                              task.status === '완료' && 'opacity-60'
                            )}
                          >
                            <td className="px-4 py-2">
                              <div className="flex items-center justify-center">
                                {TASK_STATUS_ICONS[task.status]}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <span className="font-medium text-sm">{task.task_number}</span>
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-sm">{task.title}</span>
                            </td>
                            <td className="px-4 py-2">
                              <span className="text-xs text-gray-600">{task.assignee}</span>
                            </td>
                            <td className="px-4 py-2">
                              {task.due_date ? (
                                <span className="text-xs text-gray-600">
                                  {format(new Date(task.due_date), 'yyyy-MM-dd')}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {dDay !== null ? (
                                <span
                                  className={cn(
                                    'text-xs font-medium',
                                    dDay < 0 ? 'text-red-600' : dDay === 0 ? 'text-orange-600' : 'text-blue-600'
                                  )}
                                >
                                  D-{dDay}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenHistoryDialog(task)}
                                  className="h-7 px-2 text-xs whitespace-nowrap"
                                  title="히스토리"
                                >
                                  <FileText className="w-3 h-3 mr-1" />
                                  히스토리
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenDialog(task)}
                                  className="h-7 w-7 p-0"
                                  title="수정"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(task.id)}
                                  className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                  title="삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p>Task가 없습니다. &quot;+ Add Task&quot; 버튼을 클릭하여 추가하세요.</p>
          </div>
        )}
      </div>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Task 수정' : 'New Task'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="task_number">
                  Task 번호 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="task_number"
                  value={formData.task_number}
                  onChange={(e) => setFormData({ ...formData, task_number: e.target.value })}
                  placeholder="예: 1.1, 2.1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="status">상태</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value as TaskStatus })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="title">
                Task 명 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="assignee">
                  담당자 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="assignee"
                  value={formData.assignee}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
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
              <Label htmlFor="estimated_hours">예상 공수 (시간)</Label>
              <Input
                id="estimated_hours"
                type="number"
                value={formData.estimated_hours}
                onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
                placeholder="예: 8"
              />
            </div>

            <div>
              <Label htmlFor="description">상세 설명</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                취소
              </Button>
              <Button type="submit">{editingTask ? '수정' : '생성'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTask ? `${selectedTask.task_number} - ${selectedTask.title} 히스토리` : 'Task 히스토리'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => {
                  if (selectedTask && histories.length > 0) {
                    exportTaskHistoriesToExcel(selectedTask, histories);
                    toast.success('Task 히스토리 Excel 파일이 다운로드되었습니다');
                  } else {
                    toast.error('다운로드할 히스토리가 없습니다');
                  }
                }}
                variant="outline"
                size="sm"
                disabled={!selectedTask || histories.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Excel 다운로드
              </Button>
              <Button onClick={() => handleOpenHistoryForm()} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                히스토리 추가
              </Button>
            </div>

            {histories.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>히스토리가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {histories.map((history) => (
                  <div key={history.id} className="border rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">요청일자:</span>
                        <p className="font-medium">
                          {history.request_date ? format(new Date(history.request_date), 'yyyy-MM-dd') : '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">회신일자:</span>
                        <p className="font-medium">
                          {history.response_date ? format(new Date(history.response_date), 'yyyy-MM-dd') : '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">완료일자:</span>
                        <p className="font-medium">
                          {history.completion_date ? format(new Date(history.completion_date), 'yyyy-MM-dd') : '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">생성일:</span>
                        <p className="font-medium text-xs">
                          {format(new Date(history.created_at), 'yyyy-MM-dd HH:mm')}
                        </p>
                      </div>
                    </div>
                    {history.description && (
                      <div>
                        <span className="text-gray-500 text-sm">설명:</span>
                        <p className="text-sm mt-1 whitespace-pre-line">{history.description}</p>
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenHistoryForm(history)}
                        className="h-7"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        수정
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteHistory(history.id)}
                        className="h-7 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        삭제
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseHistoryDialog}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Form Dialog */}
      <Dialog open={historyFormOpen} onOpenChange={setHistoryFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHistory ? '히스토리 수정' : '히스토리 추가'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveHistory} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="request_date">요청일자</Label>
                <Input
                  id="request_date"
                  name="request_date"
                  type="date"
                  defaultValue={editingHistory?.request_date ? format(new Date(editingHistory.request_date), 'yyyy-MM-dd') : ''}
                />
              </div>

              <div>
                <Label htmlFor="response_date">회신일자</Label>
                <Input
                  id="response_date"
                  name="response_date"
                  type="date"
                  defaultValue={editingHistory?.response_date ? format(new Date(editingHistory.response_date), 'yyyy-MM-dd') : ''}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="completion_date">완료일자</Label>
              <Input
                id="completion_date"
                name="completion_date"
                type="date"
                defaultValue={editingHistory?.completion_date ? format(new Date(editingHistory.completion_date), 'yyyy-MM-dd') : ''}
              />
            </div>

            <div>
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={editingHistory?.description || ''}
                placeholder="히스토리 설명을 입력하세요"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseHistoryForm}>
                취소
              </Button>
              <Button type="submit">{editingHistory ? '수정' : '추가'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

