import { supabase } from '@/lib/supabase/client';
import type { Issue, IssueCategory, IssueStatus } from '@/lib/types/issue';

export interface IssueFormData {
  title: string;
  category: IssueCategory;
  entity_id: string;
  description: string;
  response?: string;
  status?: IssueStatus;
  created_by?: string;
  period?: string; // Year+Quarter 형식 (예: 20254Q), 필수 아님
  inquired_by?: string; // 문의자
  type?: 'Daily' | 'Q Closing'; // Type
}

export async function createIssue(issueData: IssueFormData): Promise<Issue> {
  const { data, error } = await supabase
    .from('issues')
    .insert({
      title: issueData.title,
      category: issueData.category,
      entity_id: issueData.entity_id,
      description: issueData.description,
      response: issueData.response,
      status: issueData.status,
      created_by: issueData.created_by,
      period: issueData.period,
      inquired_by: issueData.inquired_by,
      type: issueData.type,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Issue;
}

export async function getIssues(): Promise<Issue[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as Issue[];
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
    .update({
      title: updates.title,
      category: updates.category,
      entity_id: updates.entity_id,
      description: updates.description,
      response: updates.response,
      status: updates.status,
      created_by: updates.created_by,
      period: updates.period,
      inquired_by: updates.inquired_by,
      type: updates.type,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as Issue;
}

export async function deleteIssue(id: string): Promise<void> {
  const { error } = await supabase
    .from('issues')
    .delete()
    .eq('id', id);

  if (error) throw error;
}