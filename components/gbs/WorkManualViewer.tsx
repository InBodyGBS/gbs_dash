'use client';

/**
 * 업무기술서 문서 뷰어 컴포넌트
 * mammoth.js를 사용하여 .docx 파일을 HTML로 변환하여 표시
 */

import { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import { getWorkManualUrl } from '@/lib/services/workManualService';
import type { WorkManual } from '@/lib/types/work-manual';

interface WorkManualViewerProps {
  manual: WorkManual | null;
}

export function WorkManualViewer({ manual }: WorkManualViewerProps) {
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!manual) {
      setHtmlContent('');
      return;
    }

    const loadDocument = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. 파일 URL 가져오기
        const fileUrl = await getWorkManualUrl(manual.file_path);
        console.log('File URL:', fileUrl);
        console.log('File path:', manual.file_path);

        // 2. 파일 다운로드
        const response = await fetch(fileUrl);
        console.log('Fetch response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Fetch error response:', errorText);
          throw new Error(`파일 다운로드 실패 (${response.status}): ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // 3. mammoth.js로 HTML 변환 (docx 파일만)
        if (manual.file_name.endsWith('.docx')) {
          const result = await mammoth.convertToHtml({ arrayBuffer });
          setHtmlContent(result.value);
        } else if (manual.file_name.endsWith('.xlsx')) {
          // xlsx 파일은 아직 파싱 미지원
          setError('XLSX 파일은 아직 미리보기를 지원하지 않습니다.');
        } else {
          setError('지원하지 않는 파일 형식입니다.');
        }
      } catch (err: any) {
        const errorMessage = err.message || '문서를 불러오는 중 오류가 발생했습니다.';
        setError(errorMessage);
        console.error('Document load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [manual]);

  if (!manual) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-500">파일을 선택하여 내용을 확인하세요.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: '#971B2F' }}></div>
        <p className="text-gray-600">문서를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-12 text-center">
        <p className="text-red-600 font-medium mb-2">오류 발생</p>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-8">
      <style dangerouslySetInnerHTML={{ __html: `
        .work-manual-content h1 {
          font-size: 1.875rem;
          font-weight: 700;
          color: #111827;
          margin-bottom: 1.5rem;
        }
        .work-manual-content h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e40af;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        .work-manual-content h3 {
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .work-manual-content p {
          font-size: 1rem;
          color: #374151;
          line-height: 1.75;
          margin-bottom: 1rem;
        }
        .work-manual-content ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .work-manual-content li {
          margin-bottom: 0.5rem;
          color: #374151;
        }
        .work-manual-content strong {
          font-weight: 600;
          color: #111827;
        }
      `}} />
      <div
        className="work-manual-content"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
}
