import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * POST — 상세 조회 시 조회수 +1 (service role 우선)
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'missing id' }, { status: 400 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }

  const { data: row, error: selErr } = await supabase
    .from('announcements')
    .select('view_count')
    .eq('id', id)
    .maybeSingle();

  if (selErr || !row) {
    return NextResponse.json({ error: selErr?.message || 'not found' }, { status: 404 });
  }

  const current = typeof (row as { view_count?: number }).view_count === 'number'
    ? (row as { view_count: number }).view_count
    : 0;
  const next = current + 1;

  const { error: updErr } = await supabase
    .from('announcements')
    .update({ view_count: next })
    .eq('id', id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ view_count: next });
}
