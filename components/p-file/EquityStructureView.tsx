'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeGraphLayout, EQUITY_NODE_DIM, TOP_Y } from '@/lib/pfile/layoutEquityGraph';
import type { LayoutNode, PFileEntityRow, PFileOwnershipRow } from '@/lib/pfile/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const COLORS = {
  hq: { fill: '#fdf2f4', stroke: '#971B2F', link: '#d1d5db', label: '#971B2F' },
  subsidiary: { fill: '#eff6ff', stroke: '#2563eb', link: '#d1d5db', label: '#2563eb' },
  associate: { fill: '#fffbeb', stroke: '#d97706', link: '#d97706', label: '#d97706' },
} as const;

const { w: NODE_W, h: NODE_H } = EQUITY_NODE_DIM;

function entityLabel(type: PFileEntityRow['entity_type']): string {
  switch (type) {
    case 'hq':
      return 'HQ';
    case 'subsidiary':
      return '자회사';
    case 'associate':
      return '관계기업';
    default:
      return type;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

interface TooltipState {
  x: number;
  y: number;
  title: string;
  lines: { k: string; v: string }[];
}

function buildVisibleIds(
  query: string,
  layout: ReturnType<typeof computeGraphLayout>,
  entityById: Map<string, PFileEntityRow>,
): Set<string> | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const matched = new Set<string>();
  for (const e of entityById.values()) {
    const blob =
      `${e.name} ${e.subsidiary_code ?? ''} ${e.id} ${e.country ?? ''} ${e.industry ?? ''} ${e.currency ?? ''}`.toLowerCase();
    if (blob.includes(q)) matched.add(e.id);
  }

  const parentById = new Map<string, string | null>();
  for (const n of layout.treeNodesFlat) {
    parentById.set(n.entity.id, n.parentId);
  }

  const visible = new Set<string>(matched);
  for (const id of matched) {
    let cur: string | null | undefined = id;
    while (cur) {
      visible.add(cur);
      cur = parentById.get(cur) ?? null;
    }
  }

  for (const edge of layout.associateEdges) {
    const fromVis = visible.has(edge.fromId);
    const toVis = visible.has(edge.toId);
    if (fromVis) visible.add(edge.toId);
    if (toVis) visible.add(edge.fromId);
  }

  const hq = [...entityById.values()].find((e) => e.entity_type === 'hq');
  if (hq && [...visible].some((id) => layout.treeNodesFlat.some((n) => n.entity.id === id))) {
    visible.add(hq.id);
  }

  return visible;
}

interface EquityStructureViewProps {
  entities: PFileEntityRow[];
  ownership: PFileOwnershipRow[];
}

export function EquityStructureView({ entities, ownership }: EquityStructureViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [search, setSearch] = useState('');
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  const layout = useMemo(
    () => computeGraphLayout(entities, ownership),
    [entities, ownership],
  );

  const visibleIds = useMemo(
    () => buildVisibleIds(search, layout, entityById),
    [search, layout, entityById],
  );

  const dim = visibleIds !== null;

  const fitView = useCallback(() => {
    const el = svgRef.current;
    if (!el) return;
    const { clientWidth: W, clientHeight: H } = el;
    const { minX, maxX, minY, maxY } = layout.contentBounds;
    const bw = Math.max(maxX - minX, 400);
    const bh = Math.max(maxY - minY, 200);
    const s = Math.min((W - 80) / bw, (H - 80) / bh, 1);
    setScale(s);
    setTx((W - bw * s) / 2 - minX * s);
    setTy((H - bh * s) / 2 - minY * s);
  }, [layout.contentBounds]);

  useEffect(() => {
    fitView();
  }, [fitView]);

  useEffect(() => {
    const onResize = () => fitView();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitView]);

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const next = Math.max(0.25, Math.min(2.5, scale * factor));
    const r = next / scale;
    setTx(mx - (mx - tx) * r);
    setTy(my - (my - ty) * r);
    setScale(next);
  };

  const showNodeTooltip = (e: React.MouseEvent, n: LayoutNode | { entity: PFileEntityRow }) => {
    const ent = n.entity;
    const lines: { k: string; v: string }[] = [
      { k: '유형', v: entityLabel(ent.entity_type) },
    ];
    if (ent.subsidiary_code) lines.push({ k: '법인 코드', v: ent.subsidiary_code });
    lines.push(
      { k: '설립일', v: formatDate(ent.incorporation_date) },
      { k: '국가', v: ent.country || '—' },
      { k: '업종', v: ent.industry || '—' },
      { k: '통화', v: ent.currency || '—' },
    );
    if ('controlSharePct' in n && n.controlSharePct != null) {
      lines.push({ k: '지분율(상위)', v: `${n.controlSharePct}%` });
    }
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      title: ent.name,
      lines,
    });
  };

  const showAssociateTooltip = (e: React.MouseEvent, ent: PFileEntityRow) => {
    const edges = layout.associateEdges.filter((x) => x.toId === ent.id);
    const lines: { k: string; v: string }[] = [
      { k: '유형', v: entityLabel(ent.entity_type) },
    ];
    if (ent.subsidiary_code) lines.push({ k: '법인 코드', v: ent.subsidiary_code });
    lines.push(
      { k: '설립일', v: formatDate(ent.incorporation_date) },
      { k: '국가', v: ent.country || '—' },
      { k: '업종', v: ent.industry || '—' },
      { k: '통화', v: ent.currency || '—' },
    );
    if (edges.length) {
      const parts = edges
        .map((edg) => {
          const from = entityById.get(edg.fromId)?.name ?? edg.fromId;
          const pct = edg.sharePct != null ? `${edg.sharePct}%` : '—';
          return `${from} → ${pct}`;
        })
        .join(', ');
      lines.push({ k: '관계(지분)', v: parts });
    }
    setTooltip({ x: e.clientX, y: e.clientY, title: ent.name, lines });
  };

  const treeNodeById = useMemo(
    () => new Map(layout.treeNodesFlat.map((n) => [n.entity.id, n])),
    [layout.treeNodesFlat],
  );

  function nodeOpacity(id: string): number {
    if (!dim || !visibleIds) return 1;
    return visibleIds.has(id) ? 1 : 0.12;
  }

  function drawTreeLinks(n: LayoutNode): React.ReactNode {
    return (
      <>
        {n.children.map((ch) => {
          const x1 = n.x;
          const y1 = n.y + NODE_H / 2;
          const x2 = ch.x;
          const y2 = ch.y - NODE_H / 2;
          const midY = (y1 + y2) / 2;
          const d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
          const op = Math.min(nodeOpacity(n.entity.id), nodeOpacity(ch.entity.id));
          const pct = ch.controlSharePct;
          return (
            <g key={`${n.entity.id}-${ch.entity.id}`} style={{ opacity: op }}>
              <path d={d} fill="none" stroke={COLORS.subsidiary.link} strokeWidth={1.2} />
              {pct != null && (
                <text
                  x={x2 + 6}
                  y={(midY + y2) / 2}
                  className="text-[11px] font-semibold fill-blue-600"
                  style={{ pointerEvents: 'none' }}
                >
                  {pct}%
                </text>
              )}
            </g>
          );
        })}
        {n.children.map((ch) => drawTreeLinks(ch))}
      </>
    );
  }

  function drawTreeNodes(n: LayoutNode): React.ReactNode {
    const pal = n.entity.entity_type === 'hq' ? COLORS.hq : COLORS.subsidiary;
    const op = nodeOpacity(n.entity.id);
    return (
      <g key={n.entity.id}>
        <g
          className="node-group"
          style={{ opacity: op, cursor: 'pointer' }}
          transform={`translate(${n.x},${n.y})`}
          onMouseEnter={(ev) => showNodeTooltip(ev, n)}
          onMouseMove={(ev) =>
            setTooltip((t) => (t ? { ...t, x: ev.clientX, y: ev.clientY } : t))
          }
          onMouseLeave={() => setTooltip(null)}
        >
          <rect
            x={-NODE_W / 2}
            y={-NODE_H / 2}
            width={NODE_W}
            height={NODE_H}
            rx={8}
            fill={pal.fill}
            stroke={pal.stroke}
            strokeWidth={1.5}
          />
          <text y={-4} textAnchor="middle" className="text-[13px] font-semibold fill-gray-900 pointer-events-none">
            {n.entity.name.length > 10 ? `${n.entity.name.slice(0, 9)}…` : n.entity.name}
          </text>
          <text y={10} textAnchor="middle" className="text-[10px] fill-gray-400 pointer-events-none">
            {(n.entity.industry || '—').slice(0, 12)}
          </text>
        </g>
        {n.children.map((ch) => drawTreeNodes(ch))}
      </g>
    );
  }

  const laneTitleY = layout.laneItems.length ? layout.laneItems[0]!.y - 36 : TOP_Y;

  return (
    <div className="flex flex-col gap-3 h-full min-h-[560px]">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="회사명·국가·업종 검색…"
          className="max-w-xs h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setSearch('')}>
          검색 초기화
        </Button>
        <div className="flex gap-1 ml-auto">
          <Button type="button" variant="outline" size="sm" onClick={() => fitView()}>
            화면 맞춤
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setScale((s) => Math.min(2.5, s * 1.15))}>
            +
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setScale((s) => Math.max(0.25, s / 1.15))}>
            −
          </Button>
        </div>
      </div>

      <div className="relative flex-1 rounded-lg border border-gray-200 bg-white overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-[min(72vh,720px)] touch-none select-none"
          onWheel={onWheel}
          onMouseDown={(e) => {
            if ((e.target as SVGElement).closest('.node-group, .lane-node')) return;
            setIsPanning(true);
            panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
          }}
          onMouseMove={(e) => {
            if (!isPanning) return;
            setTx(panStart.current.tx + (e.clientX - panStart.current.x));
            setTy(panStart.current.ty + (e.clientY - panStart.current.y));
          }}
          onMouseUp={() => setIsPanning(false)}
          onMouseLeave={() => setIsPanning(false)}
        >
          <g transform={`translate(${tx},${ty}) scale(${scale})`}>
            {layout.treeRoot && drawTreeLinks(layout.treeRoot)}
            {layout.associateEdges.map((edg) => {
              const fromN = treeNodeById.get(edg.fromId);
              const toItem = layout.laneItems.find((l) => l.entity.id === edg.toId);
              if (!fromN || !toItem) return null;
              const x1 = fromN.x;
              const y1 = fromN.y + NODE_H / 2;
              const x2 = toItem.x;
              const y2 = toItem.y - NODE_H / 2;
              const cx = (x1 + x2) / 2;
              const cy = (y1 + y2) / 2;
              const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
              const op = Math.min(nodeOpacity(edg.fromId), nodeOpacity(edg.toId));
              return (
                <g key={`a-${edg.fromId}-${edg.toId}`} style={{ opacity: op }}>
                  <path
                    d={d}
                    fill="none"
                    stroke={COLORS.associate.stroke}
                    strokeWidth={1.2}
                    strokeDasharray="6 4"
                  />
                </g>
              );
            })}
            {layout.laneItems.length > 0 && (
              <text
                x={layout.laneItems[0]!.x}
                y={laneTitleY}
                textAnchor="middle"
                className="text-[12px] font-bold fill-gray-800"
              >
                관계기업
              </text>
            )}
            {layout.treeRoot && drawTreeNodes(layout.treeRoot)}
            {layout.laneItems.map((item) => {
              const pal = COLORS.associate;
              const op = nodeOpacity(item.entity.id);
              return (
                <g
                  key={item.entity.id}
                  className="lane-node"
                  style={{ opacity: op, cursor: 'pointer' }}
                  transform={`translate(${item.x},${item.y})`}
                  onMouseEnter={(ev) => showAssociateTooltip(ev, item.entity)}
                  onMouseMove={(ev) =>
                    setTooltip((t) => (t ? { ...t, x: ev.clientX, y: ev.clientY } : t))
                  }
                  onMouseLeave={() => setTooltip(null)}
                >
                  <rect
                    x={-NODE_W / 2}
                    y={-NODE_H / 2}
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill={pal.fill}
                    stroke={pal.stroke}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  <text y={-4} textAnchor="middle" className="text-[13px] font-semibold fill-gray-900 pointer-events-none">
                    {item.entity.name.length > 10 ? `${item.entity.name.slice(0, 9)}…` : item.entity.name}
                  </text>
                  <text y={10} textAnchor="middle" className="text-[10px] fill-amber-700/80 pointer-events-none">
                    관계기업
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {tooltip && (
          <div
            className={cn(
              'pointer-events-none fixed z-50 rounded-lg border bg-white/98 px-3 py-2 shadow-lg',
              'text-sm max-w-[min(92vw,280px)]',
            )}
            style={{ left: tooltip.x + 14, top: tooltip.y - 8 }}
          >
            <div className="font-bold text-gray-900 mb-1">{tooltip.title}</div>
            {tooltip.lines.map((row, i) => (
              <div key={`${row.k}-${i}`} className="flex justify-between gap-3 text-xs text-gray-500">
                <span>{row.k}</span>
                <span className="font-semibold text-gray-800 text-right">{row.v}</span>
              </div>
            ))}
          </div>
        )}

        <p className="absolute bottom-2 left-3 text-[11px] text-gray-400">
          빈 캔버스에서 드래그: 이동 · 휠: 확대/축소
        </p>
      </div>
    </div>
  );
}
