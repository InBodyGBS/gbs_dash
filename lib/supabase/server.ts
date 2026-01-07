import { createClient } from '@supabase/supabase-js';

export function createServerClient() {

  const supabaseUrl = 'https://zaeyagrtriyhxodvcdyh.supabase.co';

  

  // Legacy anon key (eyJ로 시작, 500자 이상)

  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZXlhZ3J0cml5aHhvZHZjZHloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTExMDMsImV4cCI6MjA4MzI4NzEwM30.8_EQyjEijqNMaZKatCId0geS86_Mgxs4muUWfpb13WM';

  return createClient(supabaseUrl, supabaseKey, {

    auth: {

      persistSession: false,

    },

  });

}

