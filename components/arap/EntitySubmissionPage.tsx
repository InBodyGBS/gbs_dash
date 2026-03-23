/**
 * 해외법인 페이지 - Submission Page
 * 데이터 입력 (직접 입력 또는 파일 업로드)
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Download, Plus, Trash2, Save, X, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { createArapSubmission, getArapEntities, getArapSubmissions, deleteArapSubmission } from '@/lib/services/arapService';
import type { ArapSubmissionDetailInput, ArapEntity, AccountType } from '@/lib/types/arap';
import * as XLSX from 'xlsx';

interface EntitySubmissionPageProps {
  entityId: string;
  selectedYear: number;
  selectedMonth: number;
  onSaveSuccess: () => void;
}

export function EntitySubmissionPage({
  entityId,
  selectedYear,
  selectedMonth,
  onSaveSuccess,
}: EntitySubmissionPageProps) {
  const [entities, setEntities] = useState<ArapEntity[]>([]);
  const [items, setItems] = useState<ArapSubmissionDetailInput[]>([]);
  const [submissionType, setSubmissionType] = useState<'file' | 'manual'>('manual');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);

  // Entity 목록 로드 및 기존 제출 데이터 로드
  useEffect(() => {
    loadData();
  }, [entityId, selectedYear, selectedMonth]);

  const loadData = async () => {
    try {
      const entitiesData = await getArapEntities();
      setEntities(entitiesData);

      // 기존 제출 데이터 로드
      console.log('📥 Loading submission data...', {
        entityId,
        selectedYear,
        selectedMonth,
      });
      
      const submissions = await getArapSubmissions(entityId, selectedYear, selectedMonth);
      
      console.log('📋 Loaded submissions:', {
        count: submissions?.length || 0,
        submissions: submissions?.map(s => ({
          id: s.id,
          submission_date: s.submission_date,
          submission_type: s.submission_type,
          total_items: s.total_items,
          details_count: s.submission_details?.length || 0,
        })),
      });
      
      if (submissions && submissions.length > 0) {
        // submission_date 기준으로 내림차순 정렬되어 있으므로, 가장 최신 제출 사용
        const submission = submissions[0];
        setExistingSubmission(submission);
        
        // 저장된 데이터를 폼에 로드
        const loadedItems: ArapSubmissionDetailInput[] = (submission.submission_details || []).map((detail: any) => ({
          invoice_date: detail.invoice_date || null,
          counterparty_entity_id: detail.counterparty_entity_id,
          account_type: detail.account_type,
          invoice_no: detail.invoice_no || null,
          currency: detail.currency,
          amount: detail.amount,
          description: detail.description || null,
        }));
        
        console.log('✅ Loaded items:', loadedItems.length);
        setItems(loadedItems);
        setSubmissionType(submission.submission_type);
        
        // 파일이 있는 경우 파일명 표시 (다운로드만 가능)
        if (submission.file_path) {
          // 파일은 다시 로드할 수 없으므로 파일명만 표시
          console.log('Existing file:', submission.file_path);
        }
      } else {
        // 기존 데이터가 없으면 초기화
        console.log('⚠️ No existing submission found');
        setExistingSubmission(null);
        setItems([]);
        setSubmissionType('manual');
        setUploadedFile(null);
      }
    } catch (error: any) {
      console.error('❌ Failed to load data:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });
      // 에러가 나도 계속 진행
      setExistingSubmission(null);
      setItems([]);
      setSubmissionType('manual');
      setUploadedFile(null);
    }
  };

  // 템플릿 다운로드
  const handleDownloadTemplate = () => {
    const template = [
      {
        'Invoice Date': '2024-01-15',
        'Counterparty': 'Korea HQ',
        'Account Type': 'AR',
        'Invoice No': 'INV-001',
        'Currency': 'USD',
        'Amount': 100000,
        'Description': 'Payment for...',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'ARAP_Submission_Template.xlsx');
  };

  // 파일 업로드 처리
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Only .xlsx or .xls files are allowed');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadedFile(file);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true, cellNF: false, cellText: false });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' }) as any[];

      if (jsonData.length > 1000) {
        toast.error('Maximum 1,000 rows allowed');
        return;
      }

      // Excel 날짜 serial number를 yyyy-MM-dd 형식으로 변환하는 함수
      const convertExcelDate = (value: any): string | null => {
        if (!value) return null;
        
        // 이미 yyyy-MM-dd 형식인 경우
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          return value;
        }
        
        // Date 객체인 경우
        if (value instanceof Date) {
          const year = value.getFullYear();
          const month = String(value.getMonth() + 1).padStart(2, '0');
          const day = String(value.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        
        // Excel serial number인 경우 (1900-01-01 기준)
        const serialNumber = Number(value);
        if (!isNaN(serialNumber) && serialNumber > 0) {
          // Excel의 epoch는 1900-01-01이지만, 1900년을 윤년으로 잘못 계산했으므로 1899-12-30을 사용
          const excelEpoch = new Date(1899, 11, 30);
          const date = new Date(excelEpoch.getTime() + serialNumber * 24 * 60 * 60 * 1000);
          
          // 유효한 날짜인지 확인
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        }
        
        return null;
      };

      // 데이터 검증 및 변환
      const validatedItems: ArapSubmissionDetailInput[] = [];
      const errors: string[] = [];

      jsonData.forEach((row, index) => {
        const counterparty = entities.find(
          (e) =>
            e.entity_name === row.Counterparty ||
            e.entity_code === row.Counterparty
        );

        if (!counterparty) {
          errors.push(`Row ${index + 2}: Invalid counterparty "${row.Counterparty}"`);
          return;
        }

        if (!['AR', 'AP', 'Others'].includes(row['Account Type'])) {
          errors.push(`Row ${index + 2}: Invalid account type "${row['Account Type']}"`);
          return;
        }

        if (!row.Currency || row.Currency.length !== 3) {
          errors.push(`Row ${index + 2}: Invalid currency code "${row.Currency}"`);
          return;
        }

        const amount = Number(row.Amount);
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Row ${index + 2}: Invalid amount "${row.Amount}"`);
          return;
        }

        validatedItems.push({
          invoice_date: convertExcelDate(row['Invoice Date']),
          counterparty_entity_id: counterparty.id,
          account_type: row['Account Type'] as AccountType,
          invoice_no: row['Invoice No'] || null,
          currency: row.Currency.toUpperCase(),
          amount: amount,
          description: row.Description || null,
        });
      });

      if (errors.length > 0) {
        toast.error(`Validation errors:\n${errors.slice(0, 5).join('\n')}`);
        if (errors.length > 5) {
          console.error('More errors:', errors.slice(5));
        }
        return;
      }

      // 기존 데이터에 추가 (중복 병행)
      setItems((prevItems) => [...prevItems, ...validatedItems]);
      setSubmissionType('file');
      toast.success(`Added ${validatedItems.length} items from file (${validatedItems.length + (items.length || 0)} total)`);
    } catch (error) {
      console.error('Failed to parse file:', error);
      toast.error('Failed to parse file');
    }
  }, [entities]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  // 행 추가
  const handleAddRow = () => {
    setItems([
      ...items,
      {
        counterparty_entity_id: entities[0]?.id || '',
        account_type: 'AR',
        currency: 'USD',
        amount: 0,
      },
    ]);
  };

  // 행 삭제
  const handleDeleteRow = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // 행 업데이트
  const handleUpdateRow = (index: number, field: keyof ArapSubmissionDetailInput, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // 데이터 변경 여부 확인 (빨간색 표시 조건)
  const hasChanges = (): boolean => {
    // 파일이 업로드되었으면 변경됨
    if (uploadedFile) {
      return true;
    }

    // 신규 데이터 입력 (기존 데이터가 없고 items가 있으면)
    if (!existingSubmission && items.length > 0) {
      return true;
    }

    // 기존 데이터가 있으면 비교
    if (existingSubmission) {
      const existingDetails = existingSubmission.submission_details || [];
      
      // 항목 수가 다르면 변경됨
      if (items.length !== existingDetails.length) {
        return true;
      }

      // 각 항목 비교
      for (let i = 0; i < items.length; i++) {
        const current = items[i];
        const existing = existingDetails[i];

        if (
          current.invoice_date !== (existing.invoice_date || null) ||
          current.counterparty_entity_id !== existing.counterparty_entity_id ||
          current.account_type !== existing.account_type ||
          current.invoice_no !== (existing.invoice_no || null) ||
          current.currency !== existing.currency ||
          current.amount !== existing.amount ||
          current.description !== (existing.description || null)
        ) {
          return true;
        }
      }
    }

    // 저장 후에는 변경사항 없음 (회색)
    return false;
  };

  // Excel로 내보내기
  const handleExport = () => {
    if (items.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Excel 데이터 준비
      const exportData = items.map((item) => {
        const counterparty = entities.find((e) => e.id === item.counterparty_entity_id);
        return {
          'Invoice Date': item.invoice_date || '',
          'Counterparty': counterparty?.entity_name || '',
          'Account Type': item.account_type,
          'Invoice No': item.invoice_no || '',
          'Currency': item.currency,
          'Amount': item.amount,
          'Description': item.description || '',
        };
      });

      // Excel 워크시트 생성
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // 컬럼 너비 설정
      const colWidths = [
        { wch: 12 }, // Invoice Date
        { wch: 20 }, // Counterparty
        { wch: 12 }, // Account Type
        { wch: 15 }, // Invoice No
        { wch: 8 },  // Currency
        { wch: 15 }, // Amount
        { wch: 30 }, // Description
      ];
      ws['!cols'] = colWidths;

      // 워크북 생성
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ARAP Data');

      // 파일명 생성
      const entity = entities.find((e) => e.id === entityId);
      const entityName = entity?.entity_name.replace(/\s+/g, '_') || 'Entity';
      const fileName = `ARAP_${entityName}_${selectedYear}_${selectedMonth}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // 파일 다운로드
      XLSX.writeFile(wb, fileName);
      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Failed to export data:', error);
      toast.error('Failed to export data');
    }
  };

  // 저장
  const handleSave = async () => {
    // 검증
    const errors: string[] = [];
    items.forEach((item, index) => {
      if (!item.counterparty_entity_id) {
        errors.push(`Row ${index + 1}: Counterparty is required`);
      }
      if (!item.currency || item.currency.length !== 3) {
        errors.push(`Row ${index + 1}: Currency must be 3 characters`);
      }
      if (!item.amount || item.amount <= 0) {
        errors.push(`Row ${index + 1}: Amount must be greater than 0`);
      }
    });

    if (errors.length > 0) {
      toast.error(`Please fix the following errors:\n${errors.slice(0, 5).join('\n')}`);
      return;
    }

    try {
      setLoading(true);
      console.log('💾 Saving submission...', {
        entityId,
        selectedYear,
        selectedMonth,
        itemsCount: items.length,
        hasExisting: !!existingSubmission,
      });
      
      const savedSubmission = await createArapSubmission(
        {
          fiscal_year: selectedYear,
          fiscal_month: selectedMonth,
          submission_type: submissionType,
          items,
          file: uploadedFile || undefined,
        },
        entityId
      );
      
      console.log('✅ Submission saved successfully:', {
        submissionId: savedSubmission.id,
        entityId,
        fiscalYear: selectedYear,
        fiscalMonth: selectedMonth,
        itemsCount: savedSubmission.submission_details?.length || 0,
        submissionDate: savedSubmission.submission_date,
      });
      
      // 저장 후 데이터 다시 로드하여 변경사항 초기화
      await loadData();
      
      // 업로드된 파일도 초기화 (저장 후에는 파일이 DB에 저장되었으므로)
      setUploadedFile(null);
      
      // Save success 팝업 표시
      toast.success('Save success', {
        description: 'Your submission has been saved successfully. It will be visible on all devices.',
        duration: 3000,
      });
      
      onSaveSuccess();
    } catch (error: any) {
      console.error('❌ Failed to save submission:', error);
      
      const errorMessage = error?.message || 'Failed to save submission';
      toast.error(errorMessage, {
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Submit Balance</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <div
            {...getRootProps()}
            className="cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors"
          >
            <input {...getInputProps()} />
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Upload className="h-4 w-4" />
              {isDragActive ? (
                <span>Drop the file here...</span>
              ) : (
                <span>Upload File (.xlsx, .xls)</span>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleAddRow}>
            <Plus className="h-4 w-4 mr-2" />
            Add Line
          </Button>
        </div>
      </div>


      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Invoice Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Counterparty
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Account Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Invoice No
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Currency
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No items. Click &quot;Add Line&quot; or upload a file.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Input
                        type="date"
                        value={item.invoice_date || ''}
                        onChange={(e) => handleUpdateRow(index, 'invoice_date', e.target.value)}
                        className="w-[140px]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={item.counterparty_entity_id}
                        onValueChange={(v) => handleUpdateRow(index, 'counterparty_entity_id', v)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {entities
                            .filter((e) => e.id !== entityId)
                            .map((entity) => (
                              <SelectItem key={entity.id} value={entity.id}>
                                {entity.entity_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={item.account_type}
                        onValueChange={(v) => handleUpdateRow(index, 'account_type', v)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AR">AR</SelectItem>
                          <SelectItem value="AP">AP</SelectItem>
                          <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={item.invoice_no || ''}
                        onChange={(e) => handleUpdateRow(index, 'invoice_no', e.target.value)}
                        className="w-[120px]"
                        maxLength={50}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={item.currency}
                        onChange={(e) => handleUpdateRow(index, 'currency', e.target.value.toUpperCase())}
                        className="w-[80px]"
                        maxLength={3}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        value={item.amount || ''}
                        onChange={(e) => handleUpdateRow(index, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-[120px]"
                        step="0.01"
                        min="0"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Textarea
                        value={item.description || ''}
                        onChange={(e) => handleUpdateRow(index, 'description', e.target.value)}
                        className="w-[200px] min-h-[40px]"
                        maxLength={500}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRow(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setItems([])}>
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={items.length === 0}
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading || items.length === 0}
          variant={hasChanges() ? 'destructive' : 'secondary'}
          className={hasChanges() ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'}
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
}
