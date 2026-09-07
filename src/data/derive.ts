/**
 * Derivation layer.
 *
 * The dataset is normalised; the UI needs flat, filterable rows. Everything the
 * application displays - every KPI, chart segment, map colour, list row, pivot
 * cell and CSV line - is computed here, once, from the same dataset. Widgets
 * never compute their own numbers, which is what keeps a card and the list
 * behind it in agreement.
 */

import { palletCapacityFor } from "./catalog";
import { ageBucketOf, ageInDays, type AgeBucketId } from "./clock";
import type {
  Aisle,
  Dataset,
  Location,
  Lot,
  MaterialGroup,
  Move,
  MoveLine,
  Operation,
  OperationKind,
  OperationState,
  Operator,
  Pallet,
  Partner,
  Product,
  ProductCategory,
  Quant,
  Rack,
  Uom,
  Variant,
  Warehouse,
  Zone,
} from "./types";

export type CellStatus =
  | "occupied"
  | "empty"
  | "blocked"
  | "reserved_incoming";

export type PalletStatus = "full" | "partial" | "empty";

// ------------------------------------------------------------------ index

export interface DataIndex {
  warehouseById: Map<string, Warehouse>;
  zoneById: Map<string, Zone>;
  aisleById: Map<string, Aisle>;
  rackById: Map<string, Rack>;
  locationById: Map<string, Location>;
  palletById: Map<string, Pallet>;
  productById: Map<string, Product>;
  variantById: Map<string, Variant>;
  categoryById: Map<string, ProductCategory>;
  lotById: Map<string, Lot>;
  quantById: Map<string, Quant>;
  operationById: Map<string, Operation>;
  operatorById: Map<string, Operator>;
  partnerById: Map<string, Partner>;

  quantsByLocation: Map<string, Quant[]>;
  quantsByPallet: Map<string, Quant[]>;
  quantsByProduct: Map<string, Quant[]>;
  quantsByLot: Map<string, Quant[]>;
  palletByLocation: Map<string, Pallet>;

  cellsByRack: Map<string, Location[]>;
  cellsByWarehouse: Map<string, Location[]>;
  cellsByAisle: Map<string, Location[]>;
  racksByWarehouse: Map<string, Rack[]>;
  racksByAisle: Map<string, Rack[]>;
  aislesByWarehouse: Map<string, Aisle[]>;

  movesByOperation: Map<string, Move[]>;
  linesByOperation: Map<string, MoveLine[]>;
  linesByPallet: Map<string, MoveLine[]>;
  linesByLot: Map<string, MoveLine[]>;
  linesByLocation: Map<string, MoveLine[]>;

