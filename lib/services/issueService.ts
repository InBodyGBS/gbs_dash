/**
 * Issue 데이터 CRUD 서비스
 */

import { supabase } from '@/lib/supabase/client';
import type { Issue, IssueFormData, IssueStats, CategoryCount, EntityCount } from '@/lib/types/issue';

/**
 * 모든 이슈 조회
 */
export async function getAllIssues(): Promise<Issue[]> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch issues:', error);
    throw error;
  }

  return data || [];
}

/**
 * 특정 이슈 조회
 */
export async function getIssueById(id: string): Promise<Issue | null> {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Failed to fetch issue:', error);
    return null;
  }

  return data;
}

/**
 * 이슈 생성
 */
export async function createIssue(issueData: IssueFormData): Promise<Issue | null> {
  const { data, error } = await supabase
    .from('issues')
    .insert(issueData)
    .select()
    .single();

  if (error) {
    console.error('Failed to create issue:', error);
    throw error;
  }

  return data;
}

/**
 * 이슈 수정
 */
export async function updateIssue(id: string, updates: Partial<IssueFormData>): Promise<Issue | null> {
  const { data, error } = await supabase
    .from('issues')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update issue:', error);
    throw error;
  }

  return data;
}

/**
 * 이슈 삭제
 */
export async function deleteIssue(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('issues')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete issue:', error);
    return false;
  }

  return true;
}

/**
 * 이슈 통계 조회
 */
export async function getIssueStats(issues: Issue[]): Promise<IssueStats> {
  const total = issues.length;
  const completed = issues.filter((issue) => issue.status === '완료').length;
  const inProgress = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    inProgress,
    completed,
    completionRate,
  };
}

/**
 * 카테고리별 이슈 개수
 */
export async function getCategoryStats(issues: Issue[]): Promise<CategoryCount[]> {
  const categoryMap = new Map<string, number>();

  issues.forEach((issue) => {
    const count = categoryMap.get(issue.category) || 0;
    categoryMap.set(issue.category, count + 1);
  });

  return Array.from(categoryMap.entries())
    .map(([category, count]) => ({
      category: category as any,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Entity별 이슈 개수
 */
export async function getEntityStats(issues: Issue[]): Promise<EntityCount[]> {
  const entityMap = new Map<string, { name: string; count: number }>();

  issues.forEach((issue) => {
    const existing = entityMap.get(issue.entity_id) || { name: '', count: 0 };
    entityMap.set(issue.entity_id, {
      name: existing.name,
      count: existing.count + 1,
    });
  });

  return Array.from(entityMap.entries())
    .map(([entity_id, { name, count }]) => ({
      entity_id,
      entity_name: name,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

