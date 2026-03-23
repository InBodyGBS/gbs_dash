/**
 * Topic Service
 * CRUD operations for closing topics
 */

import { supabase } from '@/lib/supabase/client';
import type { ClosingTopic } from '@/lib/types/reference';

/**
 * Get all active topics
 */
export async function getTopics(): Promise<ClosingTopic[]> {
  try {
    const { data, error } = await supabase
      .from('closing_topics')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true });

    if (error) {
      // Table doesn't exist or other database error
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('closing_topics table does not exist. Please run the schema migration.');
        return [];
      }
      throw error;
    }
    return (data || []) as unknown as ClosingTopic[];
  } catch (error) {
    console.error('Error fetching topics:', error);
    // Return empty array instead of throwing to prevent app crash
    return [];
  }
}

/**
 * Get topic by ID
 */
export async function getTopicById(id: string): Promise<ClosingTopic | null> {
  const { data, error } = await supabase
    .from('closing_topics')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as unknown as ClosingTopic;
}

/**
 * Get topic by code
 */
export async function getTopicByCode(code: string): Promise<ClosingTopic | null> {
  const { data, error } = await supabase
    .from('closing_topics')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data as unknown as ClosingTopic;
}

/**
 * Search topics by query
 */
export async function searchTopics(query: string): Promise<ClosingTopic[]> {
  try {
    const { data, error } = await supabase
      .from('closing_topics')
      .select('*')
      .eq('is_active', true)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,content.ilike.%${query}%`)
      .order('order_index', { ascending: true });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('closing_topics table does not exist. Please run the schema migration.');
        return [];
      }
      throw error;
    }
    return (data || []) as unknown as ClosingTopic[];
  } catch (error) {
    console.error('Error searching topics:', error);
    return [];
  }
}
