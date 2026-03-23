import { supabase } from '@/lib/supabase/client';

export interface ProcessRecord {
  id: string;
  title: string;
  entity_id: string;
  category: string;
  description: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flowchart_data: any;
  version: number;
  status: string;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getProcesses(): Promise<ProcessRecord[]> {
  const { data, error } = await supabase
    .from('processes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as ProcessRecord[];
}

export async function getProcess(id: string): Promise<ProcessRecord> {
  const { data, error } = await supabase
    .from('processes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as ProcessRecord;
}

export async function updateProcess(
  id: string,
  updates: Partial<ProcessRecord>
): Promise<ProcessRecord> {
  const { data, error } = await supabase
    .from('processes')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ProcessRecord;
}

export async function createProcess(
  processData: Omit<ProcessRecord, 'id' | 'created_at' | 'updated_at'>
): Promise<ProcessRecord> {
  const { data, error } = await supabase
    .from('processes')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(processData as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as ProcessRecord;
}
