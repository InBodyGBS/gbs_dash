/**
 * Audit Report 파일 — Supabase Storage (`audit-report` 버킷, 대시보드에서 Audit report로 표시)
 */

import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase/client';

/** Storage 버킷 ID (Supabase는 소문자·하이픈 권장; UI에서는 "Audit report"로 안내) */
export const AUDIT_REPORT_BUCKET = 'audit-report';

const MAX_BYTES = 50 * 1024 * 1024; // 50MB

const ALLOWED_EXT = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'hwp',
  'zip',
]);

/** DB에 전체 URL이 들어간 경우 등 — object 경로만 추출 */
export function normalizeAuditReportStoragePath(path: string): string {
  let p = path.trim().replace(/^\/+/, '');
  const marker = '/storage/v1/object/';
  const idx = p.indexOf(marker);
  if (idx !== -1) {
    const rest = p.slice(idx + marker.length);
    const noQuery = rest.split('?')[0] ?? rest;
    const signPrefix = `sign/${AUDIT_REPORT_BUCKET}/`;
    if (noQuery.startsWith(signPrefix)) {
      p = noQuery.slice(signPrefix.length);
    } else if (noQuery.startsWith(`${AUDIT_REPORT_BUCKET}/`)) {
      p = noQuery.slice(AUDIT_REPORT_BUCKET.length + 1);
    }
  }
  return p;
}

function sanitizeBaseName(name: string): string {
  // Supabase Storage object key는 URL path로 전송되므로,
  // 일부 환경에서 한글/특수문자가 포함되면 400이 나는 케이스가 있어 ASCII로 제한한다.
  return name.replace(/[^\w.\-() ]/g, '_').slice(0, 180);
}

export function auditReportPathToLabel(path: string | null | undefined): string {
  if (!path) return '';
  const normalized = normalizeAuditReportStoragePath(path);
  const seg = normalized.split('/').pop() || normalized;
  // 업로드 시 `${uuid}_${파일명}` 형태로 저장하므로, UI에서는 uuid 접두어를 숨긴다.
  const segWithoutUuid = seg.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i,
    '',
  );
  try {
    return decodeURIComponent(segWithoutUuid);
  } catch {
    return segWithoutUuid;
  }
}

export function buildAuditReportObjectPath(fiscalYear: number, subsidiaryId: string, originalName: string): string {
  const ext = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : '';
  const safe = sanitizeBaseName(originalName.replace(/\.[^.]+$/, '')) || 'report';
  const suffix = ext && ALLOWED_EXT.has(ext) ? `.${ext}` : originalName.includes('.') ? `.${ext}` : '';
  return `${fiscalYear}/${subsidiaryId}/${uuidv4()}_${safe}${suffix}`;
}

export async function uploadAuditReportFile(
  file: File,
  fiscalYear: number,
  subsidiaryId: string,
  previousStoragePath: string | null,
): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error(`파일은 ${MAX_BYTES / 1024 / 1024}MB 이하여야 합니다.`);
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext && !ALLOWED_EXT.has(ext)) {
    throw new Error(`허용 형식: ${[...ALLOWED_EXT].join(', ')}`);
  }

  if (previousStoragePath) {
    const prev = normalizeAuditReportStoragePath(previousStoragePath);
    const { error: rmErr } = await supabase.storage.from(AUDIT_REPORT_BUCKET).remove([prev]);
    if (rmErr) console.warn('audit report 이전 파일 삭제 실패(무시 가능):', rmErr.message);
  }

  const objectPath = buildAuditReportObjectPath(fiscalYear, subsidiaryId, file.name);
  const { error } = await supabase.storage.from(AUDIT_REPORT_BUCKET).upload(objectPath, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
      throw new Error(
        `Storage 버킷 '${AUDIT_REPORT_BUCKET}'이 없습니다. docs/audit-report-storage-setup.sql을 실행해 주세요.`,
      );
    }
    if (error.message?.includes('row-level security') || error.message?.includes('policy')) {
      throw new Error(`Storage 권한이 없습니다. '${AUDIT_REPORT_BUCKET}' 버킷 정책을 확인해 주세요.`);
    }
    throw new Error(error.message || '업로드 실패');
  }

  return objectPath;
}

export async function removeAuditReportFile(storagePath: string): Promise<void> {
  const path = normalizeAuditReportStoragePath(storagePath);
  const { error } = await supabase.storage.from(AUDIT_REPORT_BUCKET).remove([path]);
  if (error) console.warn('audit report storage 삭제 실패:', error.message);
}

export async function downloadAuditReportBlob(storagePath: string): Promise<Blob | null> {
  const path = normalizeAuditReportStoragePath(storagePath);
  const { data, error } = await supabase.storage.from(AUDIT_REPORT_BUCKET).download(path);
  if (error || !data) return null;
  return data;
}

/** 외부 공유 등 서명 URL이 필요할 때만 사용 — 비공개 버킷 미리보기는 downloadAuditReportBlob 권장 */
export async function getAuditReportSignedUrl(storagePath: string): Promise<string | null> {
  const path = normalizeAuditReportStoragePath(storagePath);
  const { data, error } = await supabase.storage
    .from(AUDIT_REPORT_BUCKET)
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
