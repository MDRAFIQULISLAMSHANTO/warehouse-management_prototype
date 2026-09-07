/**
 * Model registry.
 *
 * Each record type declares its fields once: label, type, whether it can be
 * searched, filtered, grouped or aggregated, and how it is formatted. The
 * search bar, Filters menu, Group By menu, custom filter builder, list columns,
 * pivot, graph and CSV export are all generated from this, so a field behaves
 * the same everywhere it appears.
 *
 * Predefined filters carry a `group`. Filters inside one group OR together;
 * separate groups AND together - the same logic Odoo uses.
 */

import type { DerivedRows } from "@/data/derive";
import type { AggregateDef } from "./group";
import { and, cond, or, type DomainNode, type FieldType } from "./domain";

export type OptionsKey =
  | "warehouse"
  | "aisle"
  | "rack"
  | "cell"
  | "product"
  | "variant"
  | "lot"
  | "pallet"
  | "category"
  | "operator"
  | "partner"
  | "operationType"
  | "storageCategory"
  | "packageType";

export type FieldFormat =
  | "text"
  | "int"
  | "qty"
  | "pct"
  | "weight"
  | "date"
  | "datetime"
  | "state"
  | "badge"
  | "link";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  /** Ancestor chain for location-hierarchy filtering. */
  hierarchyFields?: string[];
  groupable?: boolean;
  sortable?: boolean;
  searchable?: boolean;
  filterable?: boolean;
  optionsKey?: OptionsKey;
  options?: { value: string; label: string }[];
  agg?: AggregateDef;
  align?: "left" | "right" | "center";
  width?: number;
  format?: FieldFormat;
  unitField?: string;
  /** Hidden from the list by default; offered in the optional-columns menu. */
  optional?: boolean;
  help?: string;
}

export interface FilterDef {
  id: string;
  label: string;
  /** Filters sharing a group OR together. */
  group: string;
  domain: DomainNode;
  help?: string;
}

export interface ModelDef {
  name: string;
  label: string;
  labelPlural: string;
  /** Route of the list view for this model. */
  route: string;
  rows: (derived: DerivedRows) => Record<string, unknown>[];
  fields: FieldDef[];
  defaultColumns: string[];
  defaultOrder: { field: string; dir: "asc" | "desc" }[];
  searchFields: string[];
  filters: FilterDef[];
  groupBys: string[];
  /** Detail route for one record, or null when the model has no form view. */
  recordRoute?: (id: string) => string;
  displayField: string;
  /** Views offered in the view switcher. */
  views: ("list" | "graph" | "pivot")[];
}

const STATE_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "waiting", label: "Waiting" },
  { value: "ready", label: "Ready" },
  { value: "done", label: "Done" },
  { value: "cancel", label: "Cancelled" },
];

const KIND_OPTIONS = [
  { value: "receipt", label: "Receipt" },
  { value: "putaway", label: "Put-Away" },
  { value: "internal", label: "Internal Transfer" },
  { value: "pick", label: "Pick" },
  { value: "delivery", label: "Delivery" },
];

const MATERIAL_GROUP_OPTIONS = [
  { value: "RM", label: "Raw Material (RM)" },
  { value: "FG", label: "Finished Goods (FG)" },
  { value: "PM", label: "Packing Material (PM)" },
];

const CELL_STATUS_OPTIONS = [
  { value: "occupied", label: "Occupied" },
  { value: "empty", label: "Physically empty" },
  { value: "blocked", label: "Blocked" },
  { value: "reserved_incoming", label: "Reserved for incoming" },
];

const PALLET_STATUS_OPTIONS = [
  { value: "full", label: "Full" },
  { value: "partial", label: "Partially filled" },
  { value: "empty", label: "Empty pallet" },
];

const AGE_BUCKET_OPTIONS = [
  { value: "0-30", label: "0-30 days" },
  { value: "31-60", label: "31-60 days" },
  { value: "61-90", label: "61-90 days" },
  { value: "91-180", label: "91-180 days" },
  { value: "181+", label: "181+ days" },
];

const LOCATION_HIERARCHY = ["warehouseId", "aisleId", "rackId", "id"];
const STOCK_HIERARCHY = ["warehouseId", "aisleId", "rackId", "locationId"];

const QTY_AGG: AggregateDef = { kind: "sum", unitField: "uom", decimals: 2 };
const INT_AGG: AggregateDef = { kind: "sum", decimals: 0 };

// --------------------------------------------------------------- cells

