import { supabase } from '@/lib/supabase/client';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
  // Supabase에서 법인 데이터 가져오기
  const { data: subsidiaries, error } = await supabase
    .from('subsidiaries')
    .select('*')
    .order('name');

  // 에러 처리
  if (error) {
    console.error('Supabase error:', error);
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">데이터 로딩 실패</h2>
          <p className="text-gray-600">{error.message}</p>
          <p className="text-sm text-gray-400 mt-2">브라우저 콘솔을 확인하세요</p>
        </div>
      </div>
    );
  }

  // 데이터 없을 때
  if (!subsidiaries || subsidiaries.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center text-gray-500">
          <p>법인 데이터가 없습니다.</p>
          <p className="text-sm mt-2">Supabase에 데이터를 추가하세요.</p>
        </div>
      </div>
    );
  }

  // 정상: DashboardClient에 데이터 전달
  return <DashboardClient subsidiaries={subsidiaries} />;
}

