/**
 * Domain types for the Ispahani WMS prototype.
 *
 * Naming deliberately tracks Odoo Inventory so the client sees the same words
 * they will see in Odoo 19: location, quant, package (pallet), lot, picking
 * (operation), move, move line, removal strategy, storage category.
 *
 * Location model = the agreed "shallow + coordinates" shape:
 *   Warehouse -> Zone -> Aisle -> Rack are records;
 *   a Cell is a single Location row carrying bay/level coordinates.
 * The UI still exposes the full SRS hierarchy
 * Warehouse -> Aisle -> Rack -> Column -> Row -> Cell -> Pallet.
 */

export type MaterialGroup = "RM" | "FG" | "PM";

export type Uom = "kg" | "units" | "cartons" | "rolls";

/** Odoo stock.location.usage */
export type LocationUsage =
  | "internal"
  | "view"
  | "supplier"
  | "customer"
  | "transit"
  | "inventory";

/** Functional role of a location inside the site. */
export type LocationKind =
  | "cell" // an individual pallet position in a rack
  | "input" // goods-in / receiving buffer
  | "output" // dispatch staging
  | "staging" // floor staging
  | "quality" // quality hold
  | "transit"
  | "supplier"
  | "customer"
  | "scrap"
  | "view";

export type CellBlockReason =
  | "structural"
  | "damaged_beam"
  | "fire_access"
  | "maintenance"
  | "sprinkler_clearance";

export interface Site {
  id: string;
  name: string;
  drawingRef: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  siteId: string;
  /** Primary material group stored here; "unconfirmed" areas are flagged. */
  materialGroups: MaterialGroup[];
  materialGroupConfirmed: boolean;
  drawingRef: string;
  /** Free-text provenance shown in the UI so nothing looks like hard fact. */
  sourceNote: string;
  /** Positions declared by the MinMax storage-capacity table. */
  declaredPositions: number;
  footprint: { width: number; depth: number; unit: "ft" };
}

export interface Zone {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  materialGroup: MaterialGroup;
  materialGroupConfirmed: boolean;
}

export interface Aisle {
  id: string;
  warehouseId: string;
  zoneId: string;
  code: string;
  name: string;
  sequence: number;
}

/** Rack profiles come from the MinMax drawings (R1, R2, 4R4, 6R6 ...). */
export interface RackProfile {
  code: string;
  /** Bay clear width in mm, as drawn. */
  bayWidthMm: number;
  depthMm: number;
  heightMm: number;
  /** Load per level in kg, from the drawing annotations. */
  loadPerLevelKg: number;
  palletsPerBayLevel: number;
  drawingRef: string;
}

export interface Rack {
  id: string;
  /** Unique physical rack identifier, e.g. RTW2-A1-R07. */
  code: string;
  name: string;
  warehouseId: string;
  zoneId: string;
  aisleId: string;
  profileCode: string;
  bays: number;
  levels: number;
  /** Pallet positions per bay+level for this rack (>=1, e.g. 2 for double-deep). */
  positionsPerBayLevel: number;
  positions: number;
  /** Schematic floor-plan geometry, in plan units (see map/geometry.ts). */
  x: number;
  y: number;
  width: number;
  depth: number;
  orientation: "h" | "v";
  side: "A" | "B";
}

export interface StorageCategory {
  id: string;
  name: string;
  maxWeightKg: number;
  allowNewProduct: "empty" | "same" | "mixed";
  /** Material groups this category accepts. */
  accepts: MaterialGroup[];
  palletCapacity: number;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  /** Odoo-style dotted path, e.g. RTW2/A1/R07/B04/L3. */
  completeName: string;
  kind: LocationKind;
  usage: LocationUsage;
  warehouseId?: string;
  zoneId?: string;
  aisleId?: string;
  rackId?: string;
  /** Column / bay — horizontal position along the rack. */
  bay?: number;
  /** Row / level — vertical position; 0 is the ground position. */
  level?: number;
  /** Position within the bay+level when positionsPerBayLevel > 1. */
  slot?: number;
  /** True when this location is an installed pallet position that counts
   *  toward warehouse capacity. Input/output/staging are false. */
  isPosition: boolean;
  palletCapacity: number;
  maxWeightKg: number;
  storageCategoryId?: string;
  blocked: boolean;
  blockReason?: CellBlockReason;
  blockNote?: string;
  /** Elevation coordinates within the rack drawing (px in the rack SVG). */
  ex?: number;
  ey?: number;
}

export interface PackageType {
  id: string;
  name: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  maxWeightKg: number;
  drawingRef: string;
}

export type PalletState = "stored" | "in_transit" | "staged" | "free";

export interface Pallet {
  id: string;
  /** Unique physical pallet licence plate, e.g. PAL-0001842. */
  name: string;
  packageTypeId: string;
  locationId: string | null;
  state: PalletState;
  createdAt: string;
  /** Set when the pallet was built during receiving. */
  originOperationId?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  materialGroup: MaterialGroup;
  /** Default removal strategy, Odoo-style, inherited by products. */
  removalStrategy: RemovalStrategy;
}

