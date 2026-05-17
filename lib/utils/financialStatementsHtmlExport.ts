/**
 * Financial Statements HTML Export
 *
 * 사용자가 선택한 Entity + 기준 월(년/월) 을 받아 standalone HTML 파일을 생성한다.
 * 생성된 HTML 은 인라인 CSS + 인라인 JS 로 모든 기능을 가져 외부 의존 없이 열린다.
 *
 * 구조:
 *   상단 탭: P/L | B/S
 *   하위 탭: QoQ | YoY(Q) | YoY(Y)
 *
 *   QoQ      = 직전 분기 (Quarter‑over‑Quarter)
 *   YoY(Q)   = 전년 동분기 (Year‑over‑Year, 분기)
 *   YoY(Y)   = 전년 동월(YTD) (Year‑over‑Year, 누계)
 *
 * 데이터:
 *   - P/L: 분기 합계 = 해당 분기에 속하는 단월값(누계 차이) 합산
 *   - YTD: 해당 월 누계 그대로
 *   - B/S: 시점값(quarter‑end 또는 month‑end)
 */

import {
  getPLResults,
  getBSResultsForPeriods,
  getStdBSMaster,
  getStdPLMaster,
} from '@/lib/services/monthlyClosingService';
import type { StdBSMaster, StdPLMaster } from '@/lib/types/monthly-closing';

// ============================================
// 기간 헬퍼
// ============================================

/** (year, month) 가 속한 분기 (1..4) */
function quarterOf(month: number): number {
  return Math.ceil(month / 3);
}

/** 분기 시작/끝 월 (calendar) */
function quarterMonths(quarter: number): { start: number; end: number } {
  return { start: (quarter - 1) * 3 + 1, end: quarter * 3 };
}

/** 이전 분기 (calendar) — 1Q 직전은 작년 4Q */
function prevQuarter(year: number, quarter: number): { year: number; quarter: number } {
  if (quarter === 1) return { year: year - 1, quarter: 4 };
  return { year, quarter: quarter - 1 };
}

// ============================================
// PL 단월 / 분기 / YTD 합계
// ============================================

/** 특정 entity 의 (year, month) 단월값을 코드별 Map 으로 반환 */
async function loadSingleMonthMap(
  entityCode: string,
  year: number,
  month: number,
): Promise<Map<string, number>> {
  const byCode = new Map<string, number>();
  const cumulative = await getPLResults(entityCode, year, month);
  if (cumulative.length === 0) return byCode;
  if (month === 1) {
    cumulative.forEach((r) => {
      byCode.set(r.std_pl_code, (byCode.get(r.std_pl_code) || 0) + r.amount);
    });
    return byCode;
  }
  const prevCumulative = await getPLResults(entityCode, year, month - 1);
  const currMap = new Map<string, number>();
  cumulative.forEach((r) =>
    currMap.set(r.std_pl_code, (currMap.get(r.std_pl_code) || 0) + r.amount),
  );
  const prevMap = new Map<string, number>();
  prevCumulative.forEach((r) =>
    prevMap.set(r.std_pl_code, (prevMap.get(r.std_pl_code) || 0) + r.amount),
  );
  const allCodes = new Set<string>([...currMap.keys(), ...prevMap.keys()]);
  allCodes.forEach((code) => {
    byCode.set(code, (currMap.get(code) || 0) - (prevMap.get(code) || 0));
  });
  return byCode;
}

/** 여러 entity 의 (year, month) 단월값을 코드별 합계 Map 으로 (entity 간 합) */
async function loadSingleMonthMapForEntities(
  entityCodes: string[],
  year: number,
  month: number,
): Promise<Map<string, number>> {
  const sum = new Map<string, number>();
  for (const entityCode of entityCodes) {
    const m = await loadSingleMonthMap(entityCode, year, month);
    m.forEach((v, k) => sum.set(k, (sum.get(k) || 0) + v));
  }
  return sum;
}

