'use client';

/**
 * Monthly Closing - Upload 페이지
 * Trial Balance 파일 업로드
 */

import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  uploadTBFile,
  saveTBRawData,
  getTBUploads,
  generatePL,
  deleteTBUpload,
} from '@/lib/services/monthlyClosingService';
import type { TBUpload, TBParsedRow } from '@/lib/types/monthly-closing';
import type { Subsidiary } from '@/lib/supabase/types';

export default function UploadPage() {
  // 필터 상태
  const [selectedEntityCode, setSelectedEntityCode] = useState<string>('');
  const [selectedSubsidiaryId, setSelectedSubsidiaryId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(new Date().getMonth() === 0 ? 12 : new Date().getMonth()) // 전월 기본값
  );

  // 데이터 상태
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [uploads, setUploads] = useState<TBUpload[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadUploads();
  }, [selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: subsData } = await supabase
        .from('subsidiaries')
        .select('*')
        .order('name');
      setSubsidiaries(subsData || []);
      await loadUploads();
    } catch (error: any) {
      console.error('Failed to load data:', error);
      toast.error('데이터 로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadUploads = async () => {
    try {
      const data = await getTBUploads(undefined, parseInt(selectedYear));
      setUploads(data);
    } catch (error: any) {
      console.error('Failed to load uploads:', error);
    }
  };

  // Entity 선택 시 subsidiary_id도 세팅
  const handleEntitySelect = (code: string) => {
    setSelectedEntityCode(code);
    const sub = subsidiaries.find((s) => s.code === code);
    setSelectedSubsidiaryId(sub?.id || null);
  };

  // Excel 파일 파싱
  const parseExcelFile = async (file: File): Promise<TBParsedRow[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

          if (jsonData.length === 0) {
            reject(new Error('Excel 파일이 비어있습니다.'));
            return;
          }

          // 필수 컬럼 확인 (유연한 매칭)
          const firstRow = jsonData[0];
          const keys = Object.keys(firstRow);

          // 정확한 매칭 우선, 없으면 부분 매칭
          const findCol = (names: string[]) => {
            // 1. 정확한 매칭 (대소문자 무시)
            for (const name of names) {
              const exact = keys.find((k) => k.toLowerCase() === name.toLowerCase());
              if (exact) return exact;
            }
            // 2. 부분 매칭 (대소문자 무시)
            for (const name of names) {
              const partial = keys.find((k) => k.toLowerCase().includes(name.toLowerCase()));
              if (partial) return partial;
            }
            return undefined;
          };

          const codeCol = findCol(['MainAccount', 'Account Code', 'account_code', '계정코드', 'Code']);
          const nameCol = findCol(['Name', 'Account Name', 'account_name', '계정명']);
          const debitCol = findCol(['Debit', '차변']);
          const creditCol = findCol(['Credit', '대변']);
          // Closing balance를 최우선으로 찾음
          const balanceCol = findCol(['Closing balance', '기말잔액', 'Closing Balance', 'ClosingBalance']);

          // 디버그: 찾은 컬럼 출력
          console.log('=== Excel 파싱 디버그 ===');
          console.log('Excel 컬럼:', keys);
          console.log('매핑된 컬럼:', { codeCol, nameCol, debitCol, creditCol, balanceCol });
          // 첫 번째 데이터 행의 값 확인
          if (jsonData.length > 0) {
            const sample = jsonData[0];
            console.log('첫 번째 행 샘플:', {
              code: sample[codeCol!],
              name: sample[nameCol!],
              debit: sample[debitCol!],
              credit: sample[creditCol!],
              balance: balanceCol ? sample[balanceCol!] : 'N/A',
            });
          }

          if (!codeCol || !nameCol) {
            reject(
              new Error(
                `필수 컬럼이 누락되었습니다.\n필요: MainAccount, Name\n발견: ${keys.join(', ')}`
              )
            );
            return;
          }

          const parsedRows: TBParsedRow[] = jsonData
            .filter((row) => row[codeCol!])
            .map((row) => {
              const debit = Number(row[debitCol!] || 0);
              const credit = Number(row[creditCol!] || 0);
              const balance = balanceCol ? Number(row[balanceCol!] || 0) : debit - credit;

              return {
                accountCode: String(row[codeCol!]).trim(),
                accountName: String(row[nameCol!] || '').trim(),
                debit,
                credit,
                balance,
                description: row['Description'] || row['description'] || undefined,
              };
            });

          if (parsedRows.length === 0) {
            reject(new Error('유효한 데이터가 없습니다.'));
            return;
          }

          resolve(parsedRows);
        } catch (err: any) {
          reject(new Error(`파일 파싱 실패: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsBinaryString(file);
    });
  };

  // Drag & Drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xls', 'xlsx', 'csv'].includes(ext || '')) {
      toast.error('파일 형식 오류', { description: 'Excel/CSV 파일만 업로드 가능합니다.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('파일 크기 초과', { description: '파일 크기는 10MB를 초과할 수 없습니다.' });
      return;
    }
    setSelectedFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    multiple: false,
    disabled: uploading,
  });

  // 업로드 처리
  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('파일을 선택해주세요.');
      return;
    }
    if (!selectedEntityCode) {
      toast.error('Entity를 선택해주세요.');
      return;
    }

    setUploading(true);
    try {
      // 1. 파일 업로드
      const uploadRecord = await uploadTBFile(
        selectedFile,
        selectedEntityCode,
        selectedSubsidiaryId,
        parseInt(selectedYear),
        parseInt(selectedMonth)
      );
      toast.success('파일 업로드 완료', { description: '데이터 파싱 중...' });

      // 2. Excel 파싱
      const parsedData = await parseExcelFile(selectedFile);
      toast.success('파일 파싱 완료', {
        description: `${parsedData.length}개의 계정 데이터를 찾았습니다.`,
      });

      // 3. 원장 데이터 저장
      await saveTBRawData(uploadRecord.id, parsedData);

      // 4. P&L 자동 생성 시도
      try {
        await generatePL(uploadRecord.id);
        toast.success('P&L 생성 완료', {
          description: 'COA 매핑을 기반으로 P&L이 생성되었습니다.',
        });
      } catch {
        toast.info('P&L 생성 보류', {
          description: 'COA 매핑을 먼저 설정해주세요.',
        });
      }

      setSelectedFile(null);
      await loadUploads();
    } catch (error: any) {
      console.error('Upload Error:', error);
      toast.error('업로드 실패', { description: error.message });
    } finally {
      setUploading(false);
    }
  };

  // 연도/월 옵션
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2019 }, (_, i) => String(2020 + i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1));

  // 삭제 처리
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDeleteUpload = async (uploadId: string, fileName: string) => {
    if (!confirm(`"${fileName}" 업로드를 삭제하시겠습니까?\n\n관련된 모든 데이터(TB 원장, P&L 결과)도 함께 삭제됩니다.`)) {
      return;
    }

    setDeleting(uploadId);
    try {
      await deleteTBUpload(uploadId);
      toast.success('업로드 삭제 완료', { description: fileName });
      await loadUploads();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('삭제 실패', { description: error.message });
    } finally {
      setDeleting(null);
    }
  };

  // 상태 뱃지
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'mapped':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle2 className="h-3 w-3" /> Mapped
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <AlertCircle className="h-3 w-3" /> Partial
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertCircle className="h-3 w-3" /> Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Clock className="h-3 w-3" /> Uploaded
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto py-6 overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Trial Balance Upload</h1>
        <p className="text-gray-600">
          해외법인의 Trial Balance 파일을 업로드하여 월별 마감 자료를 제출합니다.
        </p>
      </div>

      {/* Upload Form */}
      <Card className="flex-shrink-0 mb-6">
        <CardHeader>
          <CardTitle>TB 파일 업로드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Entity / Year / Month 선택 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Entity</Label>
              <Select value={selectedEntityCode} onValueChange={handleEntitySelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Entity 선택" />
                </SelectTrigger>
                <SelectContent position="popper">
                  {subsidiaries.map((sub) => (
                    <SelectItem key={sub.id} value={sub.code}>
                      {sub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>연도</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}년
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>월</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}월
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File Upload Area */}
          {selectedFile ? (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleUpload} disabled={uploading || !selectedEntityCode} size="sm">
                  {uploading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      업로드
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50',
                uploading && 'opacity-50 cursor-not-allowed'
              )}
              style={isDragActive ? { borderColor: '#971B2F', backgroundColor: 'rgba(151, 27, 47, 0.05)' } : undefined}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-sm font-medium text-gray-900 mb-1">
                {isDragActive ? '파일을 여기에 놓으세요' : '파일을 드래그하거나 클릭하여 업로드'}
              </p>
              <p className="text-xs text-gray-500">
                Excel (.xls, .xlsx) 또는 CSV (.csv) · 최대 10MB
              </p>
              <p className="text-xs text-gray-400 mt-2">
                필수 컬럼: Account Code, Account Name, Debit, Credit
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload History */}
      <Card className="flex-1 min-h-0">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>업로드 이력</CardTitle>
          <Button variant="outline" size="sm" onClick={loadUploads}>
            <RefreshCw className="h-4 w-4 mr-2" />
            새로고침
          </Button>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <p className="text-gray-500 text-center py-8">업로드된 파일이 없습니다.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {uploads.map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{upload.file_name}</p>
                      <p className="text-xs text-gray-500">
                        {upload.entity_code} · {upload.period_year}년 {upload.period_month}월 ·{' '}
                        {(upload.file_size / 1024).toFixed(1)} KB ·{' '}
                        {new Date(upload.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {upload.unmapped_count > 0 && (
                      <span className="text-xs text-orange-600">
                        Unmapped: {upload.unmapped_count}
                      </span>
                    )}
                    {getStatusBadge(upload.status)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUpload(upload.id, upload.file_name)}
                      disabled={deleting === upload.id}
                      className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                      {deleting === upload.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
