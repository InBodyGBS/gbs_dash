/**
 * Analytics HTML Export
 *
 * Financial Statements 와 별개로 "분석 지표" 만 모은 standalone HTML 을 생성한다.
 * 표준 패키지: 성장성 / 수익성 / 비용구조 / SG&A breakdown / 위험 신호 / 한줄 해석.
 *
 * 데이터 정의:
 *  - "당기" 단월 = 선택한 (year, month) 의 단월값
 *  - QoQ 비교 = 직전월 단월
 *  - YoY 비교 = 전년 동월 단월
 *  - YTD     = 1월~선택월 누계
 *  - 전년 YTD = 전년 1월~선택월 누계
 */

import {
  getPLResults,
  getStdPLMaster,
} from '@/lib/services/monthlyClosingService';

// ============================================
// 데이터 로드 (Financial Statements 의 헬퍼와 동일 로직, 일부 발췌)
// ============================================

async function loadSingleMonthMap(
  entityCode: string,
  year: number,
  month: number,
): Promise<Map<string, number>> {
  const byCode = new Map<string, number>();
  const cumulative = await getPLResults(entityCode, year, month);
  if (cumulative.length === 0) return byCode;
  if (month === 1) {
    cumulative.forEach((r) =>
      byCode.set(r.std_pl_code, (byCode.get(r.std_pl_code) || 0) + r.amount),
    );
    return byCode;
  }
  const prev = await getPLResults(entityCode, year, month - 1);
  const c = new Map<string, number>();
  cumulative.forEach((r) => c.set(r.std_pl_code, (c.get(r.std_pl_code) || 0) + r.amount));
  const p = new Map<string, number>();
  prev.forEach((r) => p.set(r.std_pl_code, (p.get(r.std_pl_code) || 0) + r.amount));
  new Set([...c.keys(), ...p.keys()]).forEach((code) => {
    byCode.set(code, (c.get(code) || 0) - (p.get(code) || 0));
  });
  return byCode;
}

async function loadSingleMonthForEntities(
  entityCodes: string[],
  year: number,
  month: number,
): Promise<Map<string, number>> {
  const sum = new Map<string, number>();
  for (const e of entityCodes) {
    const m = await loadSingleMonthMap(e, year, month);
    m.forEach((v, k) => sum.set(k, (sum.get(k) || 0) + v));
  }
  return sum;
}

async function loadYtd(
  entityCodes: string[],
  year: number,
  month: number,
): Promise<Map<string, number>> {
  const sum = new Map<string, number>();
  for (const e of entityCodes) {
    const rows = await getPLResults(e, year, month);
    rows.forEach((r) => sum.set(r.std_pl_code, (sum.get(r.std_pl_code) || 0) + r.amount));
  }
  return sum;
}

// ============================================
// 손익 도출 헬퍼
// ============================================

const SALES_CODES = ['41000', '42000', '43000', '44000', '45000', '46000'];
const COGS_CODES = ['51000', '52000', '53000', '54000'];

interface PLAgg {
  sales: number;
  cogs: number;
  gp: number;
  gpMargin: number | null;
  sga: number;
  sgaSalesPct: number | null;
  op: number;
  opMargin: number | null;
  otherRev: number;
  otherExp: number;
  finRev: number;
  finExp: number;
  ibt: number;
  tax: number;
  ni: number;
  nm: number | null;
}

function aggregate(byCode: Map<string, number>): PLAgg {
  const sum = (codes: readonly string[]) =>
    codes.reduce((s, c) => s + (byCode.get(c) || 0), 0);
  const sumPrefix = (prefix: string) => {
    let s = 0;
    byCode.forEach((v, k) => {
      if (k.startsWith(prefix)) s += v;
    });
    return s;
  };
  const sales = sum(SALES_CODES);
  const cogs = sum(COGS_CODES);
  const gp = sales - cogs;
  const sga = sumPrefix('600');
  const op = gp - sga;
  const otherRev = sumPrefix('710');
  const otherExp = sumPrefix('720');
  const finRev = sumPrefix('730');
  const finExp = sumPrefix('740');
  const tax = byCode.get('80001') || 0;
  const ibt = op + otherRev - otherExp + finRev - finExp;
  const ni = ibt - tax;
  return {
    sales,
    cogs,
    gp,
    gpMargin: sales !== 0 ? (gp / sales) * 100 : null,
    sga,
    sgaSalesPct: sales !== 0 ? (sga / sales) * 100 : null,
    op,
    opMargin: sales !== 0 ? (op / sales) * 100 : null,
    otherRev,
    otherExp,
    finRev,
    finExp,
    ibt,
    tax,
    ni,
    nm: sales !== 0 ? (ni / sales) * 100 : null,
  };
}

