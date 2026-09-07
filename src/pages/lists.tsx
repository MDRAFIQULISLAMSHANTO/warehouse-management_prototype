/**
 * Record lists and the SRS reports.
 *
 * Reports are not a separate mechanism: each one is the shared list view opened
 * on a model with a documented base scope, default grouping and columns. That
 * means every report inherits searching, filtering, grouping, pivoting and CSV
 * export, and reconciles with the dashboards by construction.
 */

import { FillBar } from "@/odoo/format";
import { cond, or } from "@/query/domain";
import type { PalletRow } from "@/data/derive";
import { RecordList } from "./RecordList";

const fillRenderer = {
  fillPct: (row: Record<string, unknown>) => (
    <FillBar value={row.fillPct as number | undefined} />
  ),
};

// ------------------------------------------------------------------ lists

export function OperationsList() {
  return (
    <RecordList
      modelName="operation"
      title="Operations"
      breadcrumbs={[{ label: "Operations" }]}
      description="Receipts, put-aways, internal transfers, picks and deliveries. Draft and suggested operations do not change stock; validation does."
    />
  );
}

export function MovementsList() {
  return (
    <RecordList
      modelName="movement"
      title="Inventory Movements"
      breadcrumbs={[{ label: "Operations" }]}
      description="Every stock movement line recorded in the demonstration period, including the source and destination position and the pallet involved."
    />
  );
}

export function StockList() {
  return (
    <RecordList
      modelName="stock"
      title="Stock Lines"
      breadcrumbs={[{ label: "Products" }]}
      description="One line per product, lot, pallet and location - the equivalent of Odoo's stock quants."
      cellRenderers={fillRenderer}
    />
  );
}

export function ProductsList() {
  return (
    <RecordList
      modelName="product"
      title="Products"
      breadcrumbs={[{ label: "Products" }]}
      description="Quantities are kept in each product's own unit of measure and never added across incompatible units."
    />
  );
}

export function LotsList() {
  return (
    <RecordList
      modelName="lot"
      title="Lots / Serial Numbers"
      breadcrumbs={[{ label: "Products" }]}
      description="Receipt dates are the original receipt of the lot. Relocating stock never resets them, so stock age stays true."
    />
  );
}

export function PalletsList() {
  return (
    <RecordList
      modelName="pallet"
      title="Pallets"
      breadcrumbs={[{ label: "Pallets" }]}
      description="Each pallet is uniquely identified and keeps that identity when it is emptied or moved."
      cellRenderers={fillRenderer}
    />
  );
}

export function WarehousesList() {
  return (
    <RecordList
      modelName="warehouse"
      title="Warehouses"
      breadcrumbs={[{ label: "Locations" }]}
      description="Installed positions come from the MinMax storage-capacity tables. Input, output and staging areas are modelled separately and are not counted as installed positions."
    />
  );
}

export function RacksList() {
  return (
    <RecordList
      modelName="rack"
      title="Racks"
      breadcrumbs={[{ label: "Locations" }]}
      description="Each rack has a unique physical identifier. R1, R2, 4R4 and the rest are rack profiles from the drawings, not rack names."
    />
  );
}

export function CellsList() {
  return (
    <RecordList
      modelName="cell"
      title="Cells"
      breadcrumbs={[{ label: "Locations" }]}
      description="One row per pallet position. Column/bay is horizontal, row/level is vertical, and level 0 is the ground position."
      cellRenderers={fillRenderer}
    />
  );
}

// ---------------------------------------------------------------- reports

export function StockOnHandByLocationReport() {
  return (
    <RecordList
      modelName="stock"
      title="Stock on Hand by Location"
      breadcrumbs={[{ label: "Reporting" }]}
      description="On-hand, reserved and available quantities by warehouse, aisle, rack and cell. Grouped by location by default; change the grouping to re-cut the same figures."
      initialGroupBy={["warehouseCode", "aisleCode", "rackCode"]}
      initialFilterIds={["in_stock"]}
    />
  );
}

export function InventoryByPalletReport() {
  return (
    <RecordList
      modelName="pallet"
      title="Inventory by Pallet"
      breadcrumbs={[{ label: "Reporting" }]}
      description="Every pallet holding stock, with its position, contents, fill percentage and remaining capacity."
      initialFilterIds={["in_stock"]}
      cellRenderers={fillRenderer}
    />
  );
}

