'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * GBS 메인 페이지
 * 기본적으로 업무기술서 페이지로 리다이렉트
 */

export default function GBSPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/gbs/work-manual');
  }, [router]);

  return null;
}
