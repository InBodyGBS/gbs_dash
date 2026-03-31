export type PFileEntityType = 'hq' | 'subsidiary' | 'associate';

export type PFileRelationKind = 'control' | 'associate';

export interface PFileEntityRow {
  id: string;
  name: string;
  entity_type: PFileEntityType;
  /** 기존 법인 마스터(subsidiaries) 연동 — 있으면 표시명·국가·코드는 마스터 우선 */
  subsidiary_id: string | null;
  subsidiary_code: string | null;
  incorporation_date: string | null;
  country: string | null;
  industry: string | null;
  currency: string | null;
  display_order: number;
}

export interface PFileOwnershipRow {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_kind: PFileRelationKind;
  share_pct: number | null;
  note: string | null;
}

export interface LayoutNode {
  entity: PFileEntityRow;
  x: number;
  y: number;
  depth: number;
  parentId: string | null;
  /** 직접 부모(control) → 이 노드 지분율 */
  controlSharePct: number | null;
  children: LayoutNode[];
}

export interface AssociateLaneItem {
  entity: PFileEntityRow;
  x: number;
  y: number;
}

export interface AssociateEdgeDraw {
  fromId: string;
  toId: string;
  sharePct: number | null;
  note: string | null;
}

export interface GraphLayoutResult {
  treeRoot: LayoutNode | null;
  treeNodesFlat: LayoutNode[];
  laneItems: AssociateLaneItem[];
  associateEdges: AssociateEdgeDraw[];
  contentBounds: { minX: number; maxX: number; minY: number; maxY: number };
}
