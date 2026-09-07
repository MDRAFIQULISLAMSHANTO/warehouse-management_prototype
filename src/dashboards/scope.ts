/**
 * Dashboard filter applicability.
 *
 * A dashboard charts several different record types at once - cells, pallets,
 * stock lines, movements - and not every filter means something for every one
 * of them. This module is the applicability map, made executable.
 *
 * The rules that matter:
 *
 *  - Physical filters (warehouse, aisle, rack, bay, level, material group)
 *    apply to everything.
 *  - Product, variant, lot and pallet filters apply to stock, pallets and
 *    movements. They deliberately do NOT narrow installed capacity: filtering
 *    to one product must not make the warehouse look like it has fewer
 *    positions than it has. On the maps they highlight instead.
 *  - Movement period filters apply to movement charts only. They must not
 *    remove older inventory from current stock balances.
 *  - Occupancy-status filters apply to positions only; pallet-status filters
 *    apply to pallets and, expressed differently, to the positions holding
 *    them.
 *
 * A filter that cannot be expressed for a target is dropped for that target and
 * reported, so a panel whose scope differs can say so on screen instead of
 * quietly showing something else.
 */

import type { DomainNode } from "@/query/domain";
import { and } from "@/query/domain";
import type { Facet, SearchState } from "@/query/search";

export type Target = "stock" | "cell" | "pallet" | "movement";

/** Where a semantic filter can be expressed, and under which field name. */
type Mapping = Partial<Record<Target, string | null>>;

const ALL_PHYSICAL = (name: string): Mapping => ({
  stock: name,
  cell: name,
  pallet: name,
  movement: name,
});

/**
 * Semantic keys and the field each target uses to express them.
 * `null` (or a missing target) means "not applicable to that target".
 */
const SEMANTICS: Record<string, Mapping> = {
  warehouse: ALL_PHYSICAL("warehouseId"),
  warehouseCode: ALL_PHYSICAL("warehouseCode"),
  aisle: { stock: "aisleId", cell: "aisleId", pallet: "aisleId" },
  aisleCode: { stock: "aisleCode", cell: "aisleCode", pallet: "aisleCode" },
  rack: { stock: "rackId", cell: "rackId", pallet: "rackId" },
  rackCode: { stock: "rackCode", cell: "rackCode", pallet: "rackCode" },
  bay: { stock: "bay", cell: "bay", pallet: "bay" },
  level: { stock: "level", cell: "level", pallet: "level" },
  rackProfile: { cell: "rackProfile" },
  storageCategory: { cell: "storageCategoryName" },
  materialGroup: ALL_PHYSICAL("materialGroup"),

  product: { stock: "productId", cell: "productId", pallet: "productId", movement: "productId" },
  productName: {
    stock: "productName",
    cell: "productName",
    pallet: "productName",
    movement: "productName",
  },
  variant: { stock: "variantId", pallet: "variantId", movement: "variantId" },
  variantName: { stock: "variantName", pallet: "variantName", movement: "variantName" },
  category: { stock: "categoryId", pallet: "categoryId" },
  categoryName: { stock: "categoryName" },
  lot: { stock: "lotId", cell: "lotId", pallet: "lotId", movement: "lotId" },
  lotName: { stock: "lotName", cell: "lotName", pallet: "lotName", movement: "lotName" },
  pallet: { stock: "palletId", cell: "palletId", pallet: "id", movement: "palletId" },
  palletName: { stock: "palletName", cell: "palletName", pallet: "name", movement: "palletName" },
  uom: { stock: "uom", cell: "uom", pallet: "uom", movement: "uom" },
  blendGrade: { stock: "blendGrade", pallet: "blendGrade" },

  palletStatus: { cell: "palletStatus", pallet: "status" },
  palletState: { pallet: "state" },
  cellStatus: { cell: "status" },
  occupied: { cell: "occupied" },
  blocked: { cell: "blocked" },
  reservedIncoming: { cell: "reservedIncoming" },
  availableForPutaway: { cell: "availableForPutaway" },

  quantity: { stock: "quantity", cell: "quantity", pallet: "quantity" },
  reservedQuantity: {
    stock: "reservedQuantity",
    cell: "reservedQuantity",
    pallet: "reservedQuantity",
  },
  availableQuantity: {
    stock: "availableQuantity",
    cell: "availableQuantity",
    pallet: "availableQuantity",
  },
  fillPct: { stock: "fillPct", cell: "fillPct", pallet: "fillPct" },
  capacityQty: { stock: "capacityQty", cell: "capacityQty", pallet: "capacityQty" },
  remainingQty: { pallet: "remainingQty" },
  ageDays: { stock: "ageDays", cell: "ageDays", pallet: "ageDays" },
  ageBucket: { stock: "ageBucket", cell: "ageBucket", pallet: "ageBucket" },
  inDate: { stock: "inDate", cell: "inDate", pallet: "inDate" },
  receiptDate: { stock: "receiptDate" },

  movementDate: { movement: "movementDate" },
  doneAt: { movement: "doneAt" },
  scheduledAt: {},
  operationKind: { movement: "kind" },
  operationState: { movement: "state" },
  operator: { movement: "operatorId" },
  operatorName: { movement: "operatorName" },
  locationId: { stock: "locationId", cell: "id", pallet: "locationId" },
};

