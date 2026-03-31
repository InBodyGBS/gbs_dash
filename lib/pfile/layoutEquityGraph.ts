import type {
  AssociateEdgeDraw,
  AssociateLaneItem,
  GraphLayoutResult,
  LayoutNode,
  PFileEntityRow,
  PFileOwnershipRow,
} from './types';

const NODE_W = 140;
const NODE_H = 52;
const LEVEL_GAP = 110;
const SIBLING_GAP = 14;
export const TOP_Y = 56;
const LANE_GAP_FROM_TREE = 72;
const LANE_ITEM_GAP = 16;

function sortChildrenIds(
  childIds: string[],
  byParent: Map<string, PFileOwnershipRow[]>,
  parentId: string,
  entities: Map<string, PFileEntityRow>,
): string[] {
  const edges = byParent.get(parentId) || [];
  const edgeByTo = new Map(edges.map((e) => [e.to_entity_id, e]));
  return [...childIds].sort((a, b) => {
    const ea = edgeByTo.get(a);
    const eb = edgeByTo.get(b);
    const pa = ea?.share_pct ?? -1;
    const pb = eb?.share_pct ?? -1;
    if (pb !== pa) return pb - pa;
    const na = entities.get(a)?.name ?? '';
    const nb = entities.get(b)?.name ?? '';
    return na.localeCompare(nb, 'ko');
  });
}

/**
 * HQ에서 control 엣지로만 도달 가능한 트리 구성. (associate는 제외)
 */
export function buildTreeFromControl(
  hqId: string,
  entities: Map<string, PFileEntityRow>,
  ownership: PFileOwnershipRow[],
): LayoutNode | null {
  const controlByFrom = new Map<string, PFileOwnershipRow[]>();
  for (const o of ownership) {
    if (o.relation_kind !== 'control') continue;
    if (!controlByFrom.has(o.from_entity_id)) controlByFrom.set(o.from_entity_id, []);
    controlByFrom.get(o.from_entity_id)!.push(o);
  }

  const visited = new Set<string>();

  function buildNode(entityId: string, parentId: string | null, depth: number): LayoutNode | null {
    const ent = entities.get(entityId);
    if (!ent) return null;
    if (visited.has(entityId)) return null;
    visited.add(entityId);

    let controlSharePct: number | null = null;
    if (parentId) {
      const pEdges = controlByFrom.get(parentId)?.filter((e) => e.to_entity_id === entityId) ?? [];
      controlSharePct = pEdges[0]?.share_pct ?? null;
    }

    const rawChildIds = (controlByFrom.get(entityId) || []).map((e) => e.to_entity_id);
    const childIds = sortChildrenIds(rawChildIds, controlByFrom, entityId, entities).filter((id) => {
      const c = entities.get(id);
      return c && c.entity_type !== 'associate';
    });

    const children: LayoutNode[] = [];
    for (const cid of childIds) {
      const n = buildNode(cid, entityId, depth + 1);
      if (n) children.push(n);
    }

    return {
      entity: ent,
      x: 0,
      y: 0,
      depth,
      parentId,
      controlSharePct,
      children,
    };
  }

  return buildNode(hqId, null, 0);
}

function assignPositions(n: LayoutNode, left: number, depth: number): number {
  n.y = TOP_Y + depth * LEVEL_GAP;
  if (!n.children.length) {
    n.x = left + (NODE_W + SIBLING_GAP) / 2;
    return left + NODE_W + SIBLING_GAP;
  }
  let cur = left;
  for (const c of n.children) {
    cur = assignPositions(c, cur, depth + 1);
  }
  const first = n.children[0]!;
  const last = n.children[n.children.length - 1]!;
  n.x = (first.x + last.x) / 2;
  return cur;
}

function flattenTree(n: LayoutNode, acc: LayoutNode[]): void {
  acc.push(n);
  n.children.forEach((c) => flattenTree(c, acc));
}

export function computeGraphLayout(
  entities: PFileEntityRow[],
  ownership: PFileOwnershipRow[],
): GraphLayoutResult {
  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const hqList = entities.filter((e) => e.entity_type === 'hq');
  const hq = hqList[0];

  if (!hq) {
    return {
      treeRoot: null,
      treeNodesFlat: [],
      laneItems: [],
      associateEdges: [],
      contentBounds: { minX: 0, maxX: 400, minY: 0, maxY: 200 },
    };
  }

  const treeRoot = buildTreeFromControl(hq.id, entityMap, ownership);
  if (treeRoot) {
    assignPositions(treeRoot, 40, 0);
  }

  const treeNodesFlat: LayoutNode[] = [];
  if (treeRoot) flattenTree(treeRoot, treeNodesFlat);

  let maxTreeX = 200;
  let maxTreeY = TOP_Y + NODE_H;
  for (const tn of treeNodesFlat) {
    maxTreeX = Math.max(maxTreeX, tn.x + NODE_W / 2 + 24);
    maxTreeY = Math.max(maxTreeY, tn.y + NODE_H / 2 + 24);
  }
  if (!treeRoot) {
    maxTreeX = 120;
  }

  const laneCenterX = maxTreeX + LANE_GAP_FROM_TREE + NODE_W / 2;

  const associates = entities
    .filter((e) => e.entity_type === 'associate')
    .sort((a, b) => {
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.name.localeCompare(b.name, 'ko');
    });

  const laneItems: AssociateLaneItem[] = associates.map((ent, i) => ({
    entity: ent,
    x: laneCenterX,
    y: TOP_Y + i * (NODE_H + LANE_ITEM_GAP),
  }));

  if (laneItems.length) {
    const laneBottom = laneItems[laneItems.length - 1]!.y + NODE_H / 2 + 24;
    maxTreeY = Math.max(maxTreeY, laneBottom);
  }

  const associateEdges: AssociateEdgeDraw[] = [];
  for (const o of ownership) {
    if (o.relation_kind !== 'associate') continue;
    const fromOk = entityMap.has(o.from_entity_id) && entityMap.has(o.to_entity_id);
    if (!fromOk) continue;
    associateEdges.push({
      fromId: o.from_entity_id,
      toId: o.to_entity_id,
      sharePct: o.share_pct,
      note: o.note,
    });
  }

  const maxX = Math.max(maxTreeX, laneCenterX + NODE_W / 2 + 48);
  const maxY = maxTreeY;

  return {
    treeRoot,
    treeNodesFlat,
    laneItems,
    associateEdges,
    contentBounds: { minX: 0, maxX, minY: 0, maxY },
  };
}

export const EQUITY_NODE_DIM = { w: NODE_W, h: NODE_H };
