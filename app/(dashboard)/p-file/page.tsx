/**
 * P-File Management — 지분구조도 (HQ 트리 + 우측 관계기업 레일)
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { EquityStructureView } from '@/components/p-file/EquityStructureView';
import { Button } from '@/components/ui/button';
import {
  buildPfileExcelBuffer,
  buildPfileTemplateBuffer,
  parsePfileExcelBuffer,
} from '@/lib/pfile/excelPfile';
import type { PFileEntityRow, PFileOwnershipRow } from '@/lib/pfile/types';
import type { Subsidiary } from '@/lib/supabase/types';

function isSubsidiaryJoin(v: unknown): v is Subsidiary {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    typeof (v as Subsidiary).id === 'string'
  );
}

function mapEntity(r: Record<string, unknown>): PFileEntityRow {
  const subsidiary_id =
    r.subsidiary_id != null && r.subsidiary_id !== '' ? String(r.subsidiary_id) : null;

  let name = String(r.name ?? '');
  let country = r.country != null ? String(r.country) : null;
  let subsidiary_code: string | null = null;

  const joined = r.subsidiaries;
  if (isSubsidiaryJoin(joined)) {
    if (joined.name) name = joined.name;
    if (joined.country) country = joined.country;
    subsidiary_code = joined.code ?? null;
  }

  return {
    id: String(r.id),
    name,
    entity_type: r.entity_type as PFileEntityRow['entity_type'],
    subsidiary_id,
    subsidiary_code,
    incorporation_date: r.incorporation_date != null ? String(r.incorporation_date) : null,
    country,
    industry: r.industry != null ? String(r.industry) : null,
    currency: r.currency != null ? String(r.currency) : null,
    display_order: typeof r.display_order === 'number' ? r.display_order : 0,
  };
}

function mapOwnership(r: Record<string, unknown>): PFileOwnershipRow {
  return {
    id: String(r.id),
    from_entity_id: String(r.from_entity_id),
    to_entity_id: String(r.to_entity_id),
    relation_kind: r.relation_kind as PFileOwnershipRow['relation_kind'],
    share_pct: r.share_pct != null && r.share_pct !== '' ? Number(r.share_pct) : null,
    note: r.note != null ? String(r.note) : null,
  };
}

function pfileExcelDataFilename(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `pfile-data-${y}${m}${day}.xlsx`;
}

const INSERT_CHUNK = 80;
const DELETE_CHUNK = 100;

async function insertChunks<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const batch = rows.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from(table as never).insert(batch as never);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function deleteAllRows(table: string): Promise<void> {
  const { data, error } = await supabase.from(table as never).select('id');
  if (error) throw new Error(`${table} 조회: ${error.message}`);
  const ids = ((data as { id: string }[]) || []).map((r) => r.id);
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const batch = ids.slice(i, i + DELETE_CHUNK);
    const { error: delErr } = await supabase.from(table as never).delete().in('id', batch);
    if (delErr) throw new Error(`${table} 삭제: ${delErr.message}`);
  }
}

function PFileExcelToolbar(props: { onReload: () => void }) {
  const { onReload } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'template' | 'upload' | null>(null);

  async function downloadTemplate() {
    setBusy('template');
    try {
      const buf = await buildPfileTemplateBuffer();
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pfile-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('엑셀 양식을 다운로드했습니다.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '양식 다운로드에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadData() {
    setBusy('export');
    try {
      const [eRes, oRes] = await Promise.all([
        supabase
          .from('pfile_entities' as never)
          .select('*, subsidiaries ( code )')
          .order('display_order' as never),
        supabase.from('pfile_ownership' as never).select('*'),
      ]);
      if (eRes.error) throw new Error(eRes.error.message);
      if (oRes.error) throw new Error(oRes.error.message);
      const buf = await buildPfileExcelBuffer(
        (eRes.data as Record<string, unknown>[]) || [],
        (oRes.data as Record<string, unknown>[]) || [],
      );
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pfileExcelDataFilename();
      a.click();
      URL.revokeObjectURL(url);
      toast.success('현재 P-File 데이터를 엑셀로 받았습니다.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '내보내기에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  async function handleUploadFile(file: File) {
    if (
      !confirm(
        '엑셀 내용으로 P-File DB를 덮어씁니다.\n기존 pfile_ownership·pfile_entities 데이터가 모두 삭제됩니다. 계속할까요?',
      )
    ) {
      return;
    }
    setBusy('upload');
    try {
      const buf = await file.arrayBuffer();
      const parsed = await parsePfileExcelBuffer(buf);

      await deleteAllRows('pfile_ownership');
      await deleteAllRows('pfile_entities');

      const entInsert = parsed.entities.map((e) => ({
        id: e.id,
        name: e.name,
        entity_type: e.entity_type,
        subsidiary_id: e.subsidiary_id,
        incorporation_date: e.incorporation_date,
        country: e.country,
        industry: e.industry,
        currency: e.currency,
        display_order: e.display_order,
      }));

      const ownInsert = parsed.ownership.map((o) => ({
        id: o.id,
        from_entity_id: o.from_entity_id,
        to_entity_id: o.to_entity_id,
        relation_kind: o.relation_kind,
        share_pct: o.share_pct,
        note: o.note,
      }));

      await insertChunks('pfile_entities', entInsert);
      await insertChunks('pfile_ownership', ownInsert);

      toast.success('엑셀 업로드가 완료되었습니다.');
      onReload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '업로드에 실패했습니다.');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const disabled = busy !== null;

  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleUploadFile(f);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => void downloadTemplate()}
      >
        <FileDown className="w-4 h-4 mr-1.5" />
        {busy === 'template' ? '준비 중…' : '양식 다운로드'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => void downloadData()}
      >
        <Download className="w-4 h-4 mr-1.5" />
        {busy === 'export' ? '준비 중…' : '데이터 엑셀'}
      </Button>
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={disabled}
        onClick={() => fileRef.current?.click()}
      >
        <FileUp className="w-4 h-4 mr-1.5" />
        {busy === 'upload' ? '업로드 중…' : '엑셀 업로드'}
      </Button>
    </div>
  );
}

export default function PFilePage() {
  const [entities, setEntities] = useState<PFileEntityRow[]>([]);
  const [ownership, setOwnership] = useState<PFileOwnershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const [eRes, oRes] = await Promise.all([
        supabase
          .from('pfile_entities' as never)
          .select(
            'id, name, entity_type, subsidiary_id, incorporation_date, country, industry, currency, display_order, subsidiaries ( id, name, code, country, city, region )',
          )
          .order('display_order' as never),
        supabase.from('pfile_ownership' as never).select('*'),
      ]);
      if (cancelled) return;
      if (eRes.error) {
        setError(eRes.error.message);
        setEntities([]);
      } else {
        setEntities(((eRes.data as Record<string, unknown>[]) || []).map(mapEntity));
      }
      if (oRes.error) {
        setError(oRes.error.message);
        setOwnership([]);
      } else {
        setOwnership(((oRes.data as Record<string, unknown>[]) || []).map(mapOwnership));
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const hqCount = entities.filter((e) => e.entity_type === 'hq').length;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto space-y-4 p-6">
        <h1 className="text-2xl font-bold text-gray-900">P-File Management</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">데이터를 불러오지 못했습니다.</p>
          <p className="mt-1 text-amber-800/90">{error}</p>
          <p className="mt-3">
            Supabase에 테이블이 없다면{' '}
            <code className="rounded bg-white/80 px-1">docs/pfile-equity-schema.sql</code> 을 실행한 뒤
            새로고침해 주세요.
          </p>
        </div>
        <button
          type="button"
          className="text-sm text-blue-600 underline"
          onClick={() => window.location.reload()}
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="max-w-7xl mx-auto space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">P-File Management</h1>
            <p className="text-gray-500">법인 기초 정보 · 지분구조도</p>
          </div>
          <PFileExcelToolbar onReload={() => setReloadKey((k) => k + 1)} />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-600">
          <p className="font-medium text-gray-800">등록된 법인이 없습니다.</p>
          <p className="mt-2 text-sm">
            <code className="rounded bg-gray-100 px-1">docs/pfile-equity-schema.sql</code> 로 스키마를 만든 뒤,{' '}
            <span className="font-medium">양식 다운로드</span> 또는 <span className="font-medium">엑셀 업로드</span>로
            데이터를 넣을 수 있습니다.
          </p>
          <p className="mt-4 text-xs text-gray-400">
            자회사 노드는 <span className="font-medium">subsidiary_id</span>에 <span className="font-medium">subsidiaries.id</span>{' '}
            (UUID)를 넣으면 대시보드 법인 마스터와 연동됩니다.
          </p>
        </div>
      </div>
    );
  }

  if (hqCount !== 1) {
    return (
      <div className="max-w-7xl mx-auto space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">P-File Management</h1>
          <PFileExcelToolbar onReload={() => setReloadKey((k) => k + 1)} />
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-medium">
            HQ 법인은 <span className="font-bold">정확히 1개</span>(entity_type = &apos;hq&apos;) 이어야 합니다.
          </p>
          <p className="mt-1">현재 HQ 개수: {hqCount}</p>
          <p className="mt-2 text-xs">엑셀을 수정해 업로드하거나 DB를 직접 맞춰 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col h-full min-h-0 p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">P-File Management</h1>
          <p className="text-gray-500 text-sm mt-1">
            법인 기초 정보 · 지분구조도 (HQ 고정 트리 + 우측 관계기업 레일)
          </p>
          <p className="text-xs text-gray-400 mt-2">
            스키마 SQL: <code className="rounded bg-gray-100 px-1">docs/pfile-equity-schema.sql</code>
            {' · '}
            <span className="font-medium">엑셀</span>으로 일괄 편집·업로드 (추후 권한 분리 예정, 현재 전체 공개)
          </p>
        </div>
        <PFileExcelToolbar onReload={() => setReloadKey((k) => k + 1)} />
      </div>
      <EquityStructureView entities={entities} ownership={ownership} />
    </div>
  );
}