const cellFields: FieldDef[] = [
  { name: "name", label: "Cell", type: "text", searchable: true, sortable: true, filterable: true, format: "link", width: 130 },
  { name: "completeName", label: "Full Address", type: "text", searchable: true, sortable: true, filterable: true, width: 250 },
  { name: "warehouseId", label: "Warehouse", type: "relation", optionsKey: "warehouse", groupable: true, filterable: true, searchable: true },
  { name: "warehouseCode", label: "WH", type: "text", sortable: true, groupable: true, width: 70 },
  { name: "materialGroup", label: "Material Group", type: "selection", options: MATERIAL_GROUP_OPTIONS, groupable: true, filterable: true, sortable: true, width: 110 },
  { name: "aisleId", label: "Aisle", type: "relation", optionsKey: "aisle", groupable: true, filterable: true },
  { name: "aisleCode", label: "Aisle", type: "text", sortable: true, groupable: true, width: 70 },
  { name: "rackId", label: "Rack", type: "relation", optionsKey: "rack", groupable: true, filterable: true },
  { name: "rackCode", label: "Rack", type: "text", sortable: true, groupable: true, searchable: true, format: "link", width: 150 },
  { name: "rackProfile", label: "Rack Profile", type: "text", groupable: true, filterable: true, sortable: true, optional: true, width: 100 },
  { name: "bay", label: "Column / Bay", type: "number", sortable: true, groupable: true, filterable: true, align: "right", format: "int", width: 100 },
  { name: "level", label: "Row / Level", type: "number", sortable: true, groupable: true, filterable: true, align: "right", format: "int", width: 95 },
  { name: "slot", label: "Position", type: "number", sortable: true, filterable: true, align: "right", format: "int", optional: true, width: 80 },
  { name: "status", label: "Occupancy Status", type: "selection", options: CELL_STATUS_OPTIONS, groupable: true, filterable: true, sortable: true, format: "badge", width: 150 },
  { name: "occupied", label: "Occupied", type: "boolean", filterable: true, groupable: true },
  { name: "blocked", label: "Blocked", type: "boolean", filterable: true, groupable: true },
  { name: "blockReason", label: "Block Reason", type: "text", filterable: true, groupable: true, optional: true, width: 150 },
  { name: "reservedIncoming", label: "Reserved for Incoming", type: "boolean", filterable: true, groupable: true },
  { name: "availableForPutaway", label: "Available for Put-Away", type: "boolean", filterable: true, groupable: true },
  { name: "palletName", label: "Pallet", type: "text", searchable: true, sortable: true, filterable: true, format: "link", width: 130 },
  { name: "palletId", label: "Pallet Record", type: "relation", optionsKey: "pallet", filterable: true },
  { name: "palletStatus", label: "Pallet Status", type: "selection", options: PALLET_STATUS_OPTIONS, groupable: true, filterable: true, sortable: true, format: "badge", width: 130 },
  { name: "productId", label: "Product", type: "relation", optionsKey: "product", groupable: true, filterable: true },
  { name: "productName", label: "Product", type: "text", searchable: true, sortable: true, groupable: true, format: "link", width: 230 },
  { name: "variantId", label: "Variant", type: "relation", optionsKey: "variant", groupable: true, filterable: true },
  { name: "lotId", label: "Lot", type: "relation", optionsKey: "lot", groupable: true, filterable: true },
  { name: "lotName", label: "Lot / Serial", type: "text", searchable: true, sortable: true, format: "link", width: 150 },
  { name: "quantity", label: "Quantity", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 110 },
  { name: "reservedQuantity", label: "Reserved", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, optional: true, width: 100 },
  { name: "availableQuantity", label: "Available", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, optional: true, width: 100 },
  { name: "uom", label: "Unit", type: "selection", groupable: true, filterable: true, options: [{ value: "kg", label: "kg" }, { value: "cartons", label: "cartons" }, { value: "units", label: "units" }, { value: "rolls", label: "rolls" }], width: 80 },
  { name: "capacityQty", label: "Pallet Capacity", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", optional: true, width: 120, help: "Explicit full-pallet quantity for this product or variant. Not the 800 kg structural rating of the position." },
  { name: "fillPct", label: "Fill %", type: "number", sortable: true, filterable: true, align: "right", format: "pct", agg: { kind: "ratio", numerator: "quantity", denominator: "capacityQty", decimals: 1 }, width: 90 },
  { name: "weightKg", label: "Weight (kg)", type: "number", sortable: true, filterable: true, align: "right", format: "weight", agg: INT_AGG, optional: true, width: 110 },
  { name: "maxWeightKg", label: "Position Rating (kg)", type: "number", sortable: true, filterable: true, align: "right", format: "weight", optional: true, width: 140 },
  { name: "storageCategoryName", label: "Storage Category", type: "text", groupable: true, filterable: true, optional: true, width: 170 },
  { name: "inDate", label: "Stock In Date", type: "date", sortable: true, filterable: true, groupable: true, format: "date", optional: true, width: 120 },
  { name: "ageDays", label: "Age (days)", type: "number", sortable: true, filterable: true, align: "right", format: "int", optional: true, width: 100 },
  { name: "ageBucket", label: "Stock Age", type: "selection", options: AGE_BUCKET_OPTIONS, groupable: true, filterable: true, optional: true, width: 110 },
  { name: "id", label: "Cell Record", type: "location", hierarchyFields: LOCATION_HIERARCHY, filterable: true, optionsKey: "cell" },
];

const cellFilters: FilterDef[] = [
  { id: "occupied", label: "Occupied Cells", group: "occupancy", domain: cond("status", "eq", "occupied") },
  { id: "empty", label: "Physically Empty Cells", group: "occupancy", domain: cond("status", "eq", "empty") },
  { id: "reserved_incoming", label: "Reserved for Incoming", group: "occupancy", domain: cond("status", "eq", "reserved_incoming") },
  { id: "blocked", label: "Blocked Cells", group: "occupancy", domain: cond("status", "eq", "blocked") },
  { id: "available_putaway", label: "Available for Put-Away", group: "putaway", domain: cond("availableForPutaway", "eq", true), help: "Empty, unblocked, not reserved for an incoming move." },
  { id: "full_pallets", label: "Full Pallets", group: "pallet", domain: cond("palletStatus", "eq", "full") },
  { id: "partial_pallets", label: "Partially Filled Pallets", group: "pallet", domain: cond("palletStatus", "eq", "partial") },
  { id: "empty_pallets", label: "Empty Pallets", group: "pallet", domain: cond("palletStatus", "eq", "empty") },
  { id: "ground", label: "Ground Positions", group: "level", domain: cond("level", "eq", 0) },
  { id: "upper", label: "Upper Levels", group: "level", domain: cond("level", "gte", 1) },
  { id: "rm", label: "Raw Material", group: "material", domain: cond("materialGroup", "eq", "RM") },
  { id: "fg", label: "Finished Goods", group: "material", domain: cond("materialGroup", "eq", "FG") },
  { id: "pm", label: "Packing Material", group: "material", domain: cond("materialGroup", "eq", "PM") },
];

// -------------------------------------------------------------- pallets

const palletFields: FieldDef[] = [
  { name: "name", label: "Pallet", type: "text", searchable: true, sortable: true, filterable: true, format: "link", width: 130 },
  { name: "status", label: "Pallet Status", type: "selection", options: PALLET_STATUS_OPTIONS, groupable: true, filterable: true, sortable: true, format: "badge", width: 130 },
  { name: "state", label: "Physical State", type: "selection", options: [{ value: "stored", label: "Stored" }, { value: "in_transit", label: "In transit" }, { value: "staged", label: "Staged" }, { value: "free", label: "Free / yard" }], groupable: true, filterable: true, sortable: true, width: 120 },
  { name: "packageTypeName", label: "Package Type", type: "text", groupable: true, filterable: true, sortable: true, optional: true, width: 160 },
  { name: "completeName", label: "Location", type: "text", searchable: true, sortable: true, filterable: true, format: "link", width: 240 },
  { name: "warehouseId", label: "Warehouse", type: "relation", optionsKey: "warehouse", groupable: true, filterable: true, searchable: true },
  { name: "warehouseCode", label: "WH", type: "text", sortable: true, groupable: true, width: 70 },
  { name: "materialGroup", label: "Material Group", type: "selection", options: MATERIAL_GROUP_OPTIONS, groupable: true, filterable: true, width: 110 },
  { name: "aisleId", label: "Aisle", type: "relation", optionsKey: "aisle", groupable: true, filterable: true },
  { name: "aisleCode", label: "Aisle", type: "text", sortable: true, groupable: true, width: 70 },
  { name: "rackId", label: "Rack", type: "relation", optionsKey: "rack", groupable: true, filterable: true },
  { name: "rackCode", label: "Rack", type: "text", sortable: true, groupable: true, searchable: true, format: "link", width: 150 },
  { name: "bay", label: "Column / Bay", type: "number", sortable: true, groupable: true, filterable: true, align: "right", format: "int", optional: true, width: 100 },
  { name: "level", label: "Row / Level", type: "number", sortable: true, groupable: true, filterable: true, align: "right", format: "int", optional: true, width: 95 },
  { name: "productId", label: "Product", type: "relation", optionsKey: "product", groupable: true, filterable: true },
  { name: "productName", label: "Product", type: "text", searchable: true, sortable: true, groupable: true, format: "link", width: 230 },
  { name: "variantName", label: "Variant", type: "text", sortable: true, groupable: true, optional: true, width: 200 },
  { name: "lotId", label: "Lot", type: "relation", optionsKey: "lot", groupable: true, filterable: true },
  { name: "lotName", label: "Lot / Serial", type: "text", searchable: true, sortable: true, format: "link", width: 150 },
  { name: "quantity", label: "Quantity", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 110 },
  { name: "reservedQuantity", label: "Reserved", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, optional: true, width: 100 },
  { name: "availableQuantity", label: "Available", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 105 },
  { name: "capacityQty", label: "Pallet Capacity", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", width: 125, help: "Explicit product/variant full-pallet quantity - the denominator used for Fill %." },
  { name: "remainingQty", label: "Remaining Capacity", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 145 },
  { name: "fillPct", label: "Fill %", type: "number", sortable: true, filterable: true, align: "right", format: "pct", agg: { kind: "ratio", numerator: "quantity", denominator: "capacityQty", decimals: 1 }, width: 90 },
  { name: "uom", label: "Unit", type: "selection", groupable: true, filterable: true, width: 80 },
  { name: "weightKg", label: "Weight (kg)", type: "number", sortable: true, filterable: true, align: "right", format: "weight", agg: INT_AGG, optional: true, width: 110 },
  { name: "inDate", label: "Stock In Date", type: "date", sortable: true, filterable: true, groupable: true, format: "date", optional: true, width: 120 },
  { name: "ageDays", label: "Age (days)", type: "number", sortable: true, filterable: true, align: "right", format: "int", width: 100 },
  { name: "ageBucket", label: "Stock Age", type: "selection", options: AGE_BUCKET_OPTIONS, groupable: true, filterable: true, optional: true, width: 110 },
  { name: "locationId", label: "Location", type: "location", hierarchyFields: STOCK_HIERARCHY, filterable: true, optionsKey: "cell" },
];

const palletFilters: FilterDef[] = [
  { id: "full", label: "Full Pallets", group: "status", domain: cond("status", "eq", "full") },
  { id: "partial", label: "Partially Filled Pallets", group: "status", domain: cond("status", "eq", "partial") },
  { id: "empty", label: "Empty Pallets", group: "status", domain: cond("status", "eq", "empty") },
  { id: "in_stock", label: "In Stock", group: "availability", domain: cond("quantity", "gt", 0) },
  { id: "available", label: "Available to Pick", group: "availability", domain: cond("availableQuantity", "gt", 0) },
  { id: "reserved", label: "Reserved Stock", group: "availability", domain: cond("reservedQuantity", "gt", 0) },
  { id: "stored", label: "Stored in Racking", group: "placement", domain: cond("state", "eq", "stored") },
  { id: "free", label: "Free Pallets (yard)", group: "placement", domain: cond("state", "eq", "free") },
  { id: "rm", label: "Raw Material", group: "material", domain: cond("materialGroup", "eq", "RM") },
  { id: "fg", label: "Finished Goods", group: "material", domain: cond("materialGroup", "eq", "FG") },
  { id: "pm", label: "Packing Material", group: "material", domain: cond("materialGroup", "eq", "PM") },
  { id: "aged", label: "Stock over 90 days", group: "aging", domain: cond("ageDays", "gt", 90) },
];

// ---------------------------------------------------------------- stock

const stockFields: FieldDef[] = [
  { name: "productName", label: "Product", type: "text", searchable: true, sortable: true, groupable: true, format: "link", width: 240 },
  { name: "productCode", label: "Code", type: "text", searchable: true, sortable: true, width: 120 },
  { name: "productId", label: "Product", type: "relation", optionsKey: "product", groupable: true, filterable: true },
  { name: "variantName", label: "Variant", type: "text", sortable: true, groupable: true, optional: true, width: 220 },
  { name: "variantId", label: "Variant", type: "relation", optionsKey: "variant", groupable: true, filterable: true },
  { name: "categoryName", label: "Product Category", type: "text", groupable: true, sortable: true, optional: true, width: 200 },
  { name: "categoryId", label: "Product Category", type: "relation", optionsKey: "category", groupable: true, filterable: true },
  { name: "materialGroup", label: "Material Group", type: "selection", options: MATERIAL_GROUP_OPTIONS, groupable: true, filterable: true, sortable: true, width: 110 },
  { name: "lotName", label: "Lot / Serial", type: "text", searchable: true, sortable: true, format: "link", width: 150 },
  { name: "lotId", label: "Lot", type: "relation", optionsKey: "lot", groupable: true, filterable: true },
  { name: "palletName", label: "Pallet", type: "text", searchable: true, sortable: true, format: "link", width: 130 },
  { name: "palletId", label: "Pallet", type: "relation", optionsKey: "pallet", groupable: true, filterable: true },
  { name: "completeName", label: "Location", type: "text", searchable: true, sortable: true, format: "link", width: 250 },
  { name: "locationId", label: "Location", type: "location", hierarchyFields: STOCK_HIERARCHY, filterable: true, optionsKey: "cell", groupable: true },
  { name: "warehouseId", label: "Warehouse", type: "relation", optionsKey: "warehouse", groupable: true, filterable: true, searchable: true },
  { name: "warehouseCode", label: "WH", type: "text", sortable: true, groupable: true, width: 70 },
  { name: "aisleId", label: "Aisle", type: "relation", optionsKey: "aisle", groupable: true, filterable: true },
  { name: "aisleCode", label: "Aisle", type: "text", sortable: true, groupable: true, optional: true, width: 70 },
  { name: "rackId", label: "Rack", type: "relation", optionsKey: "rack", groupable: true, filterable: true },
  { name: "rackCode", label: "Rack", type: "text", sortable: true, groupable: true, searchable: true, format: "link", optional: true, width: 150 },
  { name: "bay", label: "Column / Bay", type: "number", sortable: true, groupable: true, filterable: true, align: "right", format: "int", optional: true, width: 100 },
  { name: "level", label: "Row / Level", type: "number", sortable: true, groupable: true, filterable: true, align: "right", format: "int", optional: true, width: 95 },
  { name: "quantity", label: "On Hand", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 110 },
  { name: "reservedQuantity", label: "Reserved", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 105 },
  { name: "availableQuantity", label: "Available", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 105 },
  { name: "uom", label: "Unit", type: "selection", groupable: true, filterable: true, width: 80 },
  { name: "fillPct", label: "Pallet Fill %", type: "number", sortable: true, filterable: true, align: "right", format: "pct", agg: { kind: "ratio", numerator: "quantity", denominator: "capacityQty", decimals: 1 }, optional: true, width: 110 },
  { name: "capacityQty", label: "Pallet Capacity", type: "number", sortable: true, filterable: true, align: "right", format: "qty", optional: true, width: 125 },
  { name: "weightKg", label: "Weight (kg)", type: "number", sortable: true, filterable: true, align: "right", format: "weight", agg: INT_AGG, optional: true, width: 110 },
  { name: "inDate", label: "Stock In Date", type: "date", sortable: true, filterable: true, groupable: true, format: "date", width: 125, help: "Date the stock entered the site. Preserved when the pallet is relocated." },
  { name: "receiptDate", label: "Lot Receipt Date", type: "date", sortable: true, filterable: true, groupable: true, format: "date", optional: true, width: 140 },
  { name: "ageDays", label: "Age (days)", type: "number", sortable: true, filterable: true, align: "right", format: "int", width: 100 },
  { name: "ageBucket", label: "Stock Age", type: "selection", options: AGE_BUCKET_OPTIONS, groupable: true, filterable: true, width: 110 },
  { name: "locationKind", label: "Location Type", type: "selection", groupable: true, filterable: true, optional: true, width: 120 },
];

const stockFilters: FilterDef[] = [
  { id: "in_stock", label: "In Stock", group: "availability", domain: cond("quantity", "gt", 0) },
  { id: "available", label: "Available to Pick", group: "availability", domain: cond("availableQuantity", "gt", 0) },
  { id: "reserved", label: "Reserved Stock", group: "availability", domain: cond("reservedQuantity", "gt", 0) },
  { id: "rm", label: "Raw Material", group: "material", domain: cond("materialGroup", "eq", "RM") },
  { id: "fg", label: "Finished Goods", group: "material", domain: cond("materialGroup", "eq", "FG") },
  { id: "pm", label: "Packing Material", group: "material", domain: cond("materialGroup", "eq", "PM") },
  { id: "racking", label: "In Racking", group: "place", domain: cond("locationKind", "eq", "cell") },
  { id: "aging_90", label: "Older than 90 days", group: "aging", domain: cond("ageDays", "gt", 90) },
  { id: "aging_180", label: "Older than 180 days", group: "aging", domain: cond("ageDays", "gt", 180) },
];

// ----------------------------------------------------------- operations

const operationFields: FieldDef[] = [
  { name: "name", label: "Reference", type: "text", searchable: true, sortable: true, filterable: true, format: "link", width: 150 },
  { name: "kind", label: "Operation Type", type: "selection", options: KIND_OPTIONS, groupable: true, filterable: true, sortable: true, width: 140 },
  { name: "typeName", label: "Operation Type", type: "text", groupable: true, sortable: true, optional: true, width: 200 },
  { name: "state", label: "Status", type: "selection", options: STATE_OPTIONS, groupable: true, filterable: true, sortable: true, format: "state", width: 110 },
  { name: "warehouseId", label: "Warehouse", type: "relation", optionsKey: "warehouse", groupable: true, filterable: true, searchable: true },
  { name: "warehouseCode", label: "WH", type: "text", sortable: true, groupable: true, width: 70 },
  { name: "partnerName", label: "Partner", type: "text", searchable: true, sortable: true, groupable: true, width: 220 },
  { name: "partnerId", label: "Partner", type: "relation", optionsKey: "partner", groupable: true, filterable: true },
  { name: "operatorName", label: "Operator", type: "text", searchable: true, sortable: true, groupable: true, width: 150 },
  { name: "operatorId", label: "Operator", type: "relation", optionsKey: "operator", groupable: true, filterable: true },
  { name: "sourceDocument", label: "Source Document", type: "text", searchable: true, sortable: true, filterable: true, optional: true, width: 150 },
  { name: "sourceLocationName", label: "From", type: "text", sortable: true, searchable: true, width: 210 },
  { name: "destLocationName", label: "To", type: "text", sortable: true, searchable: true, width: 210 },
  { name: "productNames", label: "Products", type: "text", searchable: true, optional: true, width: 260 },
  { name: "scheduledAt", label: "Scheduled Date", type: "datetime", sortable: true, filterable: true, groupable: true, format: "datetime", width: 150 },
  { name: "effectiveAt", label: "Effective Date", type: "datetime", sortable: true, filterable: true, groupable: true, format: "datetime", optional: true, width: 150 },
  { name: "createdAt", label: "Created On", type: "datetime", sortable: true, filterable: true, groupable: true, format: "datetime", optional: true, width: 150 },
  { name: "lineCount", label: "Lines", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, optional: true, width: 80 },
  { name: "demandQty", label: "Demand", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uoms", agg: { kind: "sum", unitField: "uoms", decimals: 2 }, width: 110 },
  { name: "doneQty", label: "Done", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uoms", agg: { kind: "sum", unitField: "uoms", decimals: 2 }, width: 110 },
  { name: "manualLotSelection", label: "Manual Lot Selection", type: "boolean", filterable: true, groupable: true, optional: true, width: 160 },
  { name: "blendRef", label: "Blend Reference", type: "text", searchable: true, filterable: true, optional: true, width: 150 },
];

const operationFilters: FilterDef[] = [
  { id: "receipts", label: "Receipts", group: "kind", domain: cond("kind", "eq", "receipt") },
  { id: "putaway", label: "Put-Away", group: "kind", domain: cond("kind", "eq", "putaway") },
  { id: "internal", label: "Internal Transfers", group: "kind", domain: cond("kind", "eq", "internal") },
  { id: "pick", label: "Picks", group: "kind", domain: cond("kind", "eq", "pick") },
  { id: "delivery", label: "Deliveries", group: "kind", domain: cond("kind", "eq", "delivery") },
  { id: "draft", label: "Draft", group: "state", domain: cond("state", "eq", "draft") },
  { id: "waiting", label: "Waiting", group: "state", domain: cond("state", "eq", "waiting") },
  { id: "ready", label: "Ready", group: "state", domain: cond("state", "eq", "ready") },
  { id: "done", label: "Done", group: "state", domain: cond("state", "eq", "done") },
  { id: "cancel", label: "Cancelled", group: "state", domain: cond("state", "eq", "cancel") },
  { id: "todo", label: "To Process", group: "workload", domain: or(cond("state", "eq", "ready"), cond("state", "eq", "waiting"), cond("state", "eq", "draft")) },
  { id: "manual_blend", label: "Manual Blend Selection", group: "workload", domain: cond("manualLotSelection", "eq", true) },
];

// ------------------------------------------------------------ movements

const movementFields: FieldDef[] = [
  { name: "operationName", label: "Reference", type: "text", searchable: true, sortable: true, filterable: true, format: "link", width: 150 },
  { name: "kind", label: "Operation Type", type: "selection", options: KIND_OPTIONS, groupable: true, filterable: true, sortable: true, width: 140 },
  { name: "state", label: "Status", type: "selection", options: STATE_OPTIONS, groupable: true, filterable: true, sortable: true, format: "state", width: 110 },
  { name: "movementDate", label: "Movement Date", type: "datetime", sortable: true, filterable: true, groupable: true, format: "datetime", width: 150 },
  { name: "doneAt", label: "Completed On", type: "datetime", sortable: true, filterable: true, groupable: true, format: "datetime", optional: true, width: 150 },
  { name: "productName", label: "Product", type: "text", searchable: true, sortable: true, groupable: true, format: "link", width: 240 },
  { name: "productId", label: "Product", type: "relation", optionsKey: "product", groupable: true, filterable: true },
  { name: "variantName", label: "Variant", type: "text", sortable: true, groupable: true, optional: true, width: 200 },
  { name: "materialGroup", label: "Material Group", type: "selection", options: MATERIAL_GROUP_OPTIONS, groupable: true, filterable: true, width: 110 },
  { name: "lotName", label: "Lot / Serial", type: "text", searchable: true, sortable: true, format: "link", width: 150 },
  { name: "lotId", label: "Lot", type: "relation", optionsKey: "lot", groupable: true, filterable: true },
  { name: "palletName", label: "Pallet", type: "text", searchable: true, sortable: true, format: "link", width: 130 },
  { name: "palletId", label: "Pallet", type: "relation", optionsKey: "pallet", groupable: true, filterable: true },
  { name: "quantity", label: "Quantity", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 110 },
  { name: "doneQty", label: "Done", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 105 },
  { name: "uom", label: "Unit", type: "selection", groupable: true, filterable: true, width: 80 },
  { name: "sourceLocationName", label: "From", type: "text", searchable: true, sortable: true, groupable: true, width: 220 },
  { name: "destLocationName", label: "To", type: "text", searchable: true, sortable: true, groupable: true, width: 220 },
  { name: "warehouseId", label: "Warehouse", type: "relation", optionsKey: "warehouse", groupable: true, filterable: true },
  { name: "warehouseCode", label: "WH", type: "text", sortable: true, groupable: true, width: 70 },
  { name: "operatorName", label: "Operator", type: "text", searchable: true, sortable: true, groupable: true, optional: true, width: 150 },
  { name: "operatorId", label: "Operator", type: "relation", optionsKey: "operator", groupable: true, filterable: true },
];

const movementFilters: FilterDef[] = [
  { id: "receipts", label: "Receipts", group: "kind", domain: cond("kind", "eq", "receipt") },
  { id: "putaway", label: "Put-Away", group: "kind", domain: cond("kind", "eq", "putaway") },
  { id: "internal", label: "Internal Transfers", group: "kind", domain: cond("kind", "eq", "internal") },
  { id: "pick", label: "Picks", group: "kind", domain: cond("kind", "eq", "pick") },
  { id: "delivery", label: "Deliveries", group: "kind", domain: cond("kind", "eq", "delivery") },
  { id: "done", label: "Completed", group: "state", domain: cond("state", "eq", "done") },
  { id: "pending", label: "Not Completed", group: "state", domain: cond("state", "ne", "done") },
];

// ------------------------------------------------------------- products

const productFields: FieldDef[] = [
  { name: "name", label: "Product", type: "text", searchable: true, sortable: true, filterable: true, format: "link", width: 260 },
  { name: "code", label: "Internal Reference", type: "text", searchable: true, sortable: true, filterable: true, width: 140 },
  { name: "categoryName", label: "Product Category", type: "text", groupable: true, sortable: true, width: 210 },
  { name: "categoryId", label: "Product Category", type: "relation", optionsKey: "category", groupable: true, filterable: true },
  { name: "materialGroup", label: "Material Group", type: "selection", options: MATERIAL_GROUP_OPTIONS, groupable: true, filterable: true, sortable: true, width: 110 },
  { name: "uom", label: "Unit", type: "selection", groupable: true, filterable: true, width: 85 },
  { name: "capacityQty", label: "Pallet Capacity", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", width: 125 },
  { name: "onHand", label: "On Hand", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 115 },
  { name: "reserved", label: "Reserved", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 105 },
  { name: "available", label: "Available", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 105 },
  { name: "lotCount", label: "Lots", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, width: 80 },
  { name: "palletCount", label: "Pallets", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, width: 85 },
  { name: "locationCount", label: "Locations", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, width: 95 },
  { name: "warehouseCount", label: "Warehouses", type: "number", sortable: true, filterable: true, align: "right", format: "int", optional: true, width: 110 },
  { name: "variantCount", label: "Variants", type: "number", sortable: true, filterable: true, align: "right", format: "int", optional: true, width: 90 },
  { name: "oldestAgeDays", label: "Oldest Stock (days)", type: "number", sortable: true, filterable: true, align: "right", format: "int", optional: true, width: 150 },
  { name: "blendGrade", label: "Blend Grade", type: "text", groupable: true, filterable: true, searchable: true, optional: true, width: 120 },
  { name: "removalStrategy", label: "Removal Strategy", type: "selection", options: [{ value: "fifo", label: "FIFO" }, { value: "lifo", label: "LIFO" }, { value: "closest", label: "Closest Location" }, { value: "least_packages", label: "Least Packages" }], groupable: true, filterable: true, sortable: true, width: 145 },
];

const productFilters: FilterDef[] = [
  { id: "in_stock", label: "In Stock", group: "availability", domain: cond("onHand", "gt", 0) },
  { id: "available", label: "Available to Pick", group: "availability", domain: cond("available", "gt", 0) },
  { id: "reserved", label: "Reserved Stock", group: "availability", domain: cond("reserved", "gt", 0) },
  { id: "no_stock", label: "No Stock On Hand", group: "availability", domain: cond("onHand", "lte", 0) },
  { id: "rm", label: "Raw Material", group: "material", domain: cond("materialGroup", "eq", "RM") },
  { id: "fg", label: "Finished Goods", group: "material", domain: cond("materialGroup", "eq", "FG") },
  { id: "pm", label: "Packing Material", group: "material", domain: cond("materialGroup", "eq", "PM") },
  { id: "fifo", label: "FIFO Products", group: "strategy", domain: cond("removalStrategy", "eq", "fifo") },
  { id: "lifo", label: "LIFO Products", group: "strategy", domain: cond("removalStrategy", "eq", "lifo") },
];

// ----------------------------------------------------------------- lots

const lotFields: FieldDef[] = [
  { name: "name", label: "Lot / Serial", type: "text", searchable: true, sortable: true, filterable: true, format: "link", width: 165 },
  { name: "productName", label: "Product", type: "text", searchable: true, sortable: true, groupable: true, format: "link", width: 250 },
  { name: "productId", label: "Product", type: "relation", optionsKey: "product", groupable: true, filterable: true },
  { name: "variantName", label: "Variant", type: "text", sortable: true, groupable: true, optional: true, width: 220 },
  { name: "materialGroup", label: "Material Group", type: "selection", options: MATERIAL_GROUP_OPTIONS, groupable: true, filterable: true, width: 110 },
  { name: "receiptDate", label: "Receipt Date", type: "date", sortable: true, filterable: true, groupable: true, format: "date", width: 130, help: "Original receipt date. Relocating stock never resets it." },
  { name: "ageDays", label: "Age (days)", type: "number", sortable: true, filterable: true, align: "right", format: "int", width: 100 },
  { name: "ageBucket", label: "Stock Age", type: "selection", options: AGE_BUCKET_OPTIONS, groupable: true, filterable: true, width: 110 },
  { name: "onHand", label: "On Hand", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 115 },
  { name: "reserved", label: "Reserved", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 105 },
  { name: "available", label: "Available", type: "number", sortable: true, filterable: true, align: "right", format: "qty", unitField: "uom", agg: QTY_AGG, width: 105 },
  { name: "uom", label: "Unit", type: "selection", groupable: true, filterable: true, width: 80 },
  { name: "palletCount", label: "Pallets", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, width: 85 },
  { name: "locationCount", label: "Locations", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, width: 95 },
  { name: "warehouseCodes", label: "Warehouses", type: "text", groupable: true, sortable: true, width: 130 },
  { name: "gardenMark", label: "Garden Mark", type: "text", searchable: true, groupable: true, filterable: true, optional: true, width: 140 },
  { name: "origin", label: "Origin", type: "text", searchable: true, filterable: true, optional: true, width: 180 },
  { name: "supplierRef", label: "Supplier", type: "text", searchable: true, groupable: true, filterable: true, optional: true, width: 220 },
  { name: "blendGrade", label: "Blend Grade", type: "text", groupable: true, filterable: true, searchable: true, optional: true, width: 120 },
];

const lotFilters: FilterDef[] = [
  { id: "in_stock", label: "In Stock", group: "availability", domain: cond("onHand", "gt", 0) },
  { id: "available", label: "Available to Pick", group: "availability", domain: cond("available", "gt", 0) },
  { id: "reserved", label: "Reserved Stock", group: "availability", domain: cond("reserved", "gt", 0) },
  { id: "rm", label: "Raw Material", group: "material", domain: cond("materialGroup", "eq", "RM") },
  { id: "fg", label: "Finished Goods", group: "material", domain: cond("materialGroup", "eq", "FG") },
  { id: "pm", label: "Packing Material", group: "material", domain: cond("materialGroup", "eq", "PM") },
  { id: "aging_90", label: "Older than 90 days", group: "aging", domain: cond("ageDays", "gt", 90) },
  { id: "aging_180", label: "Older than 180 days", group: "aging", domain: cond("ageDays", "gt", 180) },
];

// ---------------------------------------------------------------- racks

const rackFields: FieldDef[] = [
  { name: "code", label: "Rack", type: "text", searchable: true, sortable: true, filterable: true, format: "link", width: 160 },
  { name: "warehouseId", label: "Warehouse", type: "relation", optionsKey: "warehouse", groupable: true, filterable: true, searchable: true },
  { name: "warehouseCode", label: "WH", type: "text", sortable: true, groupable: true, width: 70 },
  { name: "materialGroup", label: "Material Group", type: "selection", options: MATERIAL_GROUP_OPTIONS, groupable: true, filterable: true, width: 110 },
  { name: "aisleId", label: "Aisle", type: "relation", optionsKey: "aisle", groupable: true, filterable: true },
  { name: "aisleCode", label: "Aisle", type: "text", sortable: true, groupable: true, width: 70 },
  { name: "profileCode", label: "Rack Profile", type: "text", groupable: true, filterable: true, sortable: true, width: 110 },
  { name: "side", label: "Side", type: "selection", options: [{ value: "A", label: "A" }, { value: "B", label: "B" }], groupable: true, filterable: true, optional: true, width: 70 },
  { name: "bays", label: "Bays", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, width: 80 },
  { name: "levels", label: "Levels", type: "number", sortable: true, filterable: true, align: "right", format: "int", width: 85 },
  { name: "positions", label: "Positions", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, width: 100 },
  { name: "occupied", label: "Occupied", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, width: 100 },
  { name: "empty", label: "Empty", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, width: 90 },
  { name: "blocked", label: "Blocked", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, width: 90 },
  { name: "availableForPutaway", label: "Available for Put-Away", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, width: 165 },
  { name: "occupancyPct", label: "Occupancy %", type: "number", sortable: true, filterable: true, align: "right", format: "pct", agg: { kind: "ratio", numerator: "occupied", denominator: "positions", decimals: 1 }, width: 120 },
  { name: "partialPallets", label: "Partial Pallets", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, optional: true, width: 125 },
  { name: "emptyPallets", label: "Empty Pallets", type: "number", sortable: true, filterable: true, align: "right", format: "int", agg: INT_AGG, optional: true, width: 125 },
];

const rackFilters: FilterDef[] = [
  { id: "has_space", label: "Has Available Positions", group: "capacity", domain: cond("availableForPutaway", "gt", 0) },
  { id: "full", label: "Full Racks", group: "capacity", domain: cond("availableForPutaway", "eq", 0) },
  { id: "over80", label: "Occupancy over 80%", group: "utilisation", domain: cond("occupancyPct", "gt", 80) },
  { id: "under40", label: "Occupancy under 40%", group: "utilisation", domain: cond("occupancyPct", "lt", 40) },
  { id: "rm", label: "Raw Material", group: "material", domain: cond("materialGroup", "eq", "RM") },
  { id: "fg", label: "Finished Goods", group: "material", domain: cond("materialGroup", "eq", "FG") },
  { id: "pm", label: "Packing Material", group: "material", domain: cond("materialGroup", "eq", "PM") },
];

// ----------------------------------------------------------- warehouses

const warehouseFields: FieldDef[] = [
  { name: "code", label: "Code", type: "text", searchable: true, sortable: true, format: "link", width: 90 },
  { name: "name", label: "Warehouse", type: "text", searchable: true, sortable: true, filterable: true, format: "link", width: 250 },
  { name: "materialGroup", label: "Material Group", type: "selection", options: MATERIAL_GROUP_OPTIONS, groupable: true, filterable: true, width: 130 },
  { name: "materialGroupConfirmed", label: "Use Confirmed", type: "boolean", filterable: true, groupable: true, width: 130 },
  { name: "positions", label: "Installed Positions", type: "number", sortable: true, align: "right", format: "int", agg: INT_AGG, width: 150 },
  { name: "declaredPositions", label: "Drawing Positions", type: "number", sortable: true, align: "right", format: "int", agg: INT_AGG, width: 150 },
  { name: "occupied", label: "Occupied", type: "number", sortable: true, align: "right", format: "int", agg: INT_AGG, width: 100 },
  { name: "empty", label: "Empty", type: "number", sortable: true, align: "right", format: "int", agg: INT_AGG, width: 90 },
  { name: "blocked", label: "Blocked", type: "number", sortable: true, align: "right", format: "int", agg: INT_AGG, width: 90 },
  { name: "availableForPutaway", label: "Available for Put-Away", type: "number", sortable: true, align: "right", format: "int", agg: INT_AGG, width: 165 },
  { name: "occupancyPct", label: "Occupancy %", type: "number", sortable: true, align: "right", format: "pct", agg: { kind: "ratio", numerator: "occupied", denominator: "positions", decimals: 1 }, width: 120 },
  { name: "rackCount", label: "Racks", type: "number", sortable: true, align: "right", format: "int", agg: INT_AGG, width: 85 },
  { name: "aisleCount", label: "Aisles", type: "number", sortable: true, align: "right", format: "int", agg: INT_AGG, width: 85 },
  { name: "drawingRef", label: "Drawing", type: "text", sortable: true, optional: true, width: 300 },
];

// ------------------------------------------------------------- registry

export const MODELS: Record<string, ModelDef> = {
  cell: {
    name: "cell",
    label: "Cell",
    labelPlural: "Cells",
    route: "/locations/cells",
    rows: (d) => d.cells,
    fields: cellFields,
    defaultColumns: ["completeName", "status", "palletName", "palletStatus", "productName", "lotName", "quantity", "uom", "fillPct"],
    defaultOrder: [{ field: "completeName", dir: "asc" }],
    searchFields: ["completeName", "name", "palletName", "productName", "lotName", "rackCode"],
    filters: cellFilters,
    groupBys: ["warehouseCode", "aisleCode", "rackCode", "bay", "level", "status", "palletStatus", "materialGroup", "productName", "lotName", "ageBucket", "storageCategoryName", "rackProfile"],
    recordRoute: (id) => `/locations/cells/${id}`,
    displayField: "completeName",
    views: ["list", "graph", "pivot"],
  },
  pallet: {
    name: "pallet",
    label: "Pallet",
    labelPlural: "Pallets",
    route: "/pallets",
    rows: (d) => d.pallets,
    fields: palletFields,
    defaultColumns: ["name", "status", "completeName", "productName", "lotName", "quantity", "uom", "capacityQty", "fillPct", "availableQuantity"],
    defaultOrder: [{ field: "name", dir: "asc" }],
    searchFields: ["name", "completeName", "productName", "lotName", "rackCode"],
    filters: palletFilters,
    groupBys: ["status", "state", "warehouseCode", "aisleCode", "rackCode", "level", "productName", "lotName", "materialGroup", "ageBucket", "packageTypeName"],
    recordRoute: (id) => `/pallets/${id}`,
    displayField: "name",
    views: ["list", "graph", "pivot"],
  },
  stock: {
    name: "stock",
    label: "Stock Line",
    labelPlural: "Stock",
    route: "/stock",
    rows: (d) => d.stock,
    fields: stockFields,
    defaultColumns: ["productName", "lotName", "palletName", "completeName", "quantity", "reservedQuantity", "availableQuantity", "uom", "ageDays"],
    defaultOrder: [{ field: "productName", dir: "asc" }],
    searchFields: ["productName", "productCode", "lotName", "palletName", "completeName", "rackCode"],
    filters: stockFilters,
    groupBys: ["warehouseCode", "aisleCode", "rackCode", "bay", "level", "productName", "categoryName", "variantName", "lotName", "palletName", "materialGroup", "ageBucket", "uom", "inDate:month"],
    displayField: "productName",
    views: ["list", "graph", "pivot"],
  },
  operation: {
    name: "operation",
    label: "Operation",
    labelPlural: "Operations",
    route: "/operations",
    rows: (d) => d.operations,
    fields: operationFields,
    defaultColumns: ["name", "kind", "partnerName", "sourceLocationName", "destLocationName", "scheduledAt", "operatorName", "state"],
    defaultOrder: [{ field: "scheduledAt", dir: "desc" }],
    searchFields: ["name", "partnerName", "sourceDocument", "operatorName", "productNames"],
    filters: operationFilters,
    groupBys: ["kind", "state", "warehouseCode", "operatorName", "partnerName", "scheduledAt:month", "scheduledAt:week", "scheduledAt:day"],
    recordRoute: (id) => `/operations/${id}`,
    displayField: "name",
    views: ["list", "graph", "pivot"],
  },
  movement: {
    name: "movement",
    label: "Movement",
    labelPlural: "Inventory Movements",
    route: "/movements",
    rows: (d) => d.movements,
    fields: movementFields,
    defaultColumns: ["movementDate", "operationName", "kind", "productName", "lotName", "palletName", "sourceLocationName", "destLocationName", "quantity", "uom", "state"],
    defaultOrder: [{ field: "movementDate", dir: "desc" }],
    searchFields: ["operationName", "productName", "lotName", "palletName", "sourceLocationName", "destLocationName"],
    filters: movementFilters,
    groupBys: ["kind", "state", "warehouseCode", "productName", "lotName", "operatorName", "materialGroup", "movementDate:day", "movementDate:week", "movementDate:month"],
    displayField: "operationName",
    views: ["list", "graph", "pivot"],
  },
  product: {
    name: "product",
    label: "Product",
    labelPlural: "Products",
    route: "/products",
    rows: (d) => d.products,
    fields: productFields,
    defaultColumns: ["code", "name", "categoryName", "uom", "onHand", "reserved", "available", "lotCount", "palletCount", "locationCount"],
    defaultOrder: [{ field: "name", dir: "asc" }],
    searchFields: ["name", "code", "categoryName", "blendGrade"],
    filters: productFilters,
    groupBys: ["categoryName", "materialGroup", "uom", "removalStrategy", "blendGrade"],
    recordRoute: (id) => `/products/${id}`,
    displayField: "name",
    views: ["list", "graph", "pivot"],
  },
  lot: {
    name: "lot",
    label: "Lot",
    labelPlural: "Lots / Serial Numbers",
    route: "/lots",
    rows: (d) => d.lots,
    fields: lotFields,
    defaultColumns: ["name", "productName", "receiptDate", "ageDays", "onHand", "reserved", "available", "uom", "palletCount", "locationCount"],
    defaultOrder: [{ field: "receiptDate", dir: "asc" }],
    searchFields: ["name", "productName", "gardenMark", "supplierRef", "origin"],
    filters: lotFilters,
    groupBys: ["productName", "materialGroup", "ageBucket", "warehouseCodes", "gardenMark", "supplierRef", "receiptDate:month"],
    recordRoute: (id) => `/lots/${id}`,
    displayField: "name",
    views: ["list", "graph", "pivot"],
  },
  rack: {
    name: "rack",
    label: "Rack",
    labelPlural: "Racks",
    route: "/locations/racks",
    rows: (d) => d.racks,
    fields: rackFields,
    defaultColumns: ["code", "warehouseCode", "aisleCode", "profileCode", "bays", "levels", "positions", "occupied", "availableForPutaway", "occupancyPct"],
    defaultOrder: [{ field: "code", dir: "asc" }],
    searchFields: ["code", "warehouseCode", "aisleCode", "profileCode"],
    filters: rackFilters,
    groupBys: ["warehouseCode", "aisleCode", "profileCode", "side", "materialGroup"],
    recordRoute: (id) => `/locations/racks/${id}`,
    displayField: "code",
    views: ["list", "graph", "pivot"],
  },
  warehouse: {
    name: "warehouse",
    label: "Warehouse",
    labelPlural: "Warehouses",
    route: "/locations/warehouses",
    rows: (d) => d.warehouses,
    fields: warehouseFields,
    defaultColumns: ["code", "name", "materialGroup", "positions", "occupied", "empty", "blocked", "availableForPutaway", "occupancyPct", "rackCount"],
    defaultOrder: [{ field: "code", dir: "asc" }],
    searchFields: ["code", "name"],
    filters: [],
    groupBys: ["materialGroup", "siteId"],
    recordRoute: (id) => `/locations/warehouses/${id}`,
    displayField: "name",
    views: ["list", "graph", "pivot"],
  },
};

export function getModel(name: string): ModelDef {
  const model = MODELS[name];
  if (!model) throw new Error(`Unknown model: ${name}`);
  return model;
}

export function getField(model: ModelDef, name: string): FieldDef | undefined {
  return model.fields.find((f) => f.name === name);
}

/** Field resolver for the domain evaluator. */
export function fieldResolver(model: ModelDef) {
  const map = new Map(model.fields.map((f) => [f.name, f]));
  return (name: string) => {
    const def = map.get(name);
    if (!def) return undefined;
    return { type: def.type, hierarchyFields: def.hierarchyFields };
  };
}

/**
 * Combine predefined filter selections the way Odoo does: alternatives inside
 * one group are OR-ed, and the groups are AND-ed together.
 */
export function filterSelectionToDomain(
  model: ModelDef,
  selectedIds: string[],
): DomainNode {
  const byGroup = new Map<string, DomainNode[]>();
  for (const id of selectedIds) {
    const def = model.filters.find((f) => f.id === id);
    if (!def) continue;
    const list = byGroup.get(def.group) ?? [];
    list.push(def.domain);
    byGroup.set(def.group, list);
  }
  const groups: DomainNode[] = [];
  for (const nodes of byGroup.values()) {
    groups.push(nodes.length === 1 ? nodes[0] : or(...nodes));
  }
  return and(...groups);
}