export function MovementHistoryReport() {
  return (
    <RecordList
      modelName="movement"
      title="Inventory Movement History"
      breadcrumbs={[{ label: "Reporting" }]}
      description="Completed movements in date order. Validated operations keep their history permanently."
      initialFilterIds={["done"]}
      initialOrder={[{ field: "movementDate", dir: "desc" }]}
    />
  );
}

export function EmptyPalletReport() {
  return (
    <RecordList
      modelName="pallet"
      title="Empty Pallet Report"
      breadcrumbs={[{ label: "Reporting" }]}
      description="Pallets holding no stock. A physically present empty pallet still occupies its rack position - it has to be removed or relocated explicitly."
      initialFilterIds={["empty"]}
      baseDomain={cond("status", "eq", "empty")}
    />
  );
}

export function PartiallyFilledPalletReport() {
  return (
    <RecordList
      modelName="pallet"
      title="Partially Filled Pallet Report"
      breadcrumbs={[{ label: "Reporting" }]}
      description="Pallets holding less than a full load. Fill percentage uses the explicit pallet capacity of the product or variant, never the structural rating of the position."
      baseDomain={cond("status", "eq", "partial")}
      cellRenderers={fillRenderer}
      initialOrder={[{ field: "fillPct", dir: "asc" }]}
    />
  );
}

export function WarehouseOccupancyReport() {
  return (
    <RecordList
      modelName="rack"
      title="Warehouse Occupancy Report"
      breadcrumbs={[{ label: "Reporting" }]}
      description="Installed, occupied, empty, blocked and available-for-put-away positions per rack. Occupancy is occupied positions divided by installed positions within the scope shown."
      initialGroupBy={["warehouseCode", "aisleCode"]}
    />
  );
}

export function FifoPickingReport() {
  return (
    <RecordList
      modelName="stock"
      title="FIFO Picking Report"
      breadcrumbs={[{ label: "Reporting" }]}
      description="Available stock ordered oldest first - the sequence a FIFO removal strategy would follow. Products configured for LIFO appear in the LIFO report instead."
      baseDomain={cond("availableQuantity", "gt", 0)}
      initialOrder={[{ field: "inDate", dir: "asc" }]}
    />
  );
}

export function LifoPickingReport() {
  return (
    <RecordList
      modelName="stock"
      title="LIFO Picking Report"
      breadcrumbs={[{ label: "Reporting" }]}
      description="Available stock ordered newest first - the sequence a LIFO removal strategy would follow."
      baseDomain={cond("availableQuantity", "gt", 0)}
      initialOrder={[{ field: "inDate", dir: "desc" }]}
    />
  );
}

export function BlendOperationReport() {
  return (
    <RecordList
      modelName="operation"
      title="Blend Operation Report"
      breadcrumbs={[{ label: "Reporting" }]}
      description="Picks where an authorised user selected the lots manually against an approved blend requirement (SRS REQ-BLD-002). Blend sheet generation and printing are out of scope for this prototype, so no document is produced here."
      baseDomain={cond("manualLotSelection", "eq", true)}
      initialOrder={[{ field: "scheduledAt", dir: "desc" }]}
    />
  );
}

export function StockAgingReport() {
  return (
    <RecordList
      modelName="stock"
      title="Stock Aging Report"
      breadcrumbs={[{ label: "Reporting" }]}
      description="Stock age measured from the original receipt date. Age is unaffected by relocation, so consolidating pallets never makes stock look younger than it is."
      baseDomain={cond("quantity", "gt", 0)}
      initialGroupBy={["ageBucket"]}
      initialOrder={[{ field: "ageDays", dir: "desc" }]}
    />
  );
}

// ------------------------------------------------------- pallet presets

export function PartialPalletsList() {
  return (
    <RecordList
      modelName="pallet"
      title="Partially Filled Pallets"
      breadcrumbs={[{ label: "Pallets" }]}
      baseDomain={cond("status", "eq", "partial")}
      description="Pallets holding stock but not a full load, ordered by how much space is left."
      cellRenderers={fillRenderer}
      initialOrder={[{ field: "remainingQty", dir: "desc" }]}
    />
  );
}

export function EmptyPalletsList() {
  return (
    <RecordList
      modelName="pallet"
      title="Empty Pallets"
      breadcrumbs={[{ label: "Pallets" }]}
      baseDomain={or(cond("status", "eq", "empty"), cond("state", "eq", "free"))}
      description="Pallets with no stock, whether still sitting in a rack position or free in the yard."
    />
  );
}

export type { PalletRow };
