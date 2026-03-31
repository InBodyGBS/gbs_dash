'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Download, FileUp, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Subsidiary } from '@/lib/supabase/types';
import {
  uploadAuditReportFile,
  removeAuditReportFile,
  downloadAuditReportBlob,
  auditReportPathToLabel,
} from '@/lib/services/auditReportStorage';

const AUDIT_CATEGORIES = ['statutory_audit', 'auditor', 'audit_date', 'audit_report'] as const;
type AuditCategory = typeof AUDIT_CATEGORIES[number];

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  statutory_audit: 'Statutory Audit',
  auditor: 'Auditor',
  audit_date: 'Audit Date',
  audit_report: 'Audit Report',
};

interface AuditRecord {
  id?: string;
  subsidiary_id: string;
  fiscal_year: number;
  statutory_audit: string | null;
  auditor: string | null;
  audit_date: string | null;
  audit_report: string | null;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류';
};

interface EditableCellProps {
  value: string | null;
  onSave: (value: string | null) => Promise<void>;
  isSaving: boolean;
}

function EditableCell({ value, onSave, isSaving }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const next = value || '';
    // Schedule the state update after this effect completes.
    Promise.resolve().then(() => setEditValue(next));
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmed = editValue.trim();
    const newValue = trimmed || null;
    if (newValue !== value) {
      await onSave(newValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { setEditValue(value || ''); setIsEditing(false); }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        disabled={isSaving}
        className="h-8 text-sm border-blue-500 focus-visible:ring-blue-500 px-2"
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        'min-h-[32px] px-2 py-1 rounded border border-dashed border-gray-200 text-sm cursor-pointer',
        'hover:border-blue-400 hover:bg-blue-50 transition-colors',
        value ? 'text-gray-800' : 'text-gray-300'
      )}
    >
      {value || '—'}
    </div>
  );
}

interface AuditReportCellProps {
  storagePath: string | null;
  subsidiaryId: string;
  fiscalYear: number;
  onSavePath: (path: string | null) => Promise<void>;
  isSaving: boolean;
}

