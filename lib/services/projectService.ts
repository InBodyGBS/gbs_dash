import { supabase } from '@/lib/supabase/client';
import type { Project, ProjectStatus, Task, TaskStatus, TaskHistory } from '@/lib/types/system';

/**
 * 프로젝트 목록 조회
 */
export async function getProjects(entityId?: string, status?: ProjectStatus): Promise<Project[]> {
  let query = supabase.from('projects').select('*').order('created_at', { ascending: false });

  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * 프로젝트 상세 조회
 */
export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}

/**
 * 프로젝트 생성
 */
export async function createProject(projectData: {
  title: string;
  entity_id: string;
  category: string;
  status?: ProjectStatus;
  pm: string;
  start_date?: string | null;
  due_date?: string | null;
  description?: string | null;
  created_by: string;
}): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...projectData,
      status: projectData.status || '계획중',
      progress: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 프로젝트 수정
 */
export async function updateProject(
  id: string,
  updates: Partial<{
    title: string;
    entity_id: string;
    category: string;
    status: ProjectStatus;
    pm: string;
    start_date: string | null;
    due_date: string | null;
    completion_date: string | null;
    description: string | null;
    progress: number;
  }>
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * 프로젝트 삭제
 */
export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);

  if (error) throw error;
}

/**
 * Task 목록 조회
 */
export async function getTasks(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Task 생성
 */
export async function createTask(taskData: {
  project_id: string;
  task_number: string;
  title: string;
  description?: string | null;
  assignee: string;
  status?: TaskStatus;
  due_date?: string | null;
  progress?: number;
  estimated_hours?: number | null;
  parent_task_id?: string | null;
  order_index?: number;
}): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      ...taskData,
      status: taskData.status || '계획중',
      progress: taskData.progress || 0,
      order_index: taskData.order_index || 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Task 수정
 */
export async function updateTask(
  id: string,
  updates: Partial<{
    task_number: string;
    title: string;
    description: string | null;
    assignee: string;
    status: TaskStatus;
    due_date: string | null;
    completed_date: string | null;
    progress: number;
    estimated_hours: number | null;
    parent_task_id: string | null;
    order_index: number;
  }>
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Task 삭제
 */
export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);

  if (error) throw error;
}

/**
 * 프로젝트 진행률 계산 (완료 Task / 전체 Task)
 */
export async function calculateProjectProgress(projectId: string): Promise<number> {
  const tasks = await getTasks(projectId);

  if (tasks.length === 0) return 0;

  const completedTasks = tasks.filter((task) => task.status === '완료').length;
  return Math.round((completedTasks / tasks.length) * 100);
}

/**
 * 프로젝트 진행률 업데이트
 */
export async function updateProjectProgress(projectId: string): Promise<void> {
  const progress = await calculateProjectProgress(projectId);
  await updateProject(projectId, { progress });
}

/**
 * Task 히스토리 목록 조회
 */
export async function getTaskHistories(taskId: string): Promise<TaskHistory[]> {
  const { data, error } = await supabase
    .from('task_histories')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Task 히스토리 생성
 */
export async function createTaskHistory(historyData: {
  task_id: string;
  request_date?: string | null;
  response_date?: string | null;
  description?: string | null;
  completion_date?: string | null;
}): Promise<TaskHistory> {
  const { data, error } = await supabase
    .from('task_histories')
    .insert(historyData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Task 히스토리 수정
 */
export async function updateTaskHistory(
  id: string,
  updates: Partial<{
    request_date: string | null;
    response_date: string | null;
    description: string | null;
    completion_date: string | null;
  }>
): Promise<TaskHistory> {
  const { data, error } = await supabase
    .from('task_histories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Task 히스토리 삭제
 */
export async function deleteTaskHistory(id: string): Promise<void> {
  const { error } = await supabase.from('task_histories').delete().eq('id', id);

  if (error) throw error;
}
