/**
 * 관리자 페이지 - Review Page
 * 제출 이력 조회 및 다운로드
 */

'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getArapSubmissions, getSubmissionFileUrl } from '@/lib/services/arapService';
import type { ArapSubmissionWithDetails, ArapEntity } from '@/lib/types/arap';
import { getArapEntities } from '@/lib/services/arapService';

interface AdminReviewPageProps {
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

export function AdminReviewPage({
  selectedYear,
  selectedMonth,
  onYearChange,
  onMonthChange,
}: AdminReviewPageProps) {
  const [submissions, setSubmissions] = useState<ArapSubmissionWithDetails[]>([]);
  const [entities, setEntities] = useState<ArapEntity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [schemaError, setSchemaError] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth, selectedEntityId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setSchemaError(false);
      
      console.log('📋 Loading Review data...', {
        selectedEntityId,
        selectedYear,
        selectedMonth,
      });
      
      const [submissionsData, entitiesData] = await Promise.all([
        getArapSubmissions(
          selectedEntityId === 'all' ? undefined : selectedEntityId,
          selectedYear,
          selectedMonth
        ),
        getArapEntities(),
      ]);
      
      console.log('✅ Review data loaded:', {
        submissionsCount: submissionsData?.length || 0,
        entitiesCount: entitiesData?.length || 0,
      });
      
      setSubmissions(submissionsData || []);
      setEntities(entitiesData || []);
    } catch (error: any) {
      console.error('❌ Failed to load Review data:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack,
      });
      
      // 테이블이 없을 경우 빈 배열로 설정
      const errorMessage = String(error?.message || '');
      const errorCode = String(error?.code || '');
      
      if (
        errorCode === 'PGRST116' || 
        errorMessage.includes('does not exist') ||
        errorMessage.includes('relation') ||
        errorCode === '42P01'
      ) {
        console.warn('⚠️ ARAP tables not found. Please run the schema migration first.');
        setSubmissions([]);
        setEntities([]);
        setSchemaError(true);
      } else {
        // 다른 에러는 빈 배열로 설정하고 계속 진행
        console.warn('⚠️ Error loading data, but continuing with empty arrays');
        setSubmissions([]);
        setEntities([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (submission: ArapSubmissionWithDetails) => {
    try {
      // 같은 entity_id, fiscal_year, fiscal_month의 최신 제출 데이터 가져오기
      const { getArapSubmissions } = await import('@/lib/services/arapService');
      const latestSubmissions = await getArapSubmissions(
        submission.entity_id,
        submission.fiscal_year,
        submission.fiscal_month
      );
      
      // 최신 제출 찾기 (submission_date 기준 내림차순 정렬되어 있음)
      const latestSubmission = latestSubmissions && latestSubmissions.length > 0 
        ? latestSubmissions[0] 
        : submission;

      if (!latestSubmission.file_path) {
        // 수동 입력 데이터는 Excel로 내보내기 (최신 데이터 사용)
        console.log('📊 Exporting latest manual submission to Excel:', latestSubmission);
        
        // Excel 데이터 준비 (최신 제출 데이터 사용)
        const exportData = (latestSubmission.submission_details || []).map((detail: any) => {
          const counterparty = entities.find((e) => e.id === detail.counterparty_entity_id);
          return {
            'Invoice Date': detail.invoice_date || '',
            'Counterparty': counterparty?.entity_name || '',
            'Account Type': detail.account_type,
            'Invoice No': detail.invoice_no || '',
            'Currency': detail.currency,
            'Amount': detail.amount,
            'Description': detail.description || '',
          };
        });

        if (exportData.length === 0) {
          alert('No data to export');
          return;
        }

        // Excel 워크시트 생성
        const XLSX = await import('xlsx');
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ARAP Data');

        // 파일명 생성 (원래 제출 일자 표시)
        const entity = entities.find((e) => e.id === submission.entity_id);
        const entityName = entity?.entity_name.replace(/\s+/g, '_') || 'Entity';
        const fileName = `ARAP_${entityName}_${submission.fiscal_year}_${submission.fiscal_month}_${new Date(submission.submission_date).toISOString().split('T')[0]}.xlsx`;

        // 파일 다운로드
        XLSX.writeFile(wb, fileName);
        return;
      }

      // 파일이 있는 경우 최신 파일 다운로드
      console.log('📥 Downloading latest file:', latestSubmission.file_path);
      const url = await getSubmissionFileUrl(latestSubmission.file_path);
      const link = document.createElement('a');
      link.href = url;
      // 원래 제출 일자를 파일명에 포함
      const entity = entities.find((e) => e.id === submission.entity_id);
      const entityName = entity?.entity_name.replace(/\s+/g, '_') || 'Entity';
      const originalDate = new Date(submission.submission_date).toISOString().split('T')[0];
      const fileExtension = latestSubmission.file_path.split('.').pop() || 'xlsx';
      link.download = `ARAP_${entityName}_${submission.fiscal_year}_${submission.fiscal_month}_${originalDate}.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error('❌ Failed to download:', error);
      alert(`Download failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (schemaError) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Database Schema Required</h3>
            <p className="mt-2 text-sm text-yellow-700">
              The ARAP tables have not been created yet. Please run the schema migration SQL in Supabase:
            </p>
            <p className="mt-2 text-xs text-yellow-600 font-mono">
              docs/arap-schema.sql
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <FileText className="h-5 w-5 text-gray-600" />
          <h2 className="text-xl font-semibold">Review Submissions</h2>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedYear.toString()} onValueChange={(v) => onYearChange(parseInt(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i + 5).map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth.toString()} onValueChange={(v) => onMonthChange(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, index) => (
                <SelectItem key={index + 1} value={(index + 1).toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              {entities.map((entity) => (
                <SelectItem key={entity.id} value={entity.id}>
                  {entity.entity_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Entity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Items
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  <span className="flex items-center gap-1">
                    Status
                    <span
                      className="text-gray-400 cursor-help"
                      title="이 법인의 제출이 모든 거래 상대방과 매칭되었는지 여부"
                    >
                      ℹ️
                    </span>
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No submissions found
                  </td>
                </tr>
              ) : (
                submissions.map((submission) => {
                  const entity = entities.find((e) => e.id === submission.entity_id);
                  return (
                    <tr key={submission.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(submission.submission_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {entity?.entity_name || submission.entity_id}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {submission.submission_type === 'file' ? 'File' : 'Manual'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {submission.total_items}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            submission.match_status === 'matched'
                              ? 'bg-green-100 text-green-800'
                              : submission.match_status === 'pending'
                              ? 'bg-blue-100 text-blue-800'
                              : submission.match_status === 'mismatched'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                          title={
                            submission.match_status === 'matched'
                              ? '모든 거래 상대방과 금액이 일치함'
                              : submission.match_status === 'pending'
                              ? '거래 상대방 중 일부가 미제출이거나 확인 중'
                              : submission.match_status === 'mismatched'
                              ? '거래 상대방과 금액이 불일치함'
                              : '매칭 상태 미확인'
                          }
                        >
                          {submission.match_status === 'matched' && 'Matched'}
                          {submission.match_status === 'pending' && 'Pending'}
                          {submission.match_status === 'mismatched' && 'Mismatched'}
                          {submission.match_status === 'no_data' && 'No Data'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(submission)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
