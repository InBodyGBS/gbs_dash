/**
 * Todo List 서비스
 */

import { supabase } from '@/lib/supabase/client';
import type { TodoItem, TodoFormData, TodoStatus } from '@/lib/types/todo';

function isMissingTable(error: { code?: string; message?: string }): boolean {
  if (!error) return false;
  if (error.code === '42P01') return true;
  const msg = error.message || '';
  return (
    msg.includes('Could not find the table') ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  );
}

export async function getTodos(): Promise<TodoItem[]> {
  const { data, error } = await supabase
    .from('todo_items' as never)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingTable(error)) {
      console.warn('[todo] todo_items 미생성 — docs/todo-items-schema.sql 실행 필요.');
      return [];
    }
    throw new Error(`Todo 조회 실패: ${error.message}`);
  }
  return (data || []) as unknown as TodoItem[];
}

export async function createTodo(
  form: TodoFormData,
  authorName: string,
  authorId: string,
): Promise<TodoItem> {
  if (!form.title.trim()) throw new Error('제목을 입력해 주세요.');
  const payload = {
    title: form.title.trim(),
    description: form.description?.trim() || null,
    status: form.status ?? 'todo',
    priority: form.priority ?? 'medium',
    due_date: form.due_date || null,
    assignee: form.assignee?.trim() || null,
    tags: form.tags ?? [],
    entity_id: form.entity_id || null,
    created_by: authorName,
    created_by_id: authorId,
  };
  const { data, error } = await supabase
    .from('todo_items' as never)
    .insert(payload as never)
    .select()
    .single();
  if (error) throw new Error(`Todo 생성 실패: ${error.message}`);
  return data as unknown as TodoItem;
}

export async function updateTodo(id: string, form: Partial<TodoFormData>): Promise<TodoItem> {
  const payload: Record<string, unknown> = {};
  if (form.title !== undefined) payload.title = form.title.trim();
  if (form.description !== undefined) payload.description = form.description?.trim() || null;
  if (form.status !== undefined) payload.status = form.status;
  if (form.priority !== undefined) payload.priority = form.priority;
  if (form.due_date !== undefined) payload.due_date = form.due_date || null;
  if (form.assignee !== undefined) payload.assignee = form.assignee?.trim() || null;
  if (form.tags !== undefined) payload.tags = form.tags;
  if (form.entity_id !== undefined) payload.entity_id = form.entity_id || null;

  const { data, error } = await supabase
    .from('todo_items' as never)
    .update(payload as never)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Todo 수정 실패: ${error.message}`);
  return data as unknown as TodoItem;
}

export async function updateTodoStatus(id: string, status: TodoStatus): Promise<void> {
  const { error } = await supabase
    .from('todo_items' as never)
    .update({ status } as never)
    .eq('id', id);
  if (error) throw new Error(`상태 변경 실패: ${error.message}`);
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from('todo_items' as never).delete().eq('id', id);
  if (error) throw new Error(`Todo 삭제 실패: ${error.message}`);
}
