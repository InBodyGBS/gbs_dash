import { supabase } from '@/lib/supabase/client';
import { FinancialResultClient } from '@/components/financial-result/FinancialResultClient';

export default async function FinancialResultPage() {
  const { data: subsidiaries, error } = await supabase
    .from('subsidiaries')
    .select('*')
    .order('name');

  if (error) {
    console.error('Supabase error:', error);
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">데이터 로딩 실패</h2>
          <p className="text-gray-600">{error.message}</p>
        </div>
      </div>
    );
  }

  const EXCLUDED = ['Germany', 'UK', 'Singapore'];
  const filtered = (subsidiaries || []).filter(
    (s) => !EXCLUDED.some((ex) => s.name.includes(ex))
  );

  return <FinancialResultClient subsidiaries={filtered} />;
}
