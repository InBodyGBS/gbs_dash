'use client';

/**
 * 로그인 페이지
 * 접근 시 바로 main 페이지로 리다이렉트
 */

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 로그인 페이지 접근 시 바로 main 페이지로 리다이렉트
  useEffect(() => {
    const redirect = searchParams.get('redirect') || '/';
    router.replace(redirect);
  }, [router, searchParams]);

  // 리다이렉트 중 로딩 표시
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#971B2F' }}></div>
        <p className="text-gray-600">리다이렉트 중...</p>
      </div>
    </div>
  );
}
