import { supabase } from '@/lib/supabase/client';
import type { Issue } from '@/lib/types/issue';

export interface IssueFormData {
  title: string;
  category: string;
  entity_id: string;
  description: string;
  response?: string;
  status?: string;
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