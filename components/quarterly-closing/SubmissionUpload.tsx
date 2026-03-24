'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createSubmissionViaApi } from '@/lib/services/submissionService';
import { downloadSubmissionTemplate } from '@/lib/utils/submissionTemplate';
import type { ClosingCategoryId } from '@/lib/constants/closing-categories';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';

interface SubmissionUploadProps {
  onUploadSuccess: () => void;
  category: ClosingCategoryId;
  quarterId?: string | null;
  subsidiaryId?: string | null;
  fiscalYear?: string | null;
  entityName?: string | null;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

export function SubmissionUpload({
  onUploadSuccess,
  category,
  quarterId,
  subsidiaryId,
  fiscalYear,
  entityName,
}: SubmissionUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleTemplateDownload = () => {
    try {
      downloadSubmissionTemplate(category);
      const categoryLabel = CLOSING_CATEGORIES.find((cat) => cat.id === category)?.label || category;
      toast.success('템플릿 다운로드 완료', {
        description: `${categoryLabel} 템플릿이 다운로드되었습니다.`,
      });
    } catch (error: unknown) {
      toast.error('템플릿 다운로드 실패', {
        description: getErrorMessage(error),
      });
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Excel 파일 검증
      if (!file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
        toast.error('파일 형식 오류', {
          description: 'Excel 파일만 업로드 가능합니다 (.xls, .xlsx)',
        });
        return;
      }

      setUploading(true);
      try {
        await createSubmissionViaApi({
          category,
          file,
          quarter_id: quarterId || null,
          subsidiary_id: subsidiaryId || null,
          fiscal_year: fiscalYear || null,
          entity_name: entityName || null,
        });
        toast.success('파일 업로드 완료', {
          description: `${file.name}이(가) 성공적으로 업로드되었습니다.`,
        });
        onUploadSuccess();
      } catch (error: unknown) {
        toast.error('업로드 실패', {
          description: getErrorMessage(error),
        });
      } finally {
        setUploading(false);
      }
    },
    [category, quarterId, subsidiaryId, fiscalYear, entityName, onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
    disabled: uploading,
  });

  const categoryLabel = CLOSING_CATEGORIES.find((cat) => cat.id === category)?.label || category;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">제출 파일 업로드</h3>
          <p className="text-sm text-gray-600 mt-1">{categoryLabel}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTemplateDownload}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          템플릿 다운로드
        </Button>
      </div>

      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? ''
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          uploading && 'opacity-50 cursor-not-allowed'
        )}
        style={
          isDragActive
            ? { borderColor: '#971B2F', backgroundColor: 'rgba(151, 27, 47, 0.1)' }
            : undefined
        }
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="space-y-2">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
              style={{ borderColor: '#971B2F' }}
            ></div>
            <p className="text-sm text-gray-600">업로드 중...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <FileSpreadsheet className="h-12 w-12 mx-auto" style={{ color: '#971B2F' }} />
            <div>
              <p className="text-sm font-medium text-gray-900">
                파일을 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Excel 파일만 업로드 가능 (.xls, .xlsx)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