/** Which semantic key a field name on a given source model represents. */
const FIELD_TO_SEMANTIC: Record<string, Record<string, string>> = {
  cell: {
    id: "locationId",
    warehouseId: "warehouse",
    warehouseCode: "warehouseCode",
    aisleId: "aisle",
    aisleCode: "aisleCode",
    rackId: "rack",
    rackCode: "rackCode",
    rackProfile: "rackProfile",
    storageCategoryName: "storageCategory",
    materialGroup: "materialGroup",
    bay: "bay",
    level: "level",
    status: "cellStatus",
    occupied: "occupied",
    blocked: "blocked",
    reservedIncoming: "reservedIncoming",
    availableForPutaway: "availableForPutaway",
    palletStatus: "palletStatus",
    palletId: "pallet",
    palletName: "palletName",
    productId: "product",
    productName: "productName",
    variantId: "variant",
    lotId: "lot",
    lotName: "lotName",
    quantity: "quantity",
    reservedQuantity: "reservedQuantity",
    availableQuantity: "availableQuantity",
    fillPct: "fillPct",
    capacityQty: "capacityQty",
    uom: "uom",
    inDate: "inDate",
    ageDays: "ageDays",
    ageBucket: "ageBucket",
  },
  pallet: {
    id: "pallet",
    name: "palletName",
    status: "palletStatus",
    state: "palletState",
    locationId: "locationId",
    warehouseId: "warehouse",
    warehouseCode: "warehouseCode",
    aisleId: "aisle",
    aisleCode: "aisleCode",
    rackId: "rack",
    rackCode: "rackCode",
    materialGroup: "materialGroup",
    bay: "bay",
    level: "level",
    productId: "product",
    productName: "productName",
    variantId: "variant",
    variantName: "variantName",
    categoryId: "category",
    lotId: "lot",
    lotName: "lotName",
    quantity: "quantity",
    reservedQuantity: "reservedQuantity",
    availableQuantity: "availableQuantity",
    capacityQty: "capacityQty",
    remainingQty: "remainingQty",
    fillPct: "fillPct",
    uom: "uom",
    inDate: "inDate",
    ageDays: "ageDays",
    ageBucket: "ageBucket",
    blendGrade: "blendGrade",
  },
  stock: {
    locationId: "locationId",
    warehouseId: "warehouse",
    warehouseCode: "warehouseCode",
    aisleId: "aisle",
    aisleCode: "aisleCode",
    rackId: "rack",
    rackCode: "rackCode",
    materialGroup: "materialGroup",
    bay: "bay",
    level: "level",
    productId: "product",
    productName: "productName",
    productCode: "productName",
    variantId: "variant",
    variantName: "variantName",
    categoryId: "category",
    categoryName: "categoryName",
    lotId: "lot",
    lotName: "lotName",
    palletId: "pallet",
    palletName: "palletName",
    quantity: "quantity",
    reservedQuantity: "reservedQuantity",
    availableQuantity: "availableQuantity",
    capacityQty: "capacityQty",
    fillPct: "fillPct",
    uom: "uom",
    inDate: "inDate",
    receiptDate: "receiptDate",
    ageDays: "ageDays",
    ageBucket: "ageBucket",
  },
  lot: {
    id: "lot",
    name: "lotName",
    productId: "product",
    productName: "productName",
    variantId: "variant",
    materialGroup: "materialGroup",
    receiptDate: "receiptDate",
    ageDays: "ageDays",
    ageBucket: "ageBucket",
    onHand: "quantity",
    reserved: "reservedQuantity",
    available: "availableQuantity",
    uom: "uom",
    blendGrade: "blendGrade",
  },
  movement: {
    operationName: "operationName",
    kind: "operationKind",
    state: "operationState",
    movementDate: "movementDate",
    doneAt: "doneAt",
    productId: "product",
    productName: "productName",
    variantName: "variantName",
    materialGroup: "materialGroup",
    lotId: "lot",
    lotName: "lotName",
    palletId: "pallet",
    palletName: "palletName",
    quantity: "quantity",
    uom: "uom",
    warehouseId: "warehouse",
    warehouseCode: "warehouseCode",
    operatorId: "operator",
    operatorName: "operatorName",
  },
};