function AuditReportCell({
  storagePath,
  subsidiaryId,
  fiscalYear,
  onSavePath,
  isSaving,
}: AuditReportCellProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pickFile = () => fileInputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadAuditReportFile(
        file,
        fiscalYear,
        subsidiaryId,
        storagePath,
      );
      await onSavePath(path);
      toast.success('Audit report가 업로드되었습니다.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const openDownload = async () => {
    if (!storagePath) return;
    const blob = await downloadAuditReportBlob(storagePath);
    if (!blob) {
      toast.error('파일을 불러올 수 없습니다. 로그인·Storage 권한을 확인해 주세요.');
      return;
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  };

  const handleRemove = async () => {
    if (!storagePath) return;
    if (!confirm('저장된 Audit report를 삭제할까요?')) return;
    setUploading(true);
    try {
      await removeAuditReportFile(storagePath);
      await onSavePath(null);
      toast.success('파일이 삭제되었습니다.');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const busy = uploading || isSaving;

  return (
    <div
      className={cn(
        'min-h-[32px] px-2 py-1.5 rounded border border-dashed border-gray-200 text-sm',
        'space-y-1.5',
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.zip,.txt,.csv"
        onChange={handleFile}
        disabled={busy}
      />
      {storagePath ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-700 truncate" title={storagePath}>
            {auditReportPathToLabel(storagePath)}
          </span>
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={busy}
              onClick={() => void openDownload()}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              열기
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={busy}
              onClick={pickFile}
            >
              <FileUp className="w-3 h-3 mr-1" />
              교체
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={busy}
              onClick={() => void handleRemove()}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              삭제
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full text-xs"
          disabled={busy}
          onClick={pickFile}
        >
          <FileUp className="w-3.5 h-3.5 mr-1" />
          {uploading ? '업로드 중…' : '파일 제출'}
        </Button>
      )}
    </div>
  );
}

interface AuditGridProps {
  subsidiaries: Subsidiary[];
  fiscalYear: number;
}

export function AuditGrid({ subsidiaries, fiscalYear }: AuditGridProps) {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_records')
      .select('*')
      .eq('fiscal_year', fiscalYear);
    if (error) toast.error('데이터 로딩 실패: ' + error.message);
    else setRecords((data || []) as unknown as AuditRecord[]);
    setLoading(false);
  }, [fiscalYear]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // subsidiary_id → record 맵
  const recordsMap = useMemo(() => {
    const map = new Map<string, AuditRecord>();
    records.forEach((r) => map.set(r.subsidiary_id, r));
    return map;
  }, [records]);

  const handleCellSave = useCallback(
    async (subsidiaryId: string, category: AuditCategory, value: string | null) => {
      const key = `${subsidiaryId}_${category}`;
      setSavingCells((prev) => new Set(prev).add(key));
      try {
        const existing = recordsMap.get(subsidiaryId);
        if (existing?.id) {
          // UPDATE
          const { error } = await supabase
            .from('audit_records' as never)
            .update({ [category]: value, updated_at: new Date().toISOString() } as never)
            .eq('id', existing.id);
          if (error) throw error;
          setRecords((prev) =>
            prev.map((r) => (r.id === existing.id ? { ...r, [category]: value } : r))
          );
        } else {
          // INSERT
          const newRecord: Omit<AuditRecord, 'id'> = {
            subsidiary_id: subsidiaryId,
            fiscal_year: fiscalYear,
            statutory_audit: null,
            auditor: null,
            audit_date: null,
            audit_report: null,
            [category]: value,
          };
          const { data, error } = await supabase
            .from('audit_records' as never)
            .insert(newRecord as never)
            .select()
            .single();
          if (error) throw error;
          setRecords((prev) => [...prev, data as unknown as AuditRecord]);
        }
      } catch (err: unknown) {
        toast.error('저장 실패: ' + getErrorMessage(err));
      } finally {
        setSavingCells((prev) => { const n = new Set(prev); n.delete(key); return n; });
      }
    },
    [recordsMap, fiscalYear]
  );

  const handleExport = () => {
    const rows = [
      ['Entity', ...AUDIT_CATEGORIES.map((c) => CATEGORY_LABELS[c])],
      ...subsidiaries.map((sub) => {
        const rec = recordsMap.get(sub.id);
        return [
          sub.name,
          rec?.statutory_audit || '',
          rec?.auditor || '',
          rec?.audit_date || '',
          rec?.audit_report ? auditReportPathToLabel(rec.audit_report) : '',
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_${fiscalYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV 다운로드 완료');
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 툴바 */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* 그리드 */}
      <div className="border rounded-lg overflow-hidden bg-white flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mr-3" />
              로딩 중...
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b">
                  <th className="sticky left-0 z-20 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-900 border-r min-w-[160px]">
                    Entity
                  </th>
                  {AUDIT_CATEGORIES.map((cat) => (
                    <th
                      key={cat}
                      className="px-4 py-3 text-center text-sm font-semibold text-gray-900 min-w-[180px]"
                    >
                      {CATEGORY_LABELS[cat]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subsidiaries.map((sub) => {
                  const rec = recordsMap.get(sub.id);
                  return (
                    <tr key={sub.id} className="border-b hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm font-medium text-gray-900 border-r">
                        {sub.name}
                      </td>
                      {AUDIT_CATEGORIES.map((cat) => {
                        const key = `${sub.id}_${cat}`;
                        return (
                          <td key={cat} className="px-3 py-2">
                            {cat === 'audit_report' ? (
                              <AuditReportCell
                                storagePath={rec?.audit_report ?? null}
                                subsidiaryId={sub.id}
                                fiscalYear={fiscalYear}
                                onSavePath={(path) => handleCellSave(sub.id, cat, path)}
                                isSaving={savingCells.has(key)}
                              />
                            ) : (
                              <EditableCell
                                value={rec?.[cat] || null}
                                onSave={(val) => handleCellSave(sub.id, cat, val)}
                                isSaving={savingCells.has(key)}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Statutory Audit / Auditor / Audit Date: 셀 클릭 후 입력 · Enter 저장 · Esc 취소 ·{' '}
        <span className="font-medium text-gray-500">Audit Report</span>는 파일 제출(Storage: Audit report)
      </p>
    </div>
  );
}
