'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadFinancialResultFile, saveFinancialResultData } from '@/lib/services/financialResultService';
import type { ExcelRowData } from '@/lib/services/financialResultService';

interface FinancialResultUploadProps {
  onUploadSuccess: () => void;
}

type ExcelUploadRow = {
  Entity?: string;
  Period?: string;
  Rev_Account?: string;
  'Amount(KRW)'?: number | string;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

export function FinancialResultUpload({ onUploadSuccess }: FinancialResultUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear());
  const [quarter, setQuarter] = useState<number>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const parseExcelFile = async (file: File): Promise<ExcelRowData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const XLSX = await import('xlsx');
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          
          // PL 시트 찾기
          let sheetName = 'PL';
          if (!workbook.SheetNames.includes('PL')) {
            // PL 시트가 없으면 첫 번째 시트 사용
            sheetName = workbook.SheetNames[0];
          }
          
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelUploadRow[];
          
          // 필요한 컬럼 검증
          const requiredColumns = ['Entity', 'Period', 'Rev_Account', 'Amount(KRW)'];
          const firstRow = jsonData[0];
          if (!firstRow) {
            reject(new Error('Excel 파일이 비어있습니다.'));
            return;
          }
          
          const missingColumns = requiredColumns.filter(
            (col) => !(col in firstRow)
          );
          
          if (missingColumns.length > 0) {
            reject(
              new Error(
                `필수 컬럼이 없습니다: ${missingColumns.join(', ')}\n필요한 컬럼: ${requiredColumns.join(', ')}`
              )
            );
            return;
          }
          
          // 데이터 변환
          const parsedData: ExcelRowData[] = jsonData
            .filter((row) => {
              // 빈 행 제외
              return row.Entity && row.Period && row['Rev_Account'];
            })
            .map((row) => ({
              Entity: String(row.Entity || '').trim(),
              Period: String(row.Period || '').trim(),
              'Rev_Account': String(row['Rev_Account'] || '').trim(),
              'Amount(KRW)': Number(row['Amount(KRW)'] || 0),
            }));
          
          if (parsedData.length === 0) {
            reject(new Error('유효한 데이터가 없습니다.'));
            return;
          }
          
          resolve(parsedData);
        } catch (error: unknown) {
          reject(new Error(`Excel 파일 파싱 실패: ${getErrorMessage(error)}`));
        }
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsBinaryString(file);
    });
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

      setSelectedFile(file);
    },
    []
  );

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    try {
      // 1. 파일 업로드
      const fileRecord = await uploadFinancialResultFile(selectedFile, fiscalYear, quarter);
      toast.success('파일 업로드 완료', {
        description: '데이터 파싱 중...',
      });

      // 2. Excel 파일 파싱
      const parsedData = await parseExcelFile(selectedFile);
      toast.success('파일 파싱 완료', {
        description: `${parsedData.length}개의 데이터 행을 찾았습니다.`,
      });

      // 3. 데이터 저장
      await saveFinancialResultData(fileRecord.id, parsedData);
      toast.success('업로드 완료', {
        description: `${selectedFile.name}이(가) 성공적으로 업로드되었습니다.`,
      });

      setSelectedFile(null);
      onUploadSuccess();
    } catch (error: unknown) {
      console.error('Upload Error:', error);
      toast.error('업로드 실패', {
        description: getErrorMessage(error),
      });
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    multiple: false,
    disabled: uploading,
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">분기별 실적 파일 업로드</h3>
          <p className="text-sm text-gray-500 mt-1">
            Excel 파일을 업로드하여 분기별 증감표를 생성합니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fiscal-year">귀속연도</Label>
          <Input
            id="fiscal-year"
            type="number"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value) || new Date().getFullYear())}
            min={2020}
            max={2100}
            disabled={uploading}
          />
        </div>
        <div>
          <Label htmlFor="quarter">분기</Label>
          <Select
            value={quarter.toString()}
            onValueChange={(value) => setQuarter(parseInt(value))}
            disabled={uploading}
          >
            <SelectTrigger id="quarter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1분기</SelectItem>
              <SelectItem value="2">2분기</SelectItem>
              <SelectItem value="3">3분기</SelectItem>
              <SelectItem value="4">4분기</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedFile ? (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleUpload}
              disabled={uploading}
              size="sm"
            >
              {uploading ? '업로드 중...' : '업로드'}
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
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400',
            uploading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-sm font-medium text-gray-900 mb-1">
            {isDragActive ? '파일을 여기에 놓으세요' : '파일을 드래그하거나 클릭하여 업로드'}
          </p>
          <p className="text-xs text-gray-500">
            Excel 파일 (.xls, .xlsx) - 필수 컬럼: Entity, Period, Rev_Account, Amount(KRW)
          </p>
        </div>
      )}
    </div>
  );
}