  /** Empty positions already claimed as the destination of a pending move. */
  incomingByLocation: Map<string, string[]>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildIndex(data: Dataset): DataIndex {
  const index: DataIndex = {
    warehouseById: new Map(data.warehouses.map((x) => [x.id, x])),
    zoneById: new Map(data.zones.map((x) => [x.id, x])),
    aisleById: new Map(data.aisles.map((x) => [x.id, x])),
    rackById: new Map(data.racks.map((x) => [x.id, x])),
    locationById: new Map(data.locations.map((x) => [x.id, x])),
    palletById: new Map(data.pallets.map((x) => [x.id, x])),
    productById: new Map(data.products.map((x) => [x.id, x])),
    variantById: new Map(data.variants.map((x) => [x.id, x])),
    categoryById: new Map(data.productCategories.map((x) => [x.id, x])),
    lotById: new Map(data.lots.map((x) => [x.id, x])),
    quantById: new Map(data.quants.map((x) => [x.id, x])),
    operationById: new Map(data.operations.map((x) => [x.id, x])),
    operatorById: new Map(data.operators.map((x) => [x.id, x])),
    partnerById: new Map(data.partners.map((x) => [x.id, x])),

    quantsByLocation: new Map(),
    quantsByPallet: new Map(),
    quantsByProduct: new Map(),
    quantsByLot: new Map(),
    palletByLocation: new Map(),

    cellsByRack: new Map(),
    cellsByWarehouse: new Map(),
    cellsByAisle: new Map(),
    racksByWarehouse: new Map(),
    racksByAisle: new Map(),
    aislesByWarehouse: new Map(),

    movesByOperation: new Map(),
    linesByOperation: new Map(),
    linesByPallet: new Map(),
    linesByLot: new Map(),
    linesByLocation: new Map(),

    incomingByLocation: new Map(),
  };

  for (const q of data.quants) {
    push(index.quantsByLocation, q.locationId, q);
    if (q.palletId) push(index.quantsByPallet, q.palletId, q);
    push(index.quantsByProduct, q.productId, q);
    if (q.lotId) push(index.quantsByLot, q.lotId, q);
  }

  for (const p of data.pallets) {
    if (p.locationId) index.palletByLocation.set(p.locationId, p);
  }

  for (const loc of data.locations) {
    if (loc.kind !== "cell") continue;
    if (loc.rackId) push(index.cellsByRack, loc.rackId, loc);
    if (loc.warehouseId) push(index.cellsByWarehouse, loc.warehouseId, loc);
    if (loc.aisleId) push(index.cellsByAisle, loc.aisleId, loc);
  }

  for (const rack of data.racks) {
    push(index.racksByWarehouse, rack.warehouseId, rack);
    push(index.racksByAisle, rack.aisleId, rack);
  }
  for (const aisle of data.aisles) {
    push(index.aislesByWarehouse, aisle.warehouseId, aisle);
  }

  for (const move of data.moves) push(index.movesByOperation, move.operationId, move);

  for (const line of data.moveLines) {
    push(index.linesByOperation, line.operationId, line);
    if (line.sourcePalletId) push(index.linesByPallet, line.sourcePalletId, line);
    if (line.destPalletId && line.destPalletId !== line.sourcePalletId) {
      push(index.linesByPallet, line.destPalletId, line);
    }
    if (line.lotId) push(index.linesByLot, line.lotId, line);
    push(index.linesByLocation, line.sourceLocationId, line);
    if (line.destLocationId !== line.sourceLocationId) {
      push(index.linesByLocation, line.destLocationId, line);
    }
  }

  // A pending (not done, not cancelled) move that targets an empty rack
  // position claims it: no other putaway may be routed to the same cell.
  for (const move of data.moves) {
    const op = index.operationById.get(move.operationId);
    if (!op || op.state === "done" || op.state === "cancel") continue;
    const dest = index.locationById.get(move.destLocationId);
    if (!dest || dest.kind !== "cell") continue;
    push(index.incomingByLocation, dest.id, op.id);
  }

  return index;
}

// ------------------------------------------------------------------- rows

/**
 * Rows are read generically by the query engine (filter, sort, group, export),
 * which addresses fields by name. The index signature is what lets a typed row
 * be handed to that generic machinery without casting at every call site.
 */
export interface RowBase {
  [key: string]: unknown;
}

export interface CellRow extends RowBase {
  id: string;
  name: string;
  completeName: string;
  warehouseId: string;
  /** Section of the building: Raw Material, or Packed Tea / FG. */
  sectionId: string;
  sectionCode: string;
  sectionName: string;
  sectionStage: string;
  warehouseCode: string;
  warehouseName: string;
  materialGroup: MaterialGroup;
  materialGroupConfirmed: boolean;
  aisleId: string;
  aisleCode: string;
  rackId: string;
  rackCode: string;
  rackProfile: string;
  bay: number;
  level: number;
  slot: number;
  status: CellStatus;
  occupied: boolean;
  blocked: boolean;
  blockReason?: string;
  blockNote?: string;
  reservedIncoming: boolean;
  availableForPutaway: boolean;
  storageCategoryId?: string;
  storageCategoryName?: string;
  maxWeightKg: number;
  palletId?: string;
  palletName?: string;
  palletStatus?: PalletStatus;
  productId?: string;
  productCode?: string;
  productName?: string;
  variantId?: string;
  variantName?: string;
  lotId?: string;
  lotName?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  uom?: Uom;
  capacityQty?: number;
  fillPct?: number;
  weightKg: number;
  inDate?: string;
  ageDays?: number;
  ageBucket?: AgeBucketId;
}

export interface PalletRow extends RowBase {
  id: string;
  name: string;
  packageTypeId: string;
  packageTypeName: string;
  state: Pallet["state"];
  status: PalletStatus;
  locationId?: string;
  locationName?: string;
  completeName?: string;
  warehouseId?: string;
  /** Section of the building: Raw Material, or Packed Tea / FG. */
  sectionId: string;
  sectionCode: string;
  sectionName: string;
  sectionStage: string;
  warehouseCode?: string;
  warehouseName?: string;
  materialGroup?: MaterialGroup;
  aisleId?: string;
  aisleCode?: string;
  rackId?: string;
  rackCode?: string;
  bay?: number;
  level?: number;
  productId?: string;
  productCode?: string;
  productName?: string;
  variantId?: string;
  variantName?: string;
  categoryId?: string;
  lotId?: string;
  lotName?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  uom?: Uom;
  capacityQty?: number;
  fillPct?: number;
  remainingQty?: number;
  weightKg: number;
  lineCount: number;
  inDate?: string;
  ageDays?: number;
  ageBucket?: AgeBucketId;
  createdAt: string;
}

export interface StockRow extends RowBase {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  variantId: string;
  variantName: string;
  categoryId: string;
  categoryName: string;
  materialGroup: MaterialGroup;
  lotId?: string;
  lotName?: string;
  palletId?: string;
  palletName?: string;
  locationId: string;
  locationName: string;
  completeName: string;
  locationKind: Location["kind"];
  warehouseId?: string;
  /** Section of the building: Raw Material, or Packed Tea / FG. */
  sectionId: string;
  sectionCode: string;
  sectionName: string;
  sectionStage: string;
  warehouseCode?: string;
  warehouseName?: string;
  aisleId?: string;
  aisleCode?: string;
  rackId?: string;
  rackCode?: string;
  bay?: number;
  level?: number;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  uom: Uom;
  capacityQty: number;
  fillPct: number;
  weightKg: number;
  inDate: string;
  receiptDate?: string;
  ageDays: number;
  ageBucket: AgeBucketId;
}

export interface OperationRow extends RowBase {
  id: string;
  name: string;
  kind: OperationKind;
  typeId: string;
  typeName: string;
  state: OperationState;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  sourceLocationId: string;
  sourceLocationName: string;
  destLocationId: string;
  destLocationName: string;
  partnerId?: string;
  partnerName?: string;
  operatorId?: string;
  operatorName?: string;
  sourceDocument?: string;
  scheduledAt: string;
  createdAt: string;
  effectiveAt?: string;
  lineCount: number;
  demandQty: number;
  doneQty: number;
  uoms: string;
  productNames: string;
  manualLotSelection: boolean;
  blendRef?: string;
  backorderOfId?: string;
  originOperationId?: string;
  note?: string;
}

export interface MovementRow extends RowBase {
  id: string;
  operationId: string;
  operationName: string;
  kind: OperationKind;
  state: OperationState;
  productId: string;
  productCode: string;
  productName: string;
  variantId: string;
  variantName: string;
  materialGroup: MaterialGroup;
  lotId?: string;
  lotName?: string;
  palletId?: string;
  palletName?: string;
  quantity: number;
  doneQty: number;
  uom: Uom;
  sourceLocationId: string;
  sourceLocationName: string;
  destLocationId: string;
  destLocationName: string;
  warehouseId: string;
  warehouseCode: string;
  operatorId?: string;
  operatorName?: string;
  doneAt?: string;
  movementDate: string;
}

export interface ProductRow extends RowBase {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  categoryName: string;
  materialGroup: MaterialGroup;
  uom: Uom;
  capacityQty: number;
  onHand: number;
  reserved: number;
  available: number;
  lotCount: number;
  palletCount: number;
  locationCount: number;
  warehouseCount: number;
  variantCount: number;
  oldestInDate?: string;
  oldestAgeDays?: number;
  blendGrade?: string;
  removalStrategy: string;
}

export interface LotRow extends RowBase {
  id: string;
  name: string;
  productId: string;
  productCode: string;
  productName: string;
  variantId: string;
  variantName: string;
  categoryId: string;
  materialGroup: MaterialGroup;
  receiptDate: string;
  ageDays: number;
  ageBucket: AgeBucketId;
  onHand: number;
  reserved: number;
  available: number;
  uom: Uom;
  palletCount: number;
  locationCount: number;
  warehouseCodes: string;
  gardenMark?: string;
  origin?: string;
  supplierRef?: string;
  blendGrade?: string;
}

export interface RackRow extends RowBase {
  id: string;
  code: string;
  name: string;
  warehouseId: string;
  /** Section of the building: Raw Material, or Packed Tea / FG. */
  sectionId: string;
  sectionCode: string;
  sectionName: string;
  sectionStage: string;
  warehouseCode: string;
  warehouseName: string;
  materialGroup: MaterialGroup;
  aisleId: string;
  aisleCode: string;
  profileCode: string;
  side: string;
  bays: number;
  levels: number;
  /** Pallet positions per bay per level (2 on the 2300 mm profiles). */
  positionsPerBayLevel: number;
  positions: number;
  occupied: number;
  empty: number;
  blocked: number;
  reservedIncoming: number;
  availableForPutaway: number;
  occupancyPct: number;
  palletCount: number;
  partialPallets: number;
  emptyPallets: number;
}

export interface WarehouseRow extends RowBase {
  id: string;
  code: string;
  name: string;
  siteId: string;
  materialGroup: MaterialGroup;
  materialGroupConfirmed: boolean;
  drawingRef: string;
  sourceNote: string;
  declaredPositions: number;
  positions: number;
  occupied: number;
  empty: number;
  blocked: number;
  reservedIncoming: number;
  availableForPutaway: number;
  occupancyPct: number;
  rackCount: number;
  aisleCount: number;
  palletCount: number;
  partialPallets: number;
  emptyPallets: number;
}

export interface DerivedRows {
  index: DataIndex;
  cells: CellRow[];
  pallets: PalletRow[];
  stock: StockRow[];
  operations: OperationRow[];
  movements: MovementRow[];
  products: ProductRow[];
  lots: LotRow[];
  racks: RackRow[];
  warehouses: WarehouseRow[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Pallet status from its contents. A physically present pallet with no stock
 *  is "empty" - it still occupies its position. */
export function palletStatusOf(
  quantity: number,
  capacity: number | undefined,
): PalletStatus {
  if (quantity <= 0) return "empty";
  if (capacity && quantity >= capacity - 0.0001) return "full";
  return "partial";
}

export function deriveRows(data: Dataset): DerivedRows {
  const index = buildIndex(data);

  // ------------------------------------------------------------ cells
  const cells: CellRow[] = [];
  for (const loc of data.locations) {
    if (loc.kind !== "cell") continue;
    const warehouse = index.warehouseById.get(loc.warehouseId!)!;
    const section = loc.zoneId ? index.zoneById.get(loc.zoneId) : undefined;
    const aisle = index.aisleById.get(loc.aisleId!)!;
    const rack = index.rackById.get(loc.rackId!)!;
    const pallet = index.palletByLocation.get(loc.id);
    const quants = index.quantsByLocation.get(loc.id) ?? [];
    const quant = quants[0];
    const product = quant ? index.productById.get(quant.productId) : undefined;
    const variant = quant ? index.variantById.get(quant.variantId) : undefined;
    const lot = quant?.lotId ? index.lotById.get(quant.lotId) : undefined;
    const capacity =
      product ? palletCapacityFor(product, variant) : undefined;

    const quantity = quants.reduce((s, q) => s + q.quantity, 0);
    const reserved = quants.reduce((s, q) => s + q.reservedQuantity, 0);
    const incoming = index.incomingByLocation.get(loc.id);
    const reservedIncoming = !pallet && !!incoming?.length;

    const status: CellStatus = loc.blocked
      ? "blocked"
      : pallet
        ? "occupied"
        : reservedIncoming
          ? "reserved_incoming"
          : "empty";

    const storageCategory = loc.storageCategoryId
      ? data.storageCategories.find((c) => c.id === loc.storageCategoryId)
      : undefined;

    cells.push({
      id: loc.id,
      name: loc.code,
      completeName: loc.completeName,
      warehouseId: warehouse.id,
      warehouseCode: warehouse.code,
      warehouseName: warehouse.name,
      sectionId: section?.id ?? "",
      sectionCode: section?.code ?? "",
      sectionName: section?.name ?? "",
      sectionStage: section?.stage ?? "",
      materialGroup: section?.materialGroup ?? warehouse.materialGroups[0],
      materialGroupConfirmed:
        section?.materialGroupConfirmed ?? warehouse.materialGroupConfirmed,
      aisleId: aisle.id,
      aisleCode: aisle.code,
      rackId: rack.id,
      rackCode: rack.code,
      rackProfile: rack.profileCode,
      bay: loc.bay ?? 0,
      level: loc.level ?? 0,
      slot: loc.slot ?? 1,
      status,
      occupied: !!pallet,
      blocked: loc.blocked,
      blockReason: loc.blockReason,
      blockNote: loc.blockNote,
      reservedIncoming,
      availableForPutaway: !pallet && !loc.blocked && !reservedIncoming,
      storageCategoryId: loc.storageCategoryId,
      storageCategoryName: storageCategory?.name,
      maxWeightKg: loc.maxWeightKg,
      palletId: pallet?.id,
      palletName: pallet?.name,
      palletStatus: pallet ? palletStatusOf(quantity, capacity) : undefined,
      productId: product?.id,
      productCode: product?.code,
      productName: product?.name,
      variantId: variant?.id,
      variantName: variant?.name,
      lotId: lot?.id,
      lotName: lot?.name,
      quantity: round2(quantity),
      reservedQuantity: round2(reserved),
      availableQuantity: round2(quantity - reserved),
      uom: product?.uom,
      capacityQty: capacity,
      fillPct: capacity ? round2((quantity / capacity) * 100) : undefined,
      weightKg: product ? round2(quantity * product.unitWeightKg) : 0,
      inDate: quant?.inDate,
      ageDays: quant ? ageInDays(quant.inDate) : undefined,
      ageBucket: quant ? ageBucketOf(quant.inDate) : undefined,
    });
  }

  // ----------------------------------------------------------- pallets
  const pallets: PalletRow[] = [];
  for (const pallet of data.pallets) {
    const quants = index.quantsByPallet.get(pallet.id) ?? [];
    const quant = quants[0];
    const product = quant ? index.productById.get(quant.productId) : undefined;
    const variant = quant ? index.variantById.get(quant.variantId) : undefined;
    const lot = quant?.lotId ? index.lotById.get(quant.lotId) : undefined;
    const capacity = product ? palletCapacityFor(product, variant) : undefined;
    const quantity = quants.reduce((s, q) => s + q.quantity, 0);
    const reserved = quants.reduce((s, q) => s + q.reservedQuantity, 0);

    const loc = pallet.locationId
      ? index.locationById.get(pallet.locationId)
      : undefined;
    const warehouse = loc?.warehouseId
      ? index.warehouseById.get(loc.warehouseId)
      : undefined;
    const section = loc?.zoneId ? index.zoneById.get(loc.zoneId) : undefined;
    const aisle = loc?.aisleId ? index.aisleById.get(loc.aisleId) : undefined;
    const rack = loc?.rackId ? index.rackById.get(loc.rackId) : undefined;
    const packageType = data.packageTypes.find(
      (p) => p.id === pallet.packageTypeId,
    )!;

    pallets.push({
      id: pallet.id,
      name: pallet.name,
      packageTypeId: pallet.packageTypeId,
      packageTypeName: packageType.name,
      state: pallet.state,
      status: palletStatusOf(quantity, capacity),
      locationId: loc?.id,
      locationName: loc?.name,
      completeName: loc?.completeName,
      warehouseId: warehouse?.id,
      warehouseCode: warehouse?.code,
      warehouseName: warehouse?.name,
      sectionId: section?.id ?? "",
      sectionCode: section?.code ?? "",
      sectionName: section?.name ?? "",
      sectionStage: section?.stage ?? "",
      materialGroup: section?.materialGroup ?? warehouse?.materialGroups[0],
      aisleId: aisle?.id,
      aisleCode: aisle?.code,
      rackId: rack?.id,
      rackCode: rack?.code,
      bay: loc?.bay,
      level: loc?.level,
      productId: product?.id,
      productCode: product?.code,
      productName: product?.name,
      variantId: variant?.id,
      variantName: variant?.name,
      categoryId: product?.categoryId,
      lotId: lot?.id,
      lotName: lot?.name,
      quantity: round2(quantity),
      reservedQuantity: round2(reserved),
      availableQuantity: round2(quantity - reserved),
      uom: product?.uom,
      capacityQty: capacity,
      fillPct: capacity ? round2((quantity / capacity) * 100) : undefined,
      remainingQty: capacity ? round2(Math.max(0, capacity - quantity)) : undefined,
      weightKg: product ? round2(quantity * product.unitWeightKg) : 0,
      lineCount: quants.length,
      inDate: quant?.inDate,
      ageDays: quant ? ageInDays(quant.inDate) : undefined,
      ageBucket: quant ? ageBucketOf(quant.inDate) : undefined,
      createdAt: pallet.createdAt,
    });
  }

  // ------------------------------------------------------------- stock
  const stock: StockRow[] = [];
  for (const quant of data.quants) {
    const product = index.productById.get(quant.productId)!;
    const variant = index.variantById.get(quant.variantId)!;
    const category = index.categoryById.get(product.categoryId)!;
    const lot = quant.lotId ? index.lotById.get(quant.lotId) : undefined;
    const pallet = quant.palletId ? index.palletById.get(quant.palletId) : undefined;
    const loc = index.locationById.get(quant.locationId)!;
    const warehouse = loc.warehouseId
      ? index.warehouseById.get(loc.warehouseId)
      : undefined;
    const aisle = loc.aisleId ? index.aisleById.get(loc.aisleId) : undefined;
    const section = loc.zoneId ? index.zoneById.get(loc.zoneId) : undefined;
    const rack = loc.rackId ? index.rackById.get(loc.rackId) : undefined;
    const capacity = palletCapacityFor(product, variant);

    stock.push({
      id: quant.id,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      variantId: variant.id,
      variantName: variant.name,
      categoryId: category.id,
      categoryName: category.name,
      materialGroup: product.materialGroup,
      lotId: lot?.id,
      lotName: lot?.name,
      palletId: pallet?.id,
      palletName: pallet?.name,
      locationId: loc.id,
      locationName: loc.name,
      completeName: loc.completeName,
      locationKind: loc.kind,
      warehouseId: warehouse?.id,
      warehouseCode: warehouse?.code,
      warehouseName: warehouse?.name,
      sectionId: section?.id ?? "",
      sectionCode: section?.code ?? "",
      sectionName: section?.name ?? "",
      sectionStage: section?.stage ?? "",
      aisleId: aisle?.id,
      aisleCode: aisle?.code,
      rackId: rack?.id,
      rackCode: rack?.code,
      bay: loc.bay,
      level: loc.level,
      quantity: round2(quant.quantity),
      reservedQuantity: round2(quant.reservedQuantity),
      availableQuantity: round2(quant.quantity - quant.reservedQuantity),
      uom: quant.uom,
      capacityQty: capacity,
      fillPct: round2((quant.quantity / capacity) * 100),
      weightKg: round2(quant.quantity * product.unitWeightKg),
      inDate: quant.inDate,
      receiptDate: lot?.receiptDate,
      ageDays: ageInDays(quant.inDate),
      ageBucket: ageBucketOf(quant.inDate),
    });
  }

  // -------------------------------------------------------- operations
  const operations: OperationRow[] = [];
  for (const op of data.operations) {
    const type = data.operationTypes.find((t) => t.id === op.typeId)!;
    const warehouse = index.warehouseById.get(op.warehouseId)!;
    const moves = index.movesByOperation.get(op.id) ?? [];
    const source = index.locationById.get(op.sourceLocationId);
    const dest = index.locationById.get(op.destLocationId);
    const partner = op.partnerId ? index.partnerById.get(op.partnerId) : undefined;
    const operator = op.operatorId
      ? index.operatorById.get(op.operatorId)
      : undefined;

    const uoms = Array.from(new Set(moves.map((m) => m.uom)));
    const productNames = Array.from(
      new Set(
        moves.map((m) => index.productById.get(m.productId)?.name ?? m.productId),
      ),
    );

    operations.push({
      id: op.id,
      name: op.name,
      kind: op.kind,
      typeId: type.id,
      typeName: type.name,
      state: op.state,
      warehouseId: warehouse.id,
      warehouseCode: warehouse.code,
      warehouseName: warehouse.name,
      sourceLocationId: op.sourceLocationId,
      sourceLocationName: source?.completeName ?? op.sourceLocationId,
      destLocationId: op.destLocationId,
      destLocationName: dest?.completeName ?? op.destLocationId,
      partnerId: partner?.id,
      partnerName: partner?.name,
      operatorId: operator?.id,
      operatorName: operator?.name,
      sourceDocument: op.sourceDocument,
      scheduledAt: op.scheduledAt,
      createdAt: op.createdAt,
      effectiveAt: op.effectiveAt,
      lineCount: moves.length,
      demandQty: round2(moves.reduce((s, m) => s + m.demandQty, 0)),
      doneQty: round2(moves.reduce((s, m) => s + m.doneQty, 0)),
      uoms: uoms.join(", "),
      productNames: productNames.join(", "),
      manualLotSelection: !!op.manualLotSelection,
      blendRef: op.blendRef,
      backorderOfId: op.backorderOfId,
      originOperationId: op.originOperationId,
      note: op.note,
    });
  }

  // --------------------------------------------------------- movements
  const movements: MovementRow[] = [];
  for (const line of data.moveLines) {
    const op = index.operationById.get(line.operationId)!;
    const product = index.productById.get(line.productId)!;
    const variant = index.variantById.get(line.variantId)!;
    const lot = line.lotId ? index.lotById.get(line.lotId) : undefined;
    const palletId = line.destPalletId ?? line.sourcePalletId ?? undefined;
    const pallet = palletId ? index.palletById.get(palletId) : undefined;
    const source = index.locationById.get(line.sourceLocationId);
    const dest = index.locationById.get(line.destLocationId);
    const warehouse = index.warehouseById.get(op.warehouseId)!;
    const operator = op.operatorId
      ? index.operatorById.get(op.operatorId)
      : undefined;

    movements.push({
      id: line.id,
      operationId: op.id,
      operationName: op.name,
      kind: op.kind,
      state: line.state,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      variantId: variant.id,
      variantName: variant.name,
      materialGroup: product.materialGroup,
      lotId: lot?.id,
      lotName: lot?.name,
      palletId: pallet?.id,
      palletName: pallet?.name,
      quantity: round2(line.quantity),
      doneQty: round2(line.doneQty),
      uom: line.uom,
      sourceLocationId: line.sourceLocationId,
      sourceLocationName: source?.completeName ?? line.sourceLocationId,
      destLocationId: line.destLocationId,
      destLocationName: dest?.completeName ?? line.destLocationId,
      warehouseId: warehouse.id,
      warehouseCode: warehouse.code,
      operatorId: operator?.id,
      operatorName: operator?.name,
      doneAt: line.doneAt,
      movementDate: line.doneAt ?? op.scheduledAt,
    });
  }

  // ---------------------------------------------------------- products
  const products: ProductRow[] = [];
  for (const product of data.products) {
    const quants = index.quantsByProduct.get(product.id) ?? [];
    const category = index.categoryById.get(product.categoryId)!;
    const onHand = quants.reduce((s, q) => s + q.quantity, 0);
    const reserved = quants.reduce((s, q) => s + q.reservedQuantity, 0);
    const lotIds = new Set(quants.map((q) => q.lotId).filter(Boolean));
    const palletIds = new Set(quants.map((q) => q.palletId).filter(Boolean));
    const locationIds = new Set(quants.map((q) => q.locationId));
    const warehouseIds = new Set(
      Array.from(locationIds)
        .map((id) => index.locationById.get(id)?.warehouseId)
        .filter(Boolean),
    );
    const oldest = quants.reduce<string | undefined>(
      (min, q) => (!min || q.inDate < min ? q.inDate : min),
      undefined,
    );

    products.push({
      id: product.id,
      code: product.code,
      name: product.name,
      categoryId: category.id,
      categoryName: category.name,
      materialGroup: product.materialGroup,
      uom: product.uom,
      capacityQty: product.palletCapacityQty,
      onHand: round2(onHand),
      reserved: round2(reserved),
      available: round2(onHand - reserved),
      lotCount: lotIds.size,
      palletCount: palletIds.size,
      locationCount: locationIds.size,
      warehouseCount: warehouseIds.size,
      variantCount: data.variants.filter((v) => v.productId === product.id).length,
      oldestInDate: oldest,
      oldestAgeDays: oldest ? ageInDays(oldest) : undefined,
      blendGrade: product.blendGrade,
      removalStrategy: product.removalStrategy ?? category.removalStrategy,
    });
  }

  // -------------------------------------------------------------- lots
  const lots: LotRow[] = [];
  for (const lot of data.lots) {
    const quants = index.quantsByLot.get(lot.id) ?? [];
    const product = index.productById.get(lot.productId)!;
    const variant = index.variantById.get(lot.variantId)!;
    const onHand = quants.reduce((s, q) => s + q.quantity, 0);
    const reserved = quants.reduce((s, q) => s + q.reservedQuantity, 0);
    const palletIds = new Set(quants.map((q) => q.palletId).filter(Boolean));
    const locationIds = new Set(quants.map((q) => q.locationId));
    const warehouseCodes = Array.from(
      new Set(
        Array.from(locationIds)
          .map((id) => index.locationById.get(id)?.warehouseId)
          .filter((id): id is string => !!id)
          .map((id) => index.warehouseById.get(id)?.code ?? id),
      ),
    ).sort();

    lots.push({
      id: lot.id,
      name: lot.name,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      variantId: variant.id,
      variantName: variant.name,
      categoryId: product.categoryId,
      materialGroup: product.materialGroup,
      receiptDate: lot.receiptDate,
      ageDays: ageInDays(lot.receiptDate),
      ageBucket: ageBucketOf(lot.receiptDate),
      onHand: round2(onHand),
      reserved: round2(reserved),
      available: round2(onHand - reserved),
      uom: product.uom,
      palletCount: palletIds.size,
      locationCount: locationIds.size,
      warehouseCodes: warehouseCodes.join(", "),
      gardenMark: lot.gardenMark,
      origin: lot.origin,
      supplierRef: lot.supplierRef,
      blendGrade: product.blendGrade,
    });
  }

  // ------------------------------------------------------------- racks
  const cellByRack = new Map<string, CellRow[]>();
  for (const cell of cells) push(cellByRack, cell.rackId, cell);

  const racks: RackRow[] = [];
  for (const rack of data.racks) {
    const rackCells = cellByRack.get(rack.id) ?? [];
    const warehouse = index.warehouseById.get(rack.warehouseId)!;
    const section = index.zoneById.get(rack.zoneId);
    const aisle = index.aisleById.get(rack.aisleId)!;
    const occupied = rackCells.filter((c) => c.occupied).length;
    const blocked = rackCells.filter((c) => c.blocked).length;
    const reservedIncoming = rackCells.filter((c) => c.reservedIncoming).length;
    const available = rackCells.filter((c) => c.availableForPutaway).length;

    racks.push({
      id: rack.id,
      code: rack.code,
      name: rack.name,
      warehouseId: warehouse.id,
      warehouseCode: warehouse.code,
      warehouseName: warehouse.name,
      sectionId: section?.id ?? "",
      sectionCode: section?.code ?? "",
      sectionName: section?.name ?? "",
      sectionStage: section?.stage ?? "",
      materialGroup: section?.materialGroup ?? warehouse.materialGroups[0],
      aisleId: aisle.id,
      aisleCode: aisle.code,
      profileCode: rack.profileCode,
      side: rack.side,
      bays: rack.bays,
      levels: rack.levels,
      positionsPerBayLevel: rack.positionsPerBayLevel,
      positions: rackCells.length,
      occupied,
      empty: rackCells.length - occupied - blocked,
      blocked,
      reservedIncoming,
      availableForPutaway: available,
      occupancyPct: rackCells.length
        ? round2((occupied / rackCells.length) * 100)
        : 0,
      palletCount: occupied,
      partialPallets: rackCells.filter((c) => c.palletStatus === "partial").length,
      emptyPallets: rackCells.filter((c) => c.palletStatus === "empty").length,
    });
  }

  // -------------------------------------------------------- warehouses
  const cellByWarehouse = new Map<string, CellRow[]>();
  for (const cell of cells) push(cellByWarehouse, cell.warehouseId, cell);

  const warehouses: WarehouseRow[] = [];
  for (const wh of data.warehouses) {
    const whCells = cellByWarehouse.get(wh.id) ?? [];
    const occupied = whCells.filter((c) => c.occupied).length;
    const blocked = whCells.filter((c) => c.blocked).length;

    warehouses.push({
      id: wh.id,
      code: wh.code,
      name: wh.name,
      siteId: wh.siteId,
      materialGroup: wh.materialGroups[0],
      materialGroupConfirmed: wh.materialGroupConfirmed,
      drawingRef: wh.drawingRef,
      sourceNote: wh.sourceNote,
      declaredPositions: wh.declaredPositions,
      positions: whCells.length,
      occupied,
      empty: whCells.length - occupied - blocked,
      blocked,
      reservedIncoming: whCells.filter((c) => c.reservedIncoming).length,
      availableForPutaway: whCells.filter((c) => c.availableForPutaway).length,
      occupancyPct: whCells.length ? round2((occupied / whCells.length) * 100) : 0,
      rackCount: (index.racksByWarehouse.get(wh.id) ?? []).length,
      aisleCount: (index.aislesByWarehouse.get(wh.id) ?? []).length,
      palletCount: occupied,
      partialPallets: whCells.filter((c) => c.palletStatus === "partial").length,
      emptyPallets: whCells.filter((c) => c.palletStatus === "empty").length,
    });
  }

  return {
    index,
    cells,
    pallets,
    stock,
    operations,
    movements,
    products,
    lots,
    racks,
    warehouses,
  };
}
