/**
 * Supabase 클라이언트 초기화
 * 환경 변수 사용
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

/**
 * Supabase 클라이언트 인스턴스
 * 타입 안전성을 위해 Database 타입 적용
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
