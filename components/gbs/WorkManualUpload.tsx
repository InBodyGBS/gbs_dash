'use client';

/**
 * 업무기술서 파일 업로드 컴포넌트
 */

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { uploadWorkManual } from '@/lib/services/workManualService';
import { toast } from 'sonner';
import type { WorkManualType } from '@/lib/types/work-manual';

interface WorkManualUploadProps {
  onUploadSuccess: () => void;
}

export function WorkManualUpload({ onUploadSuccess }: WorkManualUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [fileType, setFileType] = useState<WorkManualType>('업무기술서');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // .docx와 .xlsx 파일만 허용
    if (!file.name.endsWith('.docx') && !file.name.endsWith('.xlsx')) {
      toast.error('파일 형식 오류', {
        description: 'DOCX 또는 XLSX 파일만 업로드 가능합니다.',
      });
      return;
    }

    setUploading(true);
    try {
      console.log('Uploading with fileType:', fileType);
      await uploadWorkManual(file, fileType);
      toast.success('파일 업로드 완료', {
        description: `${file.name}이(가) ${fileType} 유형으로 성공적으로 업로드되었습니다.`,
      });
      onUploadSuccess();
    } catch (error: any) {
      toast.error('업로드 실패', {
        description: error.message || '파일 업로드 중 오류가 발생했습니다.',
      });
    } finally {
      setUploading(false);
    }
  }, [onUploadSuccess, fileType]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
    disabled: uploading,
  });

  return (
    <div className="space-y-2">
      {/* 파일 유형 선택 */}
      <div className="bg-white rounded-lg border border-gray-200 p-2">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium text-gray-700 whitespace-nowrap">파일 유형:</Label>
          <RadioGroup
            value={fileType}
            onValueChange={(value) => {
              const newValue = value as WorkManualType;
              console.log('RadioGroup value changed from', fileType, 'to', newValue);
              console.log('RadioGroupItem values: 업무기술서, 업무분장표');
              setFileType(newValue);
              console.log('fileType state after set:', newValue);
            }}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="업무기술서" id="type-manual" />
              <Label htmlFor="type-manual" className="cursor-pointer text-sm">
                업무기술서
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="업무분장표" id="type-assignment" />
              <Label htmlFor="type-assignment" className="cursor-pointer text-sm">
                업무분장표
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      {/* 파일 업로드 영역 */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors',
          isDragActive
            ? ''
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          uploading && 'opacity-50 cursor-not-allowed'
        )}
        style={isDragActive ? { borderColor: '#971B2F', backgroundColor: 'rgba(151, 27, 47, 0.1)' } : undefined}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#971B2F' }}></div>
              <p className="text-xs text-gray-600">업로드 중...</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full" style={{ backgroundColor: 'rgba(151, 27, 47, 0.1)' }}>
                  <Upload className="h-4 w-4" style={{ color: '#971B2F' }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">
                    파일을 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="text-xs text-gray-500">
                    .docx 또는 .xlsx 파일만 업로드 가능
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