export type RemovalStrategy = "fifo" | "lifo" | "closest" | "least_packages";

export interface Product {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  materialGroup: MaterialGroup;
  uom: Uom;
  /** Explicit full-pallet quantity for this product — the denominator for
   *  fill %. Never the structural rack load. */
  palletCapacityQty: number;
  /** Net weight of one uom unit, kg. Used for weight capacity checks. */
  unitWeightKg: number;
  tracking: "lot" | "none";
  removalStrategy?: RemovalStrategy;
  /** Blend grade marker used by manual blend-based selection. */
  blendGrade?: string;
}

export interface Variant {
  id: string;
  productId: string;
  code: string;
  name: string;
  attributes: Record<string, string>;
  /** Overrides the product capacity when the variant packs differently. */
  palletCapacityQty?: number;
}

export interface Lot {
  id: string;
  name: string;
  productId: string;
  variantId: string;
  /** Original receipt date — never rewritten by relocation. */
  receiptDate: string;
  supplierRef?: string;
  origin?: string;
  gardenMark?: string;
}

/** stock.quant — how much of product X sits in location Y, on pallet Z. */
export interface Quant {
  id: string;
  productId: string;
  variantId: string;
  lotId: string | null;
  palletId: string | null;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  uom: Uom;
  /** Date the stock entered the site. Preserved across internal moves. */
  inDate: string;
}

export type OperationKind =
  | "receipt"
  | "putaway"
  | "internal"
  | "pick"
  | "delivery";

export type OperationState =
  | "draft"
  | "waiting"
  | "ready"
  | "done"
  | "cancel";

export interface OperationType {
  id: string;
  code: string;
  name: string;
  kind: OperationKind;
  warehouseId: string;
  sequencePrefix: string;
  defaultSourceId?: string;
  defaultDestId?: string;
}

export interface Operator {
  id: string;
  name: string;
  login: string;
  warehouseIds: string[];
  role: "operator" | "supervisor" | "manager";
}

export interface Partner {
  id: string;
  name: string;
  kind: "supplier" | "customer";
  ref: string;
}

/** stock.picking */
export interface Operation {
  id: string;
  name: string;
  typeId: string;
  kind: OperationKind;
  state: OperationState;
  warehouseId: string;
  sourceLocationId: string;
  destLocationId: string;
  partnerId?: string;
  operatorId?: string;
  sourceDocument?: string;
  scheduledAt: string;
  createdAt: string;
  effectiveAt?: string;
  /** Upstream operation this one waits for (two-step flows). */
  originOperationId?: string;
  backorderOfId?: string;
  note?: string;
  /** Manual blend-based selection was used to choose the lots. */
  manualLotSelection?: boolean;
  blendRef?: string;
}

/** stock.move — product-level demand inside an operation. */
export interface Move {
  id: string;
  operationId: string;
  productId: string;
  variantId: string;
  uom: Uom;
  demandQty: number;
  doneQty: number;
  sourceLocationId: string;
  destLocationId: string;
  state: OperationState;
  sequence: number;
}

/** stock.move.line — the lot/pallet/location detail of a move. */
export interface MoveLine {
  id: string;
  moveId: string;
  operationId: string;
  productId: string;
  variantId: string;
  lotId: string | null;
  uom: Uom;
  quantity: number;
  /** Quantity actually recorded as done. */
  doneQty: number;
  sourceLocationId: string;
  destLocationId: string;
  sourcePalletId: string | null;
  destPalletId: string | null;
  state: OperationState;
  /** Timestamp written on validation; drives movement history. */
  doneAt?: string;
}

/** Explicit reservation record so releasing is exact and auditable. */
export interface Reservation {
  id: string;
  moveLineId: string;
  quantId: string;
  quantity: number;
  createdAt: string;
}

export interface FavoriteRecord {
  id: string;
  name: string;
  /** Route path this favorite belongs to. */
  route: string;
  search: string;
  isDefault: boolean;
  createdAt: string;
}

/** The full deterministic dataset. */
export interface Dataset {
  sites: Site[];
  warehouses: Warehouse[];
  zones: Zone[];
  aisles: Aisle[];
  rackProfiles: RackProfile[];
  racks: Rack[];
  storageCategories: StorageCategory[];
  locations: Location[];
  packageTypes: PackageType[];
  pallets: Pallet[];
  productCategories: ProductCategory[];
  products: Product[];
  variants: Variant[];
  lots: Lot[];
  quants: Quant[];
  operationTypes: OperationType[];
  operators: Operator[];
  partners: Partner[];
  operations: Operation[];
  moves: Move[];
  moveLines: MoveLine[];
  reservations: Reservation[];
}
