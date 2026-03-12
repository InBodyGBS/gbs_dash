'use client';

/**
 * Monthly Closing - Mapping 페이지
 * COA 매핑 관리 (로컬 계정 → 표준 P&L/BS 라인)
 * PRD 3.2 기반 (P&L + BS 통합 뷰)
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download,
  Upload,
  FileSpreadsheet,
  BarChart3,
  List,
} from 'lucide-react';
import {
  getCOAMappings,
  upsertCOAMapping,
  deleteCOAMapping,
  getUnmappedAccounts,
  getTBUploads,
  generateStatements,
  getStdPLMaster,
  getStdBSMaster,
  parseCOAMappingExcel,
  bulkUpsertCOAMappings,
} from '@/lib/services/monthlyClosingService';
import type { 
  COAMapping, 
  COAMappingInput, 
  UnmappedAccount, 
  TBUpload, 
  StdPLMaster, 
  StdBSMaster,
  StatementType,
} from '@/lib/types/monthly-closing';
import type { Subsidiary } from '@/lib/supabase/types';
import * as XLSX from 'xlsx';

export default function MappingPage() {
  // 상태
  const [mappings, setMappings] = useState<COAMapping[]>([]);
  const [unmappedAccounts, setUnmappedAccounts] = useState<UnmappedAccount[]>([]);
  const [subsidiaries, setSubsidiaries] = useState<Subsidiary[]>([]);
  const [uploads, setUploads] = useState<TBUpload[]>([]);
  const [plMaster, setPLMaster] = useState<StdPLMaster[]>([]);
  const [bsMaster, setBSMaster] = useState<StdBSMaster[]>([]);
  const [selectedEntityCode, setSelectedEntityCode] = useState<string>('');
  const [selectedUploadId, setSelectedUploadId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'PL' | 'BS'>('all');
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<COAMappingInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'mappings' | 'unmapped'>('mappings');
  const [uploading, setUploading] = useState(false);

  // 초기 로드
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedEntityCode) {
      loadMappings();
      loadEntityUploads();
    }
  }, [selectedEntityCode]);

  useEffect(() => {
    if (selectedUploadId) {
      loadUnmappedAccounts();
    }
  }, [selectedUploadId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [subsData, plMasterData, bsMasterData] = await Promise.all([
        supabase.from('subsidiaries').select('*').order('name'),
        getStdPLMaster(),
        getStdBSMaster(),
      ]);
      setSubsidiaries(subsData.data || []);
      setPLMaster(plMasterData);
      setBSMaster(bsMasterData);
    } catch (error: any) {
      toast.error('데이터 로딩 실패');
    } finally {
      setLoading(false);
    }
  };

  const loadMappings = async () => {
    try {
      const data = await getCOAMappings(selectedEntityCode || undefined);
      setMappings(data);
    } catch (error: any) {
      toast.error('매핑 목록 로드 실패', { description: error.message });
    }
  };

  const loadEntityUploads = async () => {
    try {
      const data = await getTBUploads(selectedEntityCode);
      setUploads(data);
      if (data.length > 0) {
        setSelectedUploadId(data[0].id);
      }
    } catch (error: any) {
      console.error('Failed to load uploads:', error);
    }
  };

  const loadUnmappedAccounts = async () => {
    if (!selectedUploadId) return;
    try {
      const data = await getUnmappedAccounts(selectedUploadId);
      setUnmappedAccounts(data);
    } catch (error: any) {
      console.error('Failed to load unmapped accounts:', error);
    }
  };

  // P&L/BS 카운트
  const plCount = useMemo(() => mappings.filter(m => m.statement_type === 'PL' || !m.statement_type).length, [mappings]);
  const bsCount = useMemo(() => mappings.filter(m => m.statement_type === 'BS').length, [mappings]);

  // 검색 + 타입 필터
  const filteredMappings = useMemo(() => {
    let result = mappings;
    
    // 타입 필터
    if (typeFilter !== 'all') {
      result = result.filter(m => m.statement_type === typeFilter || (typeFilter === 'PL' && !m.statement_type));
    }
    
    // 검색 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.local_account_code.toLowerCase().includes(term) ||
          (m.local_account_name || '').toLowerCase().includes(term) ||
          m.std_code.toLowerCase().includes(term) ||
          (m.std_pl_master?.pl_line || '').toLowerCase().includes(term) ||
          (m.std_pl_master?.pl_category || '').toLowerCase().includes(term) ||
          (m.std_bs_master?.bs_line || '').toLowerCase().includes(term) ||
          (m.std_bs_master?.bs_category || '').toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [mappings, typeFilter, searchTerm]);

  // 매핑 저장
  const handleSaveMapping = async () => {
    if (!editingMapping) return;
    if (!editingMapping.entity_code || !editingMapping.local_account_code || !editingMapping.std_code) {
      toast.error('필수 항목을 모두 입력해주세요.');
      return;
    }
    try {
      await upsertCOAMapping(editingMapping);
      toast.success('매핑 저장 완료');
      setEditDialogOpen(false);
      setEditingMapping(null);
      setEditingId(null);
      await loadMappings();
      if (selectedUploadId) await loadUnmappedAccounts();
    } catch (error: any) {
      toast.error('매핑 저장 실패', { description: error.message });
    }
  };

  // 매핑 삭제
  const handleDeleteMapping = async (id: string) => {
    if (!confirm('이 매핑을 삭제하시겠습니까?')) return;
    try {
      await deleteCOAMapping(id);
      toast.success('매핑 삭제 완료');
      await loadMappings();
    } catch (error: any) {
      toast.error('매핑 삭제 실패', { description: error.message });
    }
  };

  // 매핑 편집 다이얼로그 열기
  const openEditDialog = (mapping?: COAMapping) => {
    if (mapping) {
      setEditingId(mapping.id);
      setEditingMapping({
        entity_code: mapping.entity_code,
        local_account_code: mapping.local_account_code,
        local_account_name: mapping.local_account_name || '',
        statement_type: mapping.statement_type || 'PL',
        std_code: mapping.std_code,
      });
    } else {
      setEditingId(null);
      setEditingMapping({
        entity_code: selectedEntityCode,
        local_account_code: '',
        local_account_name: '',
        statement_type: 'PL',
        std_code: '',
      });
    }
    setEditDialogOpen(true);
  };

  // Unmapped → 매핑 다이얼로그
  const handleMapUnmapped = (account: UnmappedAccount) => {
    setEditingId(null);
    setEditingMapping({
      entity_code: account.entity_code,
      local_account_code: account.account_code,
      local_account_name: account.account_name,
      statement_type: account.suggested_statement_type || 'PL',
      std_code: '',
    });
    setEditDialogOpen(true);
  };

  // P&L/BS 재생성
  const handleReprocessStatements = async () => {
    if (!selectedUploadId) return;
    try {
      await generateStatements(selectedUploadId);
      toast.success('P&L/BS 재생성 완료');
      await loadUnmappedAccounts();
    } catch (error: any) {
      toast.error('P&L/BS 재생성 실패', { description: error.message });
    }
  };

  // COA 매핑 엑셀 업로드
  const handleExcelUpload = async (file: File) => {
    if (!selectedEntityCode) {
      toast.error('Entity를 먼저 선택해주세요.');
      return;
    }

    setUploading(true);
    try {
      // 엑셀 파싱 (P&L/BS 자동 구분됨)
      const parsedMappings = await parseCOAMappingExcel(file);

      // entity_code 설정
      const mappingsWithEntity = parsedMappings.map((m) => ({
        ...m,
        entity_code: selectedEntityCode,
      }));

      // 일괄 업로드
      const result = await bulkUpsertCOAMappings(selectedEntityCode, mappingsWithEntity);

      // 결과 메시지 (P&L/BS 건수 표시)
      const plUploaded = mappingsWithEntity.filter(m => m.statement_type === 'PL').length;
      const bsUploaded = mappingsWithEntity.filter(m => m.statement_type === 'BS').length;

      if (result.failed > 0) {
        const errorMessage = result.errors.length > 0 
          ? result.errors.slice(0, 5).join('\n') + (result.errors.length > 5 ? `\n... 외 ${result.errors.length - 5}개 오류` : '')
          : '일부 데이터 업로드 실패';
        
        toast.warning(
          `업로드 완료: ${result.success}건 성공 (P&L: ${plUploaded}, BS: ${bsUploaded}), ${result.failed}건 실패`,
          { 
            description: errorMessage,
            duration: 8000,
          }
        );
      } else {
        toast.success(`${result.success}건 업로드 완료 (P&L: ${plUploaded}건, BS: ${bsUploaded}건 자동 구분)`);
      }

      // 매핑 목록 새로고침
      await loadMappings();
    } catch (error: any) {
      console.error('Excel upload error:', error);
      toast.error('엑셀 업로드 실패', { 
        description: error.message || '알 수 없는 오류가 발생했습니다.',
        duration: 5000,
      });
    } finally {
      setUploading(false);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['xls', 'xlsx'].includes(fileExt || '')) {
      toast.error('Excel 파일만 업로드 가능합니다 (.xls, .xlsx)');
      return;
    }

    handleExcelUpload(file);
    e.target.value = '';
  };

  // 템플릿 다운로드 (P&L + BS 통합, Statement Type 컬럼은 선택사항임을 표시)
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Account Code': '400-001',
        'Account Name': 'Product Sales',
        'Std Code': '43000',
        'Statement Type (선택)': 'PL (자동추론: 4~8로 시작하면 PL)',
      },
      {
        'Account Code': '100-001',
        'Account Name': 'Cash',
        'Std Code': '11101',
        'Statement Type (선택)': 'BS (자동추론: 1~3으로 시작하면 BS)',
      },
      {
        'Account Code': '500-001',
        'Account Name': 'COGS',
        'Std Code': '52000',
        'Statement Type (선택)': '(생략 가능 - Std Code로 자동 판단)',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'COA Mapping');
    XLSX.writeFile(wb, 'COA_Mapping_Template.xlsx');
    toast.success('템플릿 다운로드 완료 (P&L/BS 자동 구분됨)');
  };

  // P&L Code별 그룹화
  const plMasterByCategory = useMemo(() => {
    const grouped = new Map<string, StdPLMaster[]>();
    plMaster.forEach((pl) => {
      const category = pl.pl_category;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(pl);
    });
    grouped.forEach((pls, category) => {
      grouped.set(category, pls.sort((a, b) => parseInt(a.pl_code, 10) - parseInt(b.pl_code, 10)));
    });
    return grouped;
  }, [plMaster]);

  // BS Code별 그룹화
  const bsMasterByCategory = useMemo(() => {
    const grouped = new Map<string, StdBSMaster[]>();
    bsMaster.forEach((bs) => {
      const category = bs.bs_category;
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(bs);
    });
    grouped.forEach((bss, category) => {
      grouped.set(category, bss.sort((a, b) => parseInt(a.bs_code, 10) - parseInt(b.bs_code, 10)));
    });
    return grouped;
  }, [bsMaster]);

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">COA Mapping</h1>
        <p className="text-gray-600">
          로컬 계정과목을 표준 P&L/BS 라인에 매핑합니다. Excel 업로드 시 <strong>P&L/BS가 자동 구분</strong>됩니다.
        </p>
      </div>

      {/* Entity 선택 */}
      <div className="flex-shrink-0 mb-6 bg-white rounded-lg border p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label>Entity</Label>
            <Select value={selectedEntityCode} onValueChange={setSelectedEntityCode}>
              <SelectTrigger>
                <SelectValue placeholder="Entity 선택" />
              </SelectTrigger>
              <SelectContent position="popper">
                {subsidiaries.map((sub) => (
                  <SelectItem key={sub.id} value={sub.code}>
                    {sub.name} ({sub.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedEntityCode && (
            <div className="flex items-center gap-4 pt-5 text-sm">
              <span className="text-gray-500">
                전체: <strong>{mappings.length}</strong>건
              </span>
              <span className="text-blue-600">
                P&L: <strong>{plCount}</strong>
              </span>
              <span className="text-green-600">
                BS: <strong>{bsCount}</strong>
              </span>
              {unmappedAccounts.length > 0 && (
                <span className="text-orange-600">
                  Unmapped: <strong>{unmappedAccounts.length}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {!selectedEntityCode ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Entity를 선택하면 COA 매핑을 관리할 수 있습니다.</p>
        </div>
      ) : (
        <>
          {/* 탭 전환 (통합 뷰) */}
          <div className="flex-shrink-0 mb-4 flex gap-2">
            <Button
              variant={activeTab === 'mappings' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('mappings')}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              매핑 테이블 ({mappings.length})
            </Button>
            <Button
              variant={activeTab === 'unmapped' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('unmapped')}
              className={unmappedAccounts.length > 0 ? 'border-orange-300' : ''}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Unmapped ({unmappedAccounts.length})
            </Button>
          </div>

          {activeTab === 'mappings' ? (
            <Card className="flex-1 min-h-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="계정코드, 계정명, P&L/BS 라인 검색..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {/* 타입 필터 */}
                  <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | 'PL' | 'BS')}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="all">
                        <span className="flex items-center gap-2">
                          <List className="h-4 w-4" />
                          전체
                        </span>
                      </SelectItem>
                      <SelectItem value="PL">
                        <span className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-blue-600" />
                          P&L만
                        </span>
                      </SelectItem>
                      <SelectItem value="BS">
                        <span className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-green-600" />
                          BS만
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".xls,.xlsx"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="coa-mapping-upload"
                    disabled={uploading || !selectedEntityCode}
                  />
                  <label htmlFor="coa-mapping-upload">
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      disabled={uploading || !selectedEntityCode}
                    >
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? '업로드 중...' : 'Excel 업로드'}
                      </span>
                    </Button>
                  </label>
                  <Button size="sm" variant="outline" onClick={handleDownloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    템플릿
                  </Button>
                  <Button size="sm" onClick={() => openEditDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    매핑 추가
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredMappings.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    {searchTerm || typeFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 매핑이 없습니다.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium text-gray-600">계정코드</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">계정명</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-600">Type</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">Std Code</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">Line</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">Category</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMappings.map((mapping) => (
                          <tr key={mapping.id} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-3 font-mono text-xs">{mapping.local_account_code}</td>
                            <td className="py-2 px-3 text-sm">{mapping.local_account_name || '-'}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                mapping.statement_type === 'BS' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {mapping.statement_type || 'PL'}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-xs font-semibold">{mapping.std_code}</td>
                            <td className="py-2 px-3 text-sm">
                              {mapping.statement_type === 'BS' 
                                ? mapping.std_bs_master?.bs_line || '-'
                                : mapping.std_pl_master?.pl_line || '-'}
                            </td>
                            <td className="py-2 px-3">
                              <span className="text-xs text-gray-600">
                                {mapping.statement_type === 'BS' 
                                  ? mapping.std_bs_master?.bs_category || '-'
                                  : mapping.std_pl_master?.pl_category || '-'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openEditDialog(mapping)}>
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteMapping(mapping.id)}>
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="flex-1 min-h-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Unmapped Accounts
                </CardTitle>
                <div className="flex gap-2">
                  {uploads.length > 0 && (
                    <Select value={selectedUploadId} onValueChange={setSelectedUploadId}>
                      <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="업로드 선택" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {uploads.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.period_year}.{u.period_month} - {u.file_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="sm" variant="outline" onClick={handleReprocessStatements}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-process
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {unmappedAccounts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
                    <p className="text-gray-600 font-medium">모든 계정이 매핑되었습니다!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium text-gray-600">계정코드</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-600">계정명</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-600">추천</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-600">차변</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-600">대변</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-600">잔액</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unmappedAccounts.map((account, idx) => (
                          <tr key={`${account.account_code}-${idx}`} className="border-b hover:bg-orange-50">
                            <td className="py-2 px-3 font-mono text-xs">{account.account_code}</td>
                            <td className="py-2 px-3">{account.account_name}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                account.suggested_statement_type === 'BS' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {account.suggested_statement_type || 'PL'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs">
                              {account.debit.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs">
                              {account.credit.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-xs">
                              {account.balance.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <Button size="sm" variant="outline" onClick={() => handleMapUnmapped(account)}>
                                <Plus className="h-3 w-3 mr-1" />
                                매핑
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* 매핑 편집 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? '매핑 수정' : '매핑 추가'}</DialogTitle>
          </DialogHeader>
          {editingMapping && (
            <div className="space-y-4">
              <div>
                <Label>계정코드</Label>
                <Input
                  value={editingMapping.local_account_code}
                  onChange={(e) =>
                    setEditingMapping({ ...editingMapping, local_account_code: e.target.value })
                  }
                  disabled={!!editingId}
                />
              </div>
              <div>
                <Label>계정명</Label>
                <Input
                  value={editingMapping.local_account_name || ''}
                  onChange={(e) =>
                    setEditingMapping({ ...editingMapping, local_account_name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Statement Type</Label>
                <Select
                  value={editingMapping.statement_type}
                  onValueChange={(type) => {
                    setEditingMapping({ 
                      ...editingMapping, 
                      statement_type: type as StatementType,
                      std_code: '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="PL">
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-600" />
                        P&L (손익계산서)
                      </span>
                    </SelectItem>
                    <SelectItem value="BS">
                      <span className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                        BS (재무상태표)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{editingMapping.statement_type === 'BS' ? 'BS Code' : 'P&L Code'}</Label>
                {editingMapping.statement_type === 'PL' ? (
                  <Select
                    value={editingMapping.std_code}
                    onValueChange={(code) => setEditingMapping({ ...editingMapping, std_code: code })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="P&L Code 선택" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[400px]">
                      {Array.from(plMasterByCategory.entries())
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([category, pls]) => (
                          <div key={category}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-blue-50 sticky top-0">
                              {category}
                            </div>
                            {pls.map((pl) => (
                              <SelectItem key={pl.pl_code} value={pl.pl_code}>
                                <span className="font-mono text-xs mr-2">{pl.pl_code}</span>
                                {pl.pl_line}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={editingMapping.std_code}
                    onValueChange={(code) => setEditingMapping({ ...editingMapping, std_code: code })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="BS Code 선택" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="max-h-[400px]">
                      {Array.from(bsMasterByCategory.entries())
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([category, bss]) => (
                          <div key={category}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-green-50 sticky top-0">
                              {category}
                            </div>
                            {bss.map((bs) => (
                              <SelectItem key={bs.bs_code} value={bs.bs_code}>
                                <span className="font-mono text-xs mr-2">{bs.bs_code}</span>
                                {bs.bs_line}
                                {bs.is_contra && <span className="text-xs text-orange-500 ml-1">(차감)</span>}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                    </SelectContent>
                  </Select>
                )}
                {editingMapping.std_code && (
                  <p className="text-xs text-gray-500 mt-1">
                    {editingMapping.statement_type === 'BS'
                      ? bsMaster.find((bs) => bs.bs_code === editingMapping.std_code)?.bs_line || ''
                      : plMaster.find((pl) => pl.pl_code === editingMapping.std_code)?.pl_line || ''}
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSaveMapping}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
