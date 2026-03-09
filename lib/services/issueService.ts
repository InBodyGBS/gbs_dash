import { supabase } from '@/lib/supabase/client';
import type { Issue } from '@/lib/types/issue';

export interface IssueFormData {
  title: string;
  category: string;
  entity_id: string;
  description: string;
  response?: string;
  status?: string;
  period?: string; // Year+Quarter 형식 (예: 20254Q), 필수 아님
  inquired_by?: string; // 문의자
  type?: 'Daily' | 'Q Closing'; // Type
}

export async function createIssue(issueData: IssueFormData): Promise<Issue> {
  const { data, error } = await supabase
    .from('issues')
    .insert(issueData as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getIssues(): Promise<Issue[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getAllIssues(): Promise<Issue[]> {
  return getIssues();
}

export async function updateIssue(
  id: string,
  updates: Partial<IssueFormData>
): Promise<Issue> {
  const { data, error } = await supabase
    .from('issues')
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteIssue(id: string): Promise<void> {
  const { error } = await supabase
    .from('issues')
    .delete()
    .eq('id', id);

  if (error) throw error;
}