'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Download, FileSpreadsheet, Upload as UploadIcon, Trash2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createSubmissionViaApi } from '@/lib/services/submissionService';
import { downloadSubmissionTemplate } from '@/lib/utils/submissionTemplate';
import {
  getSubmissionTemplate,
  downloadTemplateFile,
  uploadSubmissionTemplate,
  deleteSubmissionTemplate,
  type SubmissionTemplate,
} from '@/lib/services/submissionTemplateService';
import { getIsAdminUser } from '@/lib/auth/admin';
import type { ClosingCategoryId } from '@/lib/constants/closing-categories';
import { CLOSING_CATEGORIES } from '@/lib/constants/closing-categories';

interface SubmissionUploadProps {
  onUploadSuccess: () => void;
  category: ClosingCategoryId;
  quarterId?: string | null;
  subsidiaryId?: string | null;
  fiscalYear?: string | null;
  /** Overview 상단과 동일한 귀속 월(1–12), 확정 여부·API 검증에 사용 */
  closingMonth?: string | null;
  entityName?: string | null;
  /** Overview에서 확정된 셀이면 업로드 비활성화 */
  uploadBlocked?: boolean;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

const BLOCKED_MESSAGE =
  'Overview에서 확정된 자료는 추가 업로드할 수 없습니다. Overview에서 Confirm을 해제한 뒤 다시 시도해 주세요.';

export function SubmissionUpload({
  onUploadSuccess,
  category,
  quarterId,
  subsidiaryId,
  fiscalYear,
  closingMonth,
  entityName,
  uploadBlocked = false,
}: SubmissionUploadProps) {
  const [uploading, setUploading] = useState(false);

  // 관리자 여부 + 현재 카테고리의 등록된 템플릿 상태
  const [isAdmin, setIsAdmin] = useState(false);
  const [registeredTemplate, setRegisteredTemplate] = useState<SubmissionTemplate | null>(null);
  const [templateUploading, setTemplateUploading] = useState(false);
  const templateInputRef = useRef<HTMLInputElement | null>(null);

  // 관리자 권한 1회 조회
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const admin = await getIsAdminUser();
      if (!cancelled) setIsAdmin(admin);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 카테고리 바뀔 때마다 등록된 템플릿 조회
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tpl = await getSubmissionTemplate(category);
        if (!cancelled) setRegisteredTemplate(tpl);
      } catch (e) {
        console.warn('템플릿 조회 실패:', e);
        if (!cancelled) setRegisteredTemplate(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category]);

  const categoryLabel = CLOSING_CATEGORIES.find((cat) => cat.id === category)?.label || category;

  const handleTemplateDownload = async () => {
    try {
      // 1) 등록된 템플릿이 있으면 그 파일 다운로드
      if (registeredTemplate) {
        const blob = await downloadTemplateFile(registeredTemplate.file_path);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = registeredTemplate.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('템플릿 다운로드 완료', {
          description: `${categoryLabel} 양식이 다운로드되었습니다.`,
        });
        return;
      }
      // 2) 없으면 기본 생성 템플릿 폴백
      await downloadSubmissionTemplate(category);
      toast.success('기본 템플릿 다운로드 완료', {
        description: `등록된 양식이 없어 기본 템플릿을 다운로드합니다.`,
      });
    } catch (error: unknown) {
      toast.error('템플릿 다운로드 실패', {
        description: getErrorMessage(error),
      });
    }
  };

  const handleTemplateUploadClick = () => {
    if (!isAdmin) return;
    templateInputRef.current?.click();
  };

  const handleTemplateFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 가능하도록 reset
    if (!file) return;
    if (!isAdmin) {
      toast.error('관리자 권한이 필요합니다.');
      return;
    }
    setTemplateUploading(true);
    try {
      const tpl = await uploadSubmissionTemplate({ categoryId: category, file });
      setRegisteredTemplate(tpl);
      toast.success('템플릿 등록 완료', {
        description: `${categoryLabel} 양식이 갱신되었습니다.`,
      });
    } catch (err) {
      toast.error('템플릿 업로드 실패', {
        description: getErrorMessage(err),
      });
    } finally {
      setTemplateUploading(false);
    }
  };

  const handleTemplateDelete = async () => {
    if (!isAdmin || !registeredTemplate) return;
    if (!confirm(`${categoryLabel} 등록된 템플릿을 삭제하시겠습니까?\n사용자는 기본 템플릿으로 폴백됩니다.`)) {
      return;
    }
    try {
      await deleteSubmissionTemplate(category);
      setRegisteredTemplate(null);
      toast.success('템플릿 삭제 완료');
    } catch (err) {
      toast.error('템플릿 삭제 실패', {
        description: getErrorMessage(err),
      });
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (uploadBlocked) {
        toast.error('업로드할 수 없습니다', { description: BLOCKED_MESSAGE });
        return;
      }

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
          closing_month: closingMonth ?? null,
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
    [category, quarterId, subsidiaryId, fiscalYear, entityName, closingMonth, uploadBlocked, onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
    disabled: uploading || uploadBlocked,
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">제출 파일 업로드</h3>
          <p className="text-sm text-gray-600 mt-1">{categoryLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 다운로드 버튼 — 모두 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTemplateDownload}
            className="flex items-center gap-2"
            title={registeredTemplate ? `등록된 양식: ${registeredTemplate.file_name}` : '등록된 양식이 없어 기본 템플릿을 받습니다.'}
          >
            <Download className="h-4 w-4" />
            템플릿 다운로드
          </Button>

          {/* Admin 전용 — 템플릿 업로드/삭제 */}
          {isAdmin && (
            <>
              <input
                ref={templateInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={handleTemplateFileSelected}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleTemplateUploadClick}
                disabled={templateUploading}
                className="flex items-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
                title="관리자: 이 카테고리의 양식을 업로드/교체"
              >
                <UploadIcon className="h-4 w-4" />
                {templateUploading
                  ? '업로드 중...'
                  : registeredTemplate
                    ? '템플릿 교체'
                    : '템플릿 등록'}
                <ShieldCheck className="h-3 w-3 ml-0.5 text-purple-500" />
              </Button>
              {registeredTemplate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTemplateDelete}
                  className="flex items-center gap-1 border-red-200 text-red-600 hover:bg-red-50"
                  title="등록된 양식 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 등록된 템플릿 정보 — 작은 안내 */}
      {registeredTemplate ? (
        <div className="flex items-center gap-2 text-xs text-gray-500 -mt-1">
          <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
          <span className="font-medium text-green-700">등록된 양식</span>
          <span className="text-gray-400">·</span>
          <span className="truncate">{registeredTemplate.file_name}</span>
          <span className="text-gray-400">·</span>
          <span>{(registeredTemplate.file_size / 1024).toFixed(1)} KB</span>
        </div>
      ) : isAdmin ? (
        <p className="text-xs text-amber-700 -mt-1">
          ⚠️ 등록된 양식이 없어 사용자는 기본(샘플) 템플릿을 받게 됩니다. 우측 <strong>템플릿 등록</strong>으로 실제 양식을 올려주세요.
        </p>
      ) : null}

      {uploadBlocked && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {BLOCKED_MESSAGE}
        </p>
      )}

      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? ''
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
          (uploading || uploadBlocked) && 'opacity-50 cursor-not-allowed',
          uploadBlocked && 'pointer-events-none',
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
