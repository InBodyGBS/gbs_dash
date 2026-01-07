/**
 * Supabase 클라이언트 초기화
 * 하드코딩된 값 사용 (데모용)
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// 하드코딩된 Supabase 설정
const supabaseUrl = 'https://zaeyagrtriyhxodvcdyh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZXlhZ3J0cml5aHhvZHZjZHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTExMDMsImV4cCI6MjA4MzI4NzEwM30.8_EQyjEijqNMaZKatCId0geS86_Mgxs4muUWfpb13WM';

/**
 * Supabase 클라이언트 인스턴스
 * 타입 안전성을 위해 Database 타입 적용
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