/** Semantic keys that describe stock content rather than physical structure. */
const CONTENT_SEMANTICS = new Set([
  "product",
  "productName",
  "variant",
  "variantName",
  "category",
  "categoryName",
  "lot",
  "lotName",
  "pallet",
  "palletName",
  "blendGrade",
  "uom",
  "quantity",
  "reservedQuantity",
  "availableQuantity",
  "fillPct",
  "capacityQty",
  "ageDays",
  "ageBucket",
  "inDate",
  "receiptDate",
]);

interface Translation {
  node: DomainNode | null;
  dropped: string[];
}

function translateNode(
  node: DomainNode,
  sourceModel: string,
  target: Target,
  dropped: Set<string>,
  excludeContent: boolean,
): DomainNode | null {
  if (node.kind === "group") {
    const children = node.children
      .map((child) =>
        translateNode(child, sourceModel, target, dropped, excludeContent),
      )
      .filter((child): child is DomainNode => !!child);
    // An OR group loses meaning if any branch was dropped: keeping the rest
    // would widen the result instead of narrowing it.
    if (node.op === "or" && children.length !== node.children.length) return null;
    return children.length ? { ...node, children } : null;
  }

  const semantic = FIELD_TO_SEMANTIC[sourceModel]?.[node.field];
  if (!semantic) {
    dropped.add(node.field);
    return null;
  }
  if (excludeContent && CONTENT_SEMANTICS.has(semantic)) {
    dropped.add(node.field);
    return null;
  }
  const mapped = SEMANTICS[semantic]?.[target];
  if (!mapped) {
    dropped.add(node.field);
    return null;
  }
  return { ...node, field: mapped };
}

export function translateDomain(
  node: DomainNode,
  sourceModel: string,
  target: Target,
  options?: { excludeContent?: boolean },
): Translation {
  const dropped = new Set<string>();
  const translated = translateNode(
    node,
    sourceModel,
    target,
    dropped,
    !!options?.excludeContent,
  );
  return { node: translated, dropped: Array.from(dropped) };
}

export interface DashboardScope {
  /** Filters expressed for stock lines. */
  stock: DomainNode;
  /** Physical scope only - safe to use as an occupancy denominator. */
  cell: DomainNode;
  /** Physical scope plus content filters - for highlighting on maps. */
  cellHighlight: DomainNode;
  pallet: DomainNode;
  movement: DomainNode;
  /** Fields that could not be expressed, per target. */
  dropped: Record<Target | "cellHighlight", string[]>;
}

/**
 * Translate the dashboard's search state into one domain per target dataset.
 * `base` is the page's own scope and is applied to every target.
 */
export function buildScope(
  state: SearchState,
  sourceModel: string,
  base?: Partial<Record<Target, DomainNode>>,
): DashboardScope {
  const facetNodes = state.facets.map((f: Facet) => f.domain);

  const collect = (target: Target, excludeContent = false) => {
    const parts: DomainNode[] = [];
    const dropped: string[] = [];
    for (const node of facetNodes) {
      const result = translateDomain(node, sourceModel, target, { excludeContent });
      if (result.node) parts.push(result.node);
      else dropped.push(...result.dropped);
    }
    return { domain: and(base?.[target] ?? null, ...parts), dropped };
  };

  const stock = collect("stock");
  const cell = collect("cell", true);
  const cellHighlight = collect("cell", false);
  const pallet = collect("pallet");
  const movement = collect("movement");

  return {
    stock: stock.domain,
    cell: cell.domain,
    cellHighlight: cellHighlight.domain,
    pallet: pallet.domain,
    movement: movement.domain,
    dropped: {
      stock: stock.dropped,
      cell: cell.dropped,
      cellHighlight: cellHighlight.dropped,
      pallet: pallet.dropped,
      movement: movement.dropped,
    },
  };
}

/** Human-readable note explaining why a panel's scope differs. */
export const SCOPE_NOTES = {
  capacity:
    "Installed capacity is physical. Product, lot and pallet filters highlight matching positions but never change the number of installed positions.",
  movementPeriod:
    "Date filters apply to movement charts. Current stock balances always show today's position, so older inventory is never hidden from them.",
  units:
    "Quantities are summed only within one unit of measure. Mixed scopes report each unit separately.",
} as const;