/** (year, quarter) 분기 합계 (= 분기 내 단월 합) */
async function loadQuarterMap(
  entityCodes: string[],
  year: number,
  quarter: number,
): Promise<Map<string, number>> {
  const { start, end } = quarterMonths(quarter);
  const total = new Map<string, number>();
  for (let m = start; m <= end; m++) {
    const monthMap = await loadSingleMonthMapForEntities(entityCodes, year, m);
    monthMap.forEach((v, k) => total.set(k, (total.get(k) || 0) + v));
  }
  return total;
}

/** YTD 누계 (year, month) — pl_results 직접 (sign 정규화는 service 에서 수행) */
async function loadYtdMap(
  entityCodes: string[],
  year: number,
  month: number,
): Promise<Map<string, number>> {
  const total = new Map<string, number>();
  for (const entityCode of entityCodes) {
    const rows = await getPLResults(entityCode, year, month);
    rows.forEach((r) => {
      total.set(r.std_pl_code, (total.get(r.std_pl_code) || 0) + r.amount);
    });
  }
  return total;
}

// ============================================
// PL 계산값 (Map → 손익 라인)
// ============================================

interface PLLineValues {
  sales: number;
  cogs: number;
  grossProfit: number;
  gpMargin: number | null;
  sga: number;
  operatingIncome: number;
  operatingMargin: number | null;
  otherRevenue: number;
  otherExpense: number;
  financialRevenue: number;
  financialExpense: number;
  incomeBeforeTax: number;
  corporateIncomeTax: number;
  netIncome: number;
  netMargin: number | null;
}

const SALES_CODES = ['41000', '42000', '43000', '44000', '45000', '46000'];
const COGS_CODES = ['51000', '52000', '53000', '54000'];
const SGA_PREFIX = '600';
const OTHER_REV_PREFIX = '710';
const OTHER_EXP_PREFIX = '720';
const FIN_REV_PREFIX = '730';
const FIN_EXP_PREFIX = '740';
const TAX_CODE = '80001';

function deriveLines(byCode: Map<string, number>): PLLineValues {
  const sum = (codes: readonly string[]) =>
    codes.reduce((s, c) => s + (byCode.get(c) || 0), 0);
  const sumByPrefix = (prefix: string) => {
    let s = 0;
    byCode.forEach((v, k) => {
      if (k.startsWith(prefix)) s += v;
    });
    return s;
  };
  const sales = sum(SALES_CODES);
  const cogs = sum(COGS_CODES);
  const gp = sales - cogs;
  const sga = sumByPrefix(SGA_PREFIX);
  const op = gp - sga;
  const otherRev = sumByPrefix(OTHER_REV_PREFIX);
  const otherExp = sumByPrefix(OTHER_EXP_PREFIX);
  const finRev = sumByPrefix(FIN_REV_PREFIX);
  const finExp = sumByPrefix(FIN_EXP_PREFIX);
  const tax = byCode.get(TAX_CODE) || 0;
  const ibt = op + otherRev - otherExp + finRev - finExp;
  const ni = ibt - tax;
  return {
    sales,
    cogs,
    grossProfit: gp,
    gpMargin: sales !== 0 ? (gp / sales) * 100 : null,
    sga,
    operatingIncome: op,
    operatingMargin: sales !== 0 ? (op / sales) * 100 : null,
    otherRevenue: otherRev,
    otherExpense: otherExp,
    financialRevenue: finRev,
    financialExpense: finExp,
    incomeBeforeTax: ibt,
    corporateIncomeTax: tax,
    netIncome: ni,
    netMargin: sales !== 0 ? (ni / sales) * 100 : null,
  };
}

// ============================================
// BS 시점 데이터 (point in time)
// ============================================

/** entity 들의 (year, month) 시점 BS 를 코드별 합계 Map 으로 */
async function loadBSPointMap(
  entityCodes: string[],
  year: number,
  month: number,
): Promise<Map<string, number>> {
  const rows = await getBSResultsForPeriods(entityCodes, [{ year, month }]);
  const m = new Map<string, number>();
  rows.forEach((r) => {
    m.set(r.std_bs_code, (m.get(r.std_bs_code) || 0) + r.amount);
  });
  return m;
}

// ============================================
// HTML 렌더링 헬퍼
// ============================================

function fmt(n: number): string {
  if (n === 0) return '-';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000)
    return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