// ============================================
// 포맷 헬퍼
// ============================================

function fmtNum(n: number): string {
  if (n === 0) return '-';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

function fmtPct(n: number | null, suffix = '%'): string {
  if (n === null || !isFinite(n)) return '-';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}${suffix}`;
}

function fmtPctAbs(n: number | null): string {
  if (n === null || !isFinite(n)) return '-';
  return `${n.toFixed(1)}%`;
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function pctPointChange(curr: number | null, prev: number | null): number | null {
  if (curr === null || prev === null) return null;
  return curr - prev;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================
// 메인
// ============================================

export interface AnalyticsExportArgs {
  entityCodes: string[];
  entityLabel: string;
  year: number;
  month: number;
}

export async function generateAnalyticsHtml(args: AnalyticsExportArgs): Promise<string> {
  const { entityCodes, entityLabel, year, month } = args;
  if (entityCodes.length === 0) throw new Error('Entity 가 선택되지 않았습니다.');

  // 직전월 (단순 month - 1, 1월이면 작년 12월)
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;

  const [
    plMaster,
    currMap,
    prevMap, // 직전월 단월 (QoQ)
    yoyMap, //  전년 동월 단월 (YoY)
    ytdMap,
    prevYtdMap, // 전년 동월 YTD
  ] = await Promise.all([
    getStdPLMaster(),
    loadSingleMonthForEntities(entityCodes, year, month),
    loadSingleMonthForEntities(entityCodes, prevYear, prevMonth),
    loadSingleMonthForEntities(entityCodes, year - 1, month),
    loadYtd(entityCodes, year, month),
    loadYtd(entityCodes, year - 1, month),
  ]);

  const curr = aggregate(currMap);
  const prev = aggregate(prevMap);
  const yoy = aggregate(yoyMap);
  const ytd = aggregate(ytdMap);
  const prevYtd = aggregate(prevYtdMap);

  // ── 성장성 ──
  const growthRows: Array<{ label: string; curr: string; qoq: string; yoy: string; ytd: string }> = [
    {
      label: 'Sales',
      curr: fmtNum(curr.sales),
      qoq: pctChange(curr.sales, prev.sales) !== null
        ? fmtPct(pctChange(curr.sales, prev.sales))
        : '-',
      yoy: pctChange(curr.sales, yoy.sales) !== null
        ? fmtPct(pctChange(curr.sales, yoy.sales))
        : '-',
      ytd: pctChange(ytd.sales, prevYtd.sales) !== null
        ? fmtPct(pctChange(ytd.sales, prevYtd.sales))
        : '-',
    },
    {
      label: 'Operating Income',
      curr: fmtNum(curr.op),
      qoq: pctChange(curr.op, prev.op) !== null
        ? fmtPct(pctChange(curr.op, prev.op))
        : '-',
      yoy: pctChange(curr.op, yoy.op) !== null
        ? fmtPct(pctChange(curr.op, yoy.op))
        : '-',
      ytd: pctChange(ytd.op, prevYtd.op) !== null
        ? fmtPct(pctChange(ytd.op, prevYtd.op))
        : '-',
    },
    {
      label: 'Net Income',
      curr: fmtNum(curr.ni),
      qoq: pctChange(curr.ni, prev.ni) !== null
        ? fmtPct(pctChange(curr.ni, prev.ni))
        : '-',
      yoy: pctChange(curr.ni, yoy.ni) !== null
        ? fmtPct(pctChange(curr.ni, yoy.ni))
        : '-',
      ytd: pctChange(ytd.ni, prevYtd.ni) !== null
        ? fmtPct(pctChange(ytd.ni, prevYtd.ni))
        : '-',
    },
  ];

  // ── 수익성 (Margin) ──
  const marginRows = [
    {
      label: 'GP Margin %',
      curr: fmtPctAbs(curr.gpMargin),
      prev: fmtPctAbs(prev.gpMargin),
      yoy: fmtPctAbs(yoy.gpMargin),
      ytd: fmtPctAbs(ytd.gpMargin),
      qoqPP: pctPointChange(curr.gpMargin, prev.gpMargin),
      yoyPP: pctPointChange(curr.gpMargin, yoy.gpMargin),
    },
    {
      label: 'Operating Margin %',
      curr: fmtPctAbs(curr.opMargin),
      prev: fmtPctAbs(prev.opMargin),
      yoy: fmtPctAbs(yoy.opMargin),
      ytd: fmtPctAbs(ytd.opMargin),
      qoqPP: pctPointChange(curr.opMargin, prev.opMargin),
      yoyPP: pctPointChange(curr.opMargin, yoy.opMargin),
    },
    {
      label: 'Net Margin %',
      curr: fmtPctAbs(curr.nm),
      prev: fmtPctAbs(prev.nm),
      yoy: fmtPctAbs(yoy.nm),
      ytd: fmtPctAbs(ytd.nm),
      qoqPP: pctPointChange(curr.nm, prev.nm),
      yoyPP: pctPointChange(curr.nm, yoy.nm),
    },
  ];

  // ── 비용 구조 (Cost Structure) ──
  const costRows = [
    {
      label: 'COGS / Sales',
      curr: curr.sales !== 0 ? (curr.cogs / curr.sales) * 100 : null,
      yoy: yoy.sales !== 0 ? (yoy.cogs / yoy.sales) * 100 : null,
    },
    {
      label: 'SG&A / Sales',
      curr: curr.sgaSalesPct,
      yoy: yoy.sgaSalesPct,
    },
    {
      label: 'Other Exp / Sales',
      curr: curr.sales !== 0 ? (curr.otherExp / curr.sales) * 100 : null,
      yoy: yoy.sales !== 0 ? (yoy.otherExp / yoy.sales) * 100 : null,
    },
    {
      label: 'Fin Exp / Sales',
      curr: curr.sales !== 0 ? (curr.finExp / curr.sales) * 100 : null,
      yoy: yoy.sales !== 0 ? (yoy.finExp / yoy.sales) * 100 : null,
    },
  ];

  // ── SG&A 계정과목별 (당기 vs 전년동월) ──
  const sgaRows = plMaster
    .filter((m) => m.pl_code.startsWith('600'))
    .sort((a, b) => a.pl_code.localeCompare(b.pl_code))
    .map((m) => {
      const c = currMap.get(m.pl_code) || 0;
      const p = yoyMap.get(m.pl_code) || 0;
      return {
        code: m.pl_code,
        label: m.pl_line,
        curr: c,
        prev: p,
        diff: c - p,
        diffPct: pctChange(c, p),
      };
    })
    .filter((r) => r.curr !== 0 || r.prev !== 0);

  // ── 위험 신호 (Risk Signals) ──
  const risks: Array<{ level: 'green' | 'yellow' | 'red'; text: string }> = [];
  if (curr.sales <= 0) {
    risks.push({ level: 'red', text: `매출 0 또는 음수 — 단월 Sales = ${fmtNum(curr.sales)}` });
  }
  if (curr.op < 0) {
    risks.push({ level: 'red', text: `영업적자 — Operating Income = ${fmtNum(curr.op)}` });
  } else if (curr.opMargin !== null && curr.opMargin < 3) {
    risks.push({
      level: 'yellow',
      text: `영업마진 낮음 (Operating Margin ${fmtPctAbs(curr.opMargin)}, 임계 3% 이하)`,
    });
  }
  if (curr.ni < 0) {
    risks.push({ level: 'red', text: `당기순손실 — Net Income = ${fmtNum(curr.ni)}` });
  }
  // 전년 대비 OPM 하락 ≥ 3pp
  if (curr.opMargin !== null && yoy.opMargin !== null) {
    const drop = yoy.opMargin - curr.opMargin;
    if (drop >= 3) {
      risks.push({
        level: 'yellow',
        text: `영업마진 전년 동월 대비 ${drop.toFixed(1)}pp 하락`,
      });
    } else if (drop <= -3) {
      risks.push({
        level: 'green',
        text: `영업마진 전년 동월 대비 ${(-drop).toFixed(1)}pp 개선`,
      });
    }
  }
  // SG&A 비중 급등
  if (curr.sgaSalesPct !== null && yoy.sgaSalesPct !== null) {
    const sgaJump = curr.sgaSalesPct - yoy.sgaSalesPct;
    if (sgaJump >= 5) {
      risks.push({
        level: 'yellow',
        text: `SG&A 비중 전년 동월 대비 ${sgaJump.toFixed(1)}pp 증가 — 비용 구조 점검 필요`,
      });
    }
  }
  // Revenue Growth 둔화
  if (curr.sales !== 0 && yoy.sales !== 0) {
    const revG = ((curr.sales - yoy.sales) / Math.abs(yoy.sales)) * 100;
    if (revG <= -10) {
      risks.push({ level: 'red', text: `매출 전년 동월 대비 ${revG.toFixed(1)}% 감소` });
    } else if (revG <= 0) {
      risks.push({ level: 'yellow', text: `매출 전년 동월 대비 ${revG.toFixed(1)}% — 둔화 신호` });
    } else if (revG >= 20) {
      risks.push({ level: 'green', text: `매출 전년 동월 대비 +${revG.toFixed(1)}% 강한 성장` });
    }
  }
  if (risks.length === 0) {
    risks.push({ level: 'green', text: '특이 위험 신호 없음 — 주요 지표가 안정 범위' });
  }

  // ── 한줄 해석 ──
  const headlines: string[] = [];
  if (curr.sales > 0 && yoy.sales > 0) {
    const rg = ((curr.sales - yoy.sales) / Math.abs(yoy.sales)) * 100;
    headlines.push(`Sales YoY: ${fmtPct(rg)} (당월 ${fmtNum(curr.sales)} vs 전년동월 ${fmtNum(yoy.sales)})`);
  }
  if (curr.op !== 0 && yoy.op !== 0) {
    const og = ((curr.op - yoy.op) / Math.abs(yoy.op)) * 100;
    headlines.push(`Operating Income YoY: ${fmtPct(og)}`);
  }
  if (curr.opMargin !== null) {
    headlines.push(`Operating Margin: ${fmtPctAbs(curr.opMargin)} (직전월 ${fmtPctAbs(prev.opMargin)} · 전년동월 ${fmtPctAbs(yoy.opMargin)})`);
  }
  if (curr.sgaSalesPct !== null) {
    headlines.push(`SG&A / Sales: ${fmtPctAbs(curr.sgaSalesPct)} (전년동월 ${fmtPctAbs(yoy.sgaSalesPct)})`);
  }

  // ── 렌더링 ──

  const renderGrowthTable = () => `
    <table class="kpi">
      <thead><tr><th>지표</th><th class="num">당월</th><th class="num">QoQ (vs 직전월)</th><th class="num">YoY (vs 전년동월)</th><th class="num">YTD (vs 전년 YTD)</th></tr></thead>
      <tbody>
        ${growthRows
          .map(
            (r) => `<tr>
              <td>${escapeHtml(r.label)}</td>
              <td class="num">${r.curr}</td>
              <td class="num ${classFromPctString(r.qoq)}">${r.qoq}</td>
              <td class="num ${classFromPctString(r.yoy)}">${r.yoy}</td>
              <td class="num ${classFromPctString(r.ytd)}">${r.ytd}</td>
            </tr>`,
          )
          .join('\n')}
      </tbody>
    </table>
  `;

  const renderMarginTable = () => `
    <table class="kpi">
      <thead>
        <tr>
          <th>지표</th>
          <th class="num">당월</th>
          <th class="num">QoQ Δ (pp)</th>
          <th class="num">전년동월</th>
          <th class="num">YoY Δ (pp)</th>
          <th class="num">YTD</th>
        </tr>
      </thead>
      <tbody>
        ${marginRows
          .map(
            (r) => `<tr>
              <td>${escapeHtml(r.label)}</td>
              <td class="num">${r.curr}</td>
              <td class="num ${ppClass(r.qoqPP)}">${r.qoqPP === null ? '-' : `${r.qoqPP >= 0 ? '+' : ''}${r.qoqPP.toFixed(1)}pp`}</td>
              <td class="num">${r.yoy}</td>
              <td class="num ${ppClass(r.yoyPP)}">${r.yoyPP === null ? '-' : `${r.yoyPP >= 0 ? '+' : ''}${r.yoyPP.toFixed(1)}pp`}</td>
              <td class="num">${r.ytd}</td>
            </tr>`,
          )
          .join('\n')}
      </tbody>
    </table>
  `;

  const renderCostTable = () => `
    <table class="kpi">
      <thead><tr><th>지표</th><th class="num">당월</th><th class="num">전년동월</th><th class="num">Δ (pp)</th></tr></thead>
      <tbody>
        ${costRows
          .map((r) => {
            const delta = r.curr !== null && r.yoy !== null ? r.curr - r.yoy : null;
            // 비용비율은 증가 = 나쁨 → 색상 반대로 적용
            const cls = delta === null
              ? ''
              : delta > 0
                ? 'neg'
                : delta < 0
                  ? 'pos'
                  : '';
            return `<tr>
              <td>${escapeHtml(r.label)}</td>
              <td class="num">${fmtPctAbs(r.curr)}</td>
              <td class="num">${fmtPctAbs(r.yoy)}</td>
              <td class="num ${cls}">${delta === null ? '-' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pp`}</td>
            </tr>`;
          })
          .join('\n')}
      </tbody>
    </table>
  `;

  const renderSgaTable = () => {
    if (sgaRows.length === 0) {
      return '<p class="muted">SG&A 데이터가 없습니다.</p>';
    }
    return `
    <table class="kpi">
      <thead><tr><th>코드</th><th>계정과목</th><th class="num">당월</th><th class="num">전년동월</th><th class="num">증감</th><th class="num">증감 %</th></tr></thead>
      <tbody>
        ${sgaRows
          .map(
            (r) => `<tr>
              <td class="code">${escapeHtml(r.code)}</td>
              <td>${escapeHtml(r.label)}</td>
              <td class="num">${fmtNum(r.curr)}</td>
              <td class="num muted">${fmtNum(r.prev)}</td>
              <td class="num ${r.diff > 0 ? 'neg' : r.diff < 0 ? 'pos' : ''}">${r.diff !== 0 ? `${r.diff > 0 ? '+' : ''}${fmtNum(r.diff)}` : '-'}</td>
              <td class="num ${(r.diffPct ?? 0) > 0 ? 'neg' : (r.diffPct ?? 0) < 0 ? 'pos' : ''}">${r.diffPct === null ? '-' : `${r.diffPct > 0 ? '+' : ''}${r.diffPct.toFixed(1)}%`}</td>
            </tr>`,
          )
          .join('\n')}
        <tr class="total">
          <td colspan="2">Total</td>
          <td class="num">${fmtNum(sgaRows.reduce((s, r) => s + r.curr, 0))}</td>
          <td class="num muted">${fmtNum(sgaRows.reduce((s, r) => s + r.prev, 0))}</td>
          <td class="num">${(() => {
            const d = sgaRows.reduce((s, r) => s + r.diff, 0);
            return d !== 0 ? `${d > 0 ? '+' : ''}${fmtNum(d)}` : '-';
          })()}</td>
          <td class="num">${(() => {
            const c = sgaRows.reduce((s, r) => s + r.curr, 0);
            const p = sgaRows.reduce((s, r) => s + r.prev, 0);
            const ch = pctChange(c, p);
            return ch === null ? '-' : `${ch > 0 ? '+' : ''}${ch.toFixed(1)}%`;
          })()}</td>
        </tr>
      </tbody>
    </table>
    <p class="hint">* SG&A 비용비율이 늘면 빨강(악화), 줄면 초록(개선) 으로 표시.</p>
    `;
  };

  const renderRisks = () => `
    <ul class="risks">
      ${risks
        .map((r) => `<li class="risk-${r.level}">${escapeHtml(r.text)}</li>`)
        .join('\n')}
    </ul>
  `;

  const renderHeadlines = () => `
    <ul class="headlines">
      ${headlines.map((h) => `<li>${escapeHtml(h)}</li>`).join('\n')}
    </ul>
  `;

  const subjectTitle = `${entityLabel} Financial Analytics (${year}.${String(month).padStart(2, '0')})`;

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
    --pos: #059669;
    --neg: #DC2626;
    --warn: #D97706;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    color: var(--text);
    background: var(--bg);
    margin: 0;
    padding: 24px 28px;
    font-size: 13px;
    line-height: 1.55;
  }
  header { border-bottom: 2px solid var(--primary); padding-bottom: 12px; margin-bottom: 16px; }
  header h1 { margin: 0 0 4px 0; font-size: 20px; color: var(--primary); }
  header .meta { color: var(--muted); font-size: 12px; }
  h2.section { font-size: 14px; color: var(--primary); margin: 24px 0 8px; border-left: 3px solid var(--primary); padding-left: 8px; }
  table.kpi { width: 100%; border-collapse: collapse; margin-top: 4px; }
  table.kpi th, table.kpi td { padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: middle; }
  table.kpi th { background: #f9fafb; font-weight: 600; font-size: 12px; color: var(--muted); }
  table.kpi td.num, table.kpi th.num { text-align: right; font-variant-numeric: tabular-nums; font-family: "SF Mono", Consolas, monospace; }
  table.kpi td.code { color: var(--muted); font-size: 11px; font-family: monospace; }
  table.kpi tr.total td { font-weight: 700; background: #f3f4f6; }
  table.kpi td.pos { color: var(--pos); }
  table.kpi td.neg { color: var(--neg); }
  table.kpi td.muted { color: var(--muted); }
  .headlines { padding-left: 18px; margin: 8px 0 0; }
  .headlines li { padding: 3px 0; }
  .risks { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 6px; }
  .risks li { padding: 8px 12px; border-radius: 6px; border-left: 4px solid var(--muted); background: #f9fafb; }
  .risks li.risk-red { border-left-color: var(--neg); background: #fef2f2; }
  .risks li.risk-yellow { border-left-color: var(--warn); background: #fffbeb; }
  .risks li.risk-green { border-left-color: var(--pos); background: #f0fdf4; }
  p.muted { color: var(--muted); font-size: 12px; }
  p.hint { color: var(--muted); font-size: 11px; margin-top: 6px; }
  footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid var(--border); color: var(--muted); font-size: 11px; }
  @media print { .risks li { break-inside: avoid; } table { break-inside: auto; } }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(subjectTitle)}</h1>
  <div class="meta">기준일: ${year}.${String(month).padStart(2, '0')} · 단위: K=천 / M=백만 / B=십억 · 생성: ${new Date().toISOString().slice(0, 10)}</div>
</header>

<h2 class="section">📌 한줄 해석</h2>
${renderHeadlines()}

<h2 class="section">📈 성장성 (Growth)</h2>
${renderGrowthTable()}

<h2 class="section">💰 수익성 (Profitability)</h2>
${renderMarginTable()}

<h2 class="section">📊 비용 구조 (Cost Structure)</h2>
${renderCostTable()}

<h2 class="section">🧾 SG&A 계정과목별 (당월 vs 전년동월)</h2>
${renderSgaTable()}

<h2 class="section">⚠️ 위험 신호 (Risk Signals)</h2>
${renderRisks()}

<footer>
  InBody Accounting Portal · Generated from Financial Dashboard · Entity: ${escapeHtml(entityLabel)}<br>
  비용비율(COGS/SG&A 등) 컬러 규칙: 증가는 <span style="color:var(--neg)">빨강</span>(악화), 감소는 <span style="color:var(--pos)">초록</span>(개선).
</footer>
</body>
</html>`;
}

// 색상 분류 헬퍼 — 성장률 문자열에서 부호 추정
function classFromPctString(s: string): string {
  if (s === '-' || s === '') return '';
  if (s.startsWith('+')) return 'pos';
  if (s.startsWith('-')) return 'neg';
  return '';
}

function ppClass(pp: number | null): string {
  if (pp === null) return '';
  if (pp > 0) return 'pos';
  if (pp < 0) return 'neg';
  return '';
}

/** 다운로드 트리거 — financialStatementsHtmlExport 의 downloadHtml 과 동일 동작 */
export function downloadAnalyticsHtml(filename: string, html: string): void {
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
