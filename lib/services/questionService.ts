/**
 * Question Service
 * CRUD operations for closing questions
 */

import { supabase } from '@/lib/supabase/client';
import type { ClosingQuestion, QuestionView } from '@/lib/types/reference';

/**
 * Get questions by topic ID
 */
export async function getQuestionsByTopic(
  topicId: string,
  includePublic: boolean = true
): Promise<ClosingQuestion[]> {
  let query = supabase
    .from('closing_questions')
    .select('*')
    .eq('topic_id', topicId)
    .order('asked_at', { ascending: false });

  if (includePublic) {
    query = query.or('is_public.eq.true,status.eq.answered');
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as unknown as ClosingQuestion[];
}

/**
 * Get questions by subsidiary ID
 */
export async function getQuestionsBySubsidiary(
  subsidiaryId: string
): Promise<ClosingQuestion[]> {
  const { data, error } = await supabase
    .from('closing_questions')
    .select('*')
    .eq('subsidiary_id', subsidiaryId)
    .order('asked_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as ClosingQuestion[];
}

/**
 * Get pending questions (for GBS team)
 */
export async function getPendingQuestions(): Promise<ClosingQuestion[]> {
  const { data, error } = await supabase
    .from('closing_questions')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('asked_at', { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as ClosingQuestion[];
}

/**
 * Create a new question
 */
export async function createQuestion(
  questionData: {
    topic_id: string | null;
    subsidiary_id: string | null;
    question: string;
    asked_by: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    tags?: string[];
  }
): Promise<ClosingQuestion> {
  const { data, error } = await supabase
    .from('closing_questions')
    .insert({
      ...questionData,
      status: 'pending',
      priority: questionData.priority || 'normal',
      is_public: false,
      tags: questionData.tags || [],
    } as Record<string, unknown>)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ClosingQuestion;
}

/**
 * Update question (answer)
 */
export async function updateQuestion(
  id: string,
  updates: {
    answer?: string;
    answered_by?: string;
    status?: 'pending' | 'answered' | 'closed';
    is_public?: boolean;
  }
): Promise<ClosingQuestion> {
  const updateData: Record<string, unknown> = { ...updates };

  if (updates.answer && updates.answered_by) {
    updateData.answered_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('closing_questions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ClosingQuestion;
}

/**
 * Record question view
 */
export async function recordQuestionView(
  viewData: {
    question_id: string;
    subsidiary_id: string;
    viewed_by: string;
  }
): Promise<QuestionView> {
  const { data, error } = await supabase
    .from('question_views')
    .insert(viewData as Record<string, unknown>)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as QuestionView;
}