function fmtPct(n: number | null): string {
  if (n === null || !isFinite(n)) return '-';
  return `${n >= 0 ? '' : ''}${n.toFixed(1)}%`;
}

function diffPct(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

interface PLRow {
  label: string;
  curr: number;
  prev: number;
  diff: number;
  diffPct: number | null;
  bold?: boolean;
  indent?: boolean;
  margin?: boolean; // 마진 행 (퍼센트 표시)
  /** SG&A 본 행이면 자식(600xx) 행 배열을 갖는다. 클릭 시 expand */
  children?: PLRow[];
  /** 자식 행 표시용 — true 면 hidden 상태로 출력 */
  isChild?: boolean;
  /** 그룹 식별자 (parent/child 매칭) */
  groupId?: string;
}

/** SG&A 자식(600xx) 행 생성 */
function buildSgaChildren(
  plMaster: StdPLMaster[],
  currMap: Map<string, number>,
  prevMap: Map<string, number>,
  groupId: string,
): PLRow[] {
  const sgaCodes = plMaster
    .filter((m) => m.pl_code.startsWith('600'))
    .sort((a, b) => a.pl_code.localeCompare(b.pl_code));
  return sgaCodes
    .map((m) => {
      const c = currMap.get(m.pl_code) || 0;
      const p = prevMap.get(m.pl_code) || 0;
      return {
        label: `${m.pl_code}  ${m.pl_line}`,
        curr: c,
        prev: p,
        diff: c - p,
        diffPct: diffPct(c, p),
        isChild: true,
        groupId,
        indent: true,
      } as PLRow;
    })
    .filter((r) => r.curr !== 0 || r.prev !== 0);
}

function buildPLRows(
  curr: PLLineValues,
  prev: PLLineValues,
  plMaster: StdPLMaster[],
  currMap: Map<string, number>,
  prevMap: Map<string, number>,
  groupId: string,
): PLRow[] {
  const row = (label: string, c: number, p: number, opts: Partial<PLRow> = {}): PLRow => ({
    label,
    curr: c,
    prev: p,
    diff: c - p,
    diffPct: diffPct(c, p),
    ...opts,
  });
  const marginRow = (label: string, c: number | null, p: number | null): PLRow => ({
    label,
    curr: c ?? 0,
    prev: p ?? 0,
    diff: (c ?? 0) - (p ?? 0),
    diffPct: null,
    margin: true,
    indent: true,
  });

  const sgaChildren = buildSgaChildren(plMaster, currMap, prevMap, groupId);

  return [
    row('Sales', curr.sales, prev.sales),
    row('Cost of Goods Sold', curr.cogs, prev.cogs),
    row('Gross Profit', curr.grossProfit, prev.grossProfit, { bold: true }),
    marginRow('  GP Margin %', curr.gpMargin, prev.gpMargin),
    row('Selling & Admin Expense', curr.sga, prev.sga, { children: sgaChildren }),
    row('Operating Income', curr.operatingIncome, prev.operatingIncome, { bold: true }),
    marginRow('  Operating Margin %', curr.operatingMargin, prev.operatingMargin),
    row('Other Revenue', curr.otherRevenue, prev.otherRevenue),
    row('Other Expense', curr.otherExpense, prev.otherExpense),
    row('Financial Revenue', curr.financialRevenue, prev.financialRevenue),
    row('Financial Expense', curr.financialExpense, prev.financialExpense),
    row('Income before Tax', curr.incomeBeforeTax, prev.incomeBeforeTax, { bold: true }),
    row('Corporate Income Tax', curr.corporateIncomeTax, prev.corporateIncomeTax),
    row('Net Income', curr.netIncome, prev.netIncome, { bold: true }),
    marginRow('  Net Margin %', curr.netMargin, prev.netMargin),
  ];
}

function renderPLTable(
  rows: PLRow[],
  currLabel: string,
  prevLabel: string,
): string {
  const renderRow = (r: PLRow): string => {
    const isMargin = r.margin === true;
    const hasChildren = Array.isArray(r.children) && r.children.length > 0;
    const labelCell = hasChildren
      ? `<td class="expandable" data-group="${escapeHtml(r.groupId ?? '')}-sga">
           <span class="chevron">▶</span> ${escapeHtml(r.label)}
           <span class="hint">(${r.children!.length}개 계정)</span>
         </td>`
      : `<td>${escapeHtml(r.label)}</td>`;
    const cells = isMargin
      ? `${labelCell}
         <td class="num pct">${fmtPct(r.curr === 0 ? null : r.curr)}</td>
         <td class="num pct">${fmtPct(r.prev === 0 ? null : r.prev)}</td>
         <td class="num pct">${r.diff !== 0 ? `${r.diff > 0 ? '+' : ''}${r.diff.toFixed(1)}pp` : '-'}</td>
         <td class="num pct">-</td>`
      : `${labelCell}
         <td class="num">${fmt(r.curr)}</td>
         <td class="num">${fmt(r.prev)}</td>
         <td class="num ${r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : ''}">${r.diff !== 0 ? `${r.diff > 0 ? '+' : ''}${fmt(r.diff)}` : '-'}</td>
         <td class="num ${(r.diffPct ?? 0) > 0 ? 'pos' : (r.diffPct ?? 0) < 0 ? 'neg' : ''}">${
           r.diffPct === null
             ? '-'
             : `${r.diffPct > 0 ? '+' : ''}${r.diffPct.toFixed(1)}%`
         }</td>`;
    const klass = [
      r.bold ? 'bold' : '',
      r.indent ? 'indent' : '',
      r.margin ? 'margin-row' : '',
      r.isChild ? 'child-row hidden' : '',
      hasChildren ? 'parent-row' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const dataGroup = r.isChild ? ` data-child-group="${escapeHtml(r.groupId ?? '')}-sga"` : '';
    return `<tr class="${klass}"${dataGroup}>${cells}</tr>`;
  };

  const trs = rows
    .map((r) => {
      const main = renderRow(r);
      if (r.children && r.children.length > 0) {
        const childRows = r.children.map(renderRow).join('\n');
        return main + '\n' + childRows;
      }
      return main;
    })
    .join('\n');
  return `<table class="fs">
    <thead>
      <tr>
        <th>P&L Line</th>
        <th class="num">${escapeHtml(currLabel)}</th>
        <th class="num">${escapeHtml(prevLabel)}</th>
        <th class="num">증감</th>
        <th class="num">증감 %</th>
      </tr>
    </thead>
    <tbody>${trs}</tbody>
  </table>`;
}

// ============================================
// B/S 렌더링
// ============================================

interface BSRow {
  code: string;
  label: string;
  curr: number;
  prev: number;
  diff: number;
  diffPct: number | null;
  isCategory?: boolean;
}

function renderBSTable(
  bsMaster: StdBSMaster[],
  currMap: Map<string, number>,
  prevMap: Map<string, number>,
  currLabel: string,
  prevLabel: string,
): string {
  // 카테고리별 그룹화 (bs_category)
  // master 는 display_order 로 이미 정렬돼 있다고 가정
  const rows: BSRow[] = bsMaster
    .map((m) => {
      const curr = currMap.get(m.bs_code) || 0;
      const prev = prevMap.get(m.bs_code) || 0;
      return {
        code: m.bs_code,
        label: m.bs_line,
        curr,
        prev,
        diff: curr - prev,
        diffPct: diffPct(curr, prev),
      };
    })
    .filter((r) => r.curr !== 0 || r.prev !== 0);

  const trs = rows
    .map((r) => {
      return `<tr>
        <td><span class="code">${escapeHtml(r.code)}</span> ${escapeHtml(r.label)}</td>
        <td class="num">${fmt(r.curr)}</td>
        <td class="num">${fmt(r.prev)}</td>
        <td class="num ${r.diff > 0 ? 'pos' : r.diff < 0 ? 'neg' : ''}">${r.diff !== 0 ? `${r.diff > 0 ? '+' : ''}${fmt(r.diff)}` : '-'}</td>
        <td class="num ${(r.diffPct ?? 0) > 0 ? 'pos' : (r.diffPct ?? 0) < 0 ? 'neg' : ''}">${
          r.diffPct === null
            ? '-'
            : `${r.diffPct > 0 ? '+' : ''}${r.diffPct.toFixed(1)}%`
        }</td>
      </tr>`;
    })
    .join('\n');

  return `<table class="fs">
    <thead>
      <tr>
        <th>B/S Line</th>
        <th class="num">${escapeHtml(currLabel)}</th>
        <th class="num">${escapeHtml(prevLabel)}</th>
        <th class="num">증감</th>
        <th class="num">증감 %</th>
      </tr>
    </thead>
    <tbody>${trs}</tbody>
  </table>`;
}

// ============================================
// 메인: HTML 생성
// ============================================

export interface ExportArgs {
  entityCodes: string[];
  entityLabel: string;
  year: number;
  month: number;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function generateFinancialStatementsHtml(args: ExportArgs): Promise<string> {
  const { entityCodes, entityLabel, year, month } = args;
  if (entityCodes.length === 0) throw new Error('Entity 가 선택되지 않았습니다.');

  // 기간 정의
  const currQ = quarterOf(month);
  const prevQ = prevQuarter(year, currQ);
  const yoyQ = { year: year - 1, quarter: currQ };

  // 분기 종료월(B/S 시점 비교에 사용)
  const qEndMonth = currQ * 3;
  const currQEnd = Math.min(month, qEndMonth); // 진행 중인 분기일 수 있음 → 선택 월까지
  const prevQEnd = quarterMonths(prevQ.quarter).end;
  const yoyQEnd = quarterMonths(yoyQ.quarter).end;

  // ── PL/BS 데이터 로드 ──
  // (loadQuarterMap 은 분기 내 단월 합)
  const [
    plMaster,
    bsMaster,
    currQMap,
    prevQMap,
    yoyQMap,
    currYtdMap,
    prevYtdMap,
    currBsMap,
    prevQBsMap,
    yoyQBsMap,
    yoyYBsMap,
  ] = await Promise.all([
    getStdPLMaster(),
    getStdBSMaster(),
    loadQuarterMap(entityCodes, year, currQ),
    loadQuarterMap(entityCodes, prevQ.year, prevQ.quarter),
    loadQuarterMap(entityCodes, yoyQ.year, yoyQ.quarter),
    loadYtdMap(entityCodes, year, month),
    loadYtdMap(entityCodes, year - 1, month),
    loadBSPointMap(entityCodes, year, month),
    loadBSPointMap(entityCodes, prevQ.year, prevQEnd),
    loadBSPointMap(entityCodes, yoyQ.year, yoyQEnd),
    loadBSPointMap(entityCodes, year - 1, month),
  ]);

  // PL 계산값
  const currQLines = deriveLines(currQMap);
  const prevQLines = deriveLines(prevQMap);
  const yoyQLines = deriveLines(yoyQMap);
  const currYtdLines = deriveLines(currYtdMap);
  const prevYtdLines = deriveLines(prevYtdMap);

  // 라벨
  const currQLabel = `${year} ${currQ}Q`;
  const prevQLabel = `${prevQ.year} ${prevQ.quarter}Q`;
  const yoyQLabel = `${yoyQ.year} ${yoyQ.quarter}Q`;
  const currYtdLabel = `${year}.${String(month).padStart(2, '0')} YTD`;
  const prevYtdLabel = `${year - 1}.${String(month).padStart(2, '0')} YTD`;
  const currBsLabel = `${year}.${String(month).padStart(2, '0')}말`;
  const prevQBsLabel = `${prevQ.year}.${String(prevQEnd).padStart(2, '0')}말`;
  const yoyQBsLabel = `${yoyQ.year}.${String(yoyQEnd).padStart(2, '0')}말`;
  const yoyYBsLabel = `${year - 1}.${String(month).padStart(2, '0')}말`;

  // PL 테이블 (3개) — 각 테이블마다 고유 groupId 로 SG&A drilldown 토글 격리
  const plQoQ = renderPLTable(
    buildPLRows(currQLines, prevQLines, plMaster, currQMap, prevQMap, 'plqoq'),
    currQLabel,
    prevQLabel,
  );
  const plYoYQ = renderPLTable(
    buildPLRows(currQLines, yoyQLines, plMaster, currQMap, yoyQMap, 'plyoyq'),
    currQLabel,
    yoyQLabel,
  );
  const plYoYY = renderPLTable(
    buildPLRows(currYtdLines, prevYtdLines, plMaster, currYtdMap, prevYtdMap, 'plyoyy'),
    currYtdLabel,
    prevYtdLabel,
  );

  // BS 테이블 (3개)
  const bsQoQ = renderBSTable(bsMaster, currBsMap, prevQBsMap, currBsLabel, prevQBsLabel);
  const bsYoYQ = renderBSTable(bsMaster, currBsMap, yoyQBsMap, currBsLabel, yoyQBsLabel);
  const bsYoYY = renderBSTable(bsMaster, currBsMap, yoyYBsMap, currBsLabel, yoyYBsLabel);

  const subjectTitle = `${entityLabel} Financial Statements (${year}.${String(month).padStart(2, '0')})`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subjectTitle)}</title>
<style>
  :root {
    --primary: #971B2F;
    --border: #e5e7eb;
    --text: #111827;
    --muted: #6b7280;
    --bg: #ffffff;
    --row-hover: #f9fafb;
    --pos: #059669;
    --neg: #DC2626;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    color: var(--text);
    background: var(--bg);
    margin: 0;
    padding: 24px 28px;
    font-size: 13px;
    line-height: 1.5;
  }
  header { border-bottom: 2px solid var(--primary); padding-bottom: 12px; margin-bottom: 16px; }
  header h1 { margin: 0 0 4px 0; font-size: 20px; color: var(--primary); }
  header .meta { color: var(--muted); font-size: 12px; }
  .tabs { display: flex; gap: 4px; margin: 16px 0 8px; border-bottom: 1px solid var(--border); }
  .tabs button {
    background: none; border: 1px solid transparent; border-bottom: none;
    padding: 7px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
    color: var(--muted); border-radius: 6px 6px 0 0;
  }
  .tabs button.active { background: var(--bg); color: var(--primary); border-color: var(--border); border-bottom-color: var(--bg); position: relative; top: 1px; }
  .subtabs { display: flex; gap: 4px; margin: 12px 0 8px; }
  .subtabs button {
    background: #f3f4f6; border: 1px solid var(--border); padding: 5px 12px;
    font-size: 12px; cursor: pointer; border-radius: 4px; color: var(--muted);
  }
  .subtabs button.active { background: var(--primary); color: white; border-color: var(--primary); }
  .pane { display: none; }
  .pane.active { display: block; }
  table.fs { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.fs th, table.fs td { padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: middle; }
  table.fs th { background: #f9fafb; font-weight: 600; font-size: 12px; color: var(--muted); }
  table.fs td.num, table.fs th.num { text-align: right; font-variant-numeric: tabular-nums; font-family: "SF Mono", Consolas, monospace; }
  table.fs td.code { color: var(--muted); font-size: 11px; font-family: monospace; padding-right: 6px; }
  table.fs tr.bold td { font-weight: 700; background: #f3f4f6; }
  table.fs tr.margin-row td { color: var(--muted); font-style: italic; font-size: 12px; }
  table.fs tr.margin-row td.pct { font-style: normal; }
  table.fs td.indent { padding-left: 24px; }
  table.fs td.pos { color: var(--pos); }
  table.fs td.neg { color: var(--neg); }
  /* SG&A drilldown */
  table.fs td.expandable { cursor: pointer; user-select: none; }
  table.fs td.expandable:hover { color: var(--primary); }
  table.fs .chevron {
    display: inline-block;
    width: 1em;
    transition: transform 0.15s;
    color: var(--muted);
    font-size: 10px;
  }
  table.fs tr.parent-row.expanded td.expandable .chevron { transform: rotate(90deg); }
  table.fs .hint { color: var(--muted); font-size: 10px; margin-left: 6px; font-weight: normal; }
  table.fs tr.child-row { background: #fafafa; }
  table.fs tr.child-row td { padding-left: 36px !important; font-size: 12px; }
  table.fs tr.child-row.hidden { display: none; }
  .code { color: var(--muted); font-size: 11px; font-family: monospace; margin-right: 4px; }
  footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; }
  .legend { font-size: 11px; color: var(--muted); margin-bottom: 6px; }
  @media print {
    .tabs button:not(.active), .subtabs button:not(.active) { display: none; }
    .pane { display: block !important; page-break-after: always; }
  }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(subjectTitle)}</h1>
  <div class="meta">기준일: ${year}.${String(month).padStart(2, '0')} · 생성: ${new Date().toISOString().slice(0, 10)}</div>
</header>

<div class="tabs">
  <button data-tab="pl" class="active">P/L</button>
  <button data-tab="bs">B/S</button>
</div>

<!-- ============ P/L ============ -->
<div class="pane active" data-pane="pl">
  <div class="subtabs">
    <button data-sub="qoq" data-section="pl" class="active">QoQ</button>
    <button data-sub="yoyq" data-section="pl">YoY(Q)</button>
    <button data-sub="yoyy" data-section="pl">YoY(Y)</button>
  </div>
  <div class="legend">금액 단위: K=천, M=백만, B=십억 (반올림 표시)</div>
  <div class="pane active" data-pane="pl-qoq">${plQoQ}</div>
  <div class="pane" data-pane="pl-yoyq">${plYoYQ}</div>
  <div class="pane" data-pane="pl-yoyy">${plYoYY}</div>
</div>

<!-- ============ B/S ============ -->
<div class="pane" data-pane="bs">
  <div class="subtabs">
    <button data-sub="qoq" data-section="bs" class="active">QoQ</button>
    <button data-sub="yoyq" data-section="bs">YoY(Q)</button>
    <button data-sub="yoyy" data-section="bs">YoY(Y)</button>
  </div>
  <div class="legend">시점값: 각 분기/월 말 잔액</div>
  <div class="pane active" data-pane="bs-qoq">${bsQoQ}</div>
  <div class="pane" data-pane="bs-yoyq">${bsYoYQ}</div>
  <div class="pane" data-pane="bs-yoyy">${bsYoYY}</div>
</div>

<footer>
  InBody Accounting Portal · Generated from Financial Dashboard · Entity: ${escapeHtml(entityLabel)}
</footer>

<script>
(function() {
  function setMainTab(name) {
    document.querySelectorAll('.tabs button').forEach(function(b){
      b.classList.toggle('active', b.dataset.tab === name);
    });
    // 상위 pane (data-pane="pl" / "bs") 만 토글
    document.querySelectorAll('body > .pane').forEach(function(p){
      p.classList.toggle('active', p.dataset.pane === name);
    });
  }
  function setSubTab(section, sub) {
    var sec = document.querySelector('[data-pane="' + section + '"]');
    if (!sec) return;
    sec.querySelectorAll('.subtabs button').forEach(function(b){
      b.classList.toggle('active', b.dataset.sub === sub);
    });
    sec.querySelectorAll(':scope > .pane').forEach(function(p){
      var key = section + '-' + sub;
      p.classList.toggle('active', p.dataset.pane === key);
    });
  }
  document.querySelectorAll('.tabs button').forEach(function(b){
    b.addEventListener('click', function(){ setMainTab(b.dataset.tab); });
  });
  document.querySelectorAll('.subtabs button').forEach(function(b){
    b.addEventListener('click', function(){ setSubTab(b.dataset.section, b.dataset.sub); });
  });
  // SG&A drilldown toggle
  document.querySelectorAll('td.expandable').forEach(function(td){
    td.addEventListener('click', function(){
      var group = td.dataset.group;
      if (!group) return;
      var parent = td.closest('tr');
      var expanded = parent.classList.toggle('expanded');
      document.querySelectorAll('tr[data-child-group="' + group + '"]').forEach(function(child){
        child.classList.toggle('hidden', !expanded);
      });
    });
  });
})();
</script>
</body>
</html>`;
}

/**
 * 클라이언트에서 HTML 을 다운로드 트리거 (브라우저 환경 한정)
 */
export function downloadHtml(filename: string, html: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 100);
}
