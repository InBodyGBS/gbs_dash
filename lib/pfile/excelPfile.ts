/**
 * P-File 일괄 편집용 엑셀 (entities / ownership 시트)
 */

import { v4 as uuidv4 } from 'uuid';

export const PFILE_XLS_ENTITIES = 'entities';
export const PFILE_XLS_OWNERSHIP = 'ownership';
export const PFILE_XLS_README = 'readme';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(String(s).trim());
}

function str(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numInt(v: unknown, def: number): number {
  if (v == null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

/** DB + 조인(sub subsidiaries) 행으로 node_key 계산 */
export function deriveNodeKey(row: Record<string, unknown>): string {
  if (row.entity_type === 'hq') return 'HQ';
  const sub = row.subsidiaries as { code?: string } | null | undefined;
  if (sub && typeof sub === 'object' && sub.code) return String(sub.code).trim();
  const id = str(row.id).replace(/-/g, '');
  return id ? `E_${id.slice(0, 12)}` : `E_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
}

function formatDateForCell(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = str(v);
  return s.length >= 10 ? s.slice(0, 10) : s || null;
}

/** 현재 DB 스냅샷 → 워크북 바이너리 */
export async function buildPfileExcelBuffer(
  entities: Record<string, unknown>[],
  ownership: Record<string, unknown>[],
): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx');

  const entityRows = entities.map((e) => ({
    node_key: deriveNodeKey(e),
    id: e.id,
    name: e.name,
    entity_type: e.entity_type,
    subsidiary_id: e.subsidiary_id ?? '',
    incorporation_date: formatDateForCell(e.incorporation_date),
    country: e.country ?? '',
    industry: e.industry ?? '',
    currency: e.currency ?? '',
    display_order: e.display_order ?? 0,
  }));

  const ownRows = ownership.map((o) => {
    const fromE = entities.find((x) => x.id === o.from_entity_id);
    const toE = entities.find((x) => x.id === o.to_entity_id);
    return {
      from_node_key: fromE ? deriveNodeKey(fromE) : '',
      to_node_key: toE ? deriveNodeKey(toE) : '',
      id: o.id,
      relation_kind: o.relation_kind,
      share_pct: o.share_pct ?? '',
      note: o.note ?? '',
    };
  });

  const readme = [
    ['P-File 엑셀 안내'],
    [''],
    ['entities 시트'],
    ['- node_key: 법인 고유 키(ownership 연결용). HQ는 HQ 권장. 법인코드 연동 시 subsidiaries.code가 내보내기에 쓰일 수 있음.'],
    ['- id: 비우면 업로드 시 새 UUID. 수정 시 기존 id 유지.'],
    ['- entity_type: hq | subsidiary | associate'],
    ['- subsidiary_id: public.subsidiaries.id (선택, UUID)'],
    [''],
    ['ownership 시트'],
    ['- from_node_key / to_node_key: entities.node_key와 동일 문자열'],
    ['- relation_kind: control(지배 트리) | associate(관계기업 연결)'],
    ['- share_pct: 숫자(선택), note: 비고'],
    [''],
    ['※ 업로드는 기존 pfile_ownership·pfile_entities 행을 삭제한 뒤 엑셀 내용으로 덮어씁니다.'],
  ];

  const ownSheet =
    ownRows.length > 0
      ? XLSX.utils.json_to_sheet(ownRows)
      : XLSX.utils.aoa_to_sheet([
          ['from_node_key', 'to_node_key', 'id', 'relation_kind', 'share_pct', 'note'],
        ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entityRows), PFILE_XLS_ENTITIES);
  XLSX.utils.book_append_sheet(wb, ownSheet, PFILE_XLS_OWNERSHIP);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readme), PFILE_XLS_README);

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

/** 빈 양식(헤더 + 예시 1행) */
export async function buildPfileTemplateBuffer(): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx');
  const entityRows = [
    {
      node_key: 'HQ',
      id: '',
      name: '본사(예시)',
      entity_type: 'hq',
      subsidiary_id: '',
      incorporation_date: '',
      country: 'KR',
      industry: '',
      currency: 'KRW',
      display_order: 0,
    },
  ];
  const readme = [
    ['P-File 빈 양식'],
    ['entities 예시 행을 복사·수정하고, ownership에 node_key로 연결하세요.'],
    ['업로드 시 DB 기존 P-File 데이터가 모두 대체됩니다.'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entityRows), PFILE_XLS_ENTITIES);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['from_node_key', 'to_node_key', 'id', 'relation_kind', 'share_pct', 'note']]),
    PFILE_XLS_OWNERSHIP,
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(readme), PFILE_XLS_README);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
}

export interface ParsedPfileExcel {
  entities: {
    id: string;
    name: string;
    entity_type: string;
    subsidiary_id: string | null;
    incorporation_date: string | null;
    country: string | null;
    industry: string | null;
    currency: string | null;
    display_order: number;
  }[];
  ownership: {
    id: string;
    from_entity_id: string;
    to_entity_id: string;
    relation_kind: string;
    share_pct: number | null;
    note: string | null;
  }[];
}

export async function parsePfileExcelBuffer(buf: ArrayBuffer): Promise<ParsedPfileExcel> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const entSheet = wb.Sheets[PFILE_XLS_ENTITIES];
  const ownSheet = wb.Sheets[PFILE_XLS_OWNERSHIP];
  if (!entSheet) throw new Error(`시트 "${PFILE_XLS_ENTITIES}" 가 없습니다.`);
  if (!ownSheet) throw new Error(`시트 "${PFILE_XLS_OWNERSHIP}" 가 없습니다.`);

  const entRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(entSheet, { defval: '' });
  const ownRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ownSheet, { defval: '' });

  const keyToId = new Map<string, string>();
  const usedKeys = new Set<string>();
  const entities: ParsedPfileExcel['entities'] = [];

  for (let i = 0; i < entRaw.length; i++) {
    const row = entRaw[i]!;
    const nodeKey = str(row.node_key);
    const name = str(row.name);
    const entityType = str(row.entity_type).toLowerCase();
    if (!nodeKey) throw new Error(`entities ${i + 2}행: node_key가 비었습니다.`);
    if (usedKeys.has(nodeKey)) throw new Error(`entities: node_key 중복 "${nodeKey}"`);
    usedKeys.add(nodeKey);
    if (!name) throw new Error(`entities ${i + 2}행 (${nodeKey}): name이 비었습니다.`);
    if (!['hq', 'subsidiary', 'associate'].includes(entityType)) {
      throw new Error(`entities ${i + 2}행 (${nodeKey}): entity_type은 hq|subsidiary|associate 만 허용됩니다.`);
    }
    let id = str(row.id);
    if (id && !isUuid(id)) throw new Error(`entities ${i + 2}행 (${nodeKey}): id가 올바른 UUID가 아닙니다.`);
    if (!id) id = uuidv4();
    keyToId.set(nodeKey, id);

    let subId = str(row.subsidiary_id);
    if (!subId) subId = '';
    if (subId && !isUuid(subId)) {
      throw new Error(`entities ${i + 2}행 (${nodeKey}): subsidiary_id가 올바른 UUID가 아닙니다.`);
    }

    const inc = formatDateForCell(row.incorporation_date);
    entities.push({
      id,
      name,
      entity_type: entityType,
      subsidiary_id: subId || null,
      incorporation_date: inc,
      country: str(row.country) || null,
      industry: str(row.industry) || null,
      currency: str(row.currency) || null,
      display_order: numInt(row.display_order, 0),
    });
  }

  const hqN = entities.filter((e) => e.entity_type === 'hq').length;
  if (hqN !== 1) throw new Error(`HQ(entity_type=hq)는 정확히 1개여야 합니다. (현재 ${hqN}개)`);

  const ownership: ParsedPfileExcel['ownership'] = [];
  for (let i = 0; i < ownRaw.length; i++) {
    const row = ownRaw[i]!;
    const fk = str(row.from_node_key);
    const tk = str(row.to_node_key);
    if (!fk && !tk && !str(row.relation_kind)) continue;
    if (!fk || !tk) throw new Error(`ownership ${i + 2}행: from_node_key, to_node_key 모두 필요합니다.`);

    const fromId = keyToId.get(fk);
    const toId = keyToId.get(tk);
    if (!fromId) throw new Error(`ownership ${i + 2}행: from_node_key "${fk}" 가 entities에 없습니다.`);
    if (!toId) throw new Error(`ownership ${i + 2}행: to_node_key "${tk}" 가 entities에 없습니다.`);

    const rk = str(row.relation_kind).toLowerCase();
    if (!['control', 'associate'].includes(rk)) {
      throw new Error(`ownership ${i + 2}행: relation_kind는 control|associate 만 허용됩니다.`);
    }

    let oid = str(row.id);
    if (oid && !isUuid(oid)) throw new Error(`ownership ${i + 2}행: id가 올바른 UUID가 아닙니다.`);
    if (!oid) oid = uuidv4();

    ownership.push({
      id: oid,
      from_entity_id: fromId,
      to_entity_id: toId,
      relation_kind: rk,
      share_pct: numOrNull(row.share_pct),
      note: str(row.note) || null,
    });
  }

  return { entities, ownership };
}
