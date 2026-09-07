/**
 * Catalogue record forms: product and lot.
 *
 * Both connect outward to every pallet, position, stock line and movement that
 * involves them, which is what the SRS means by location-level traceability.
 */

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { contextFacet, listUrl, recordUrl } from "@/app/links";
import { formatDate, formatDateTime } from "@/data/clock";
import { FormView, RelatedTable } from "@/odoo/FormView";
import { FillBar, StateBadge, formatInt, formatQty } from "@/odoo/format";
import { Badge, EmptyState, SmartButton } from "@/odoo/primitives";
import { cond } from "@/query/domain";
import { useAppStore, useDerived } from "@/store/appStore";

const STRATEGY_LABEL: Record<string, string> = {
  fifo: "First In First Out (FIFO)",
  lifo: "Last In First Out (LIFO)",
  closest: "Closest Location",
  least_packages: "Least Packages",
};

export function ProductDetail() {
  const { id = "" } = useParams();
  const derived = useDerived();
  const data = useAppStore((s) => s.data);
  const [tab, setTab] = useState("stock");

  const product = derived.products.find((p) => p.id === id);
  const stock = useMemo(
    () => derived.stock.filter((s) => s.productId === id),
    [derived.stock, id],
  );
  const lots = useMemo(
    () => derived.lots.filter((l) => l.productId === id),
    [derived.lots, id],
  );
  const variants = useMemo(
    () => data.variants.filter((v) => v.productId === id),
    [data.variants, id],
  );
  const movements = useMemo(
    () =>
      derived.movements
        .filter((m) => m.productId === id)
        .sort((a, b) => b.movementDate.localeCompare(a.movementDate))
        .slice(0, 60),
    [derived.movements, id],
  );

  if (!product) return <EmptyState title="Product not found" />;

  const pallets = new Set(stock.map((s) => s.palletId).filter(Boolean));
  const positions = new Set(stock.map((s) => s.locationId));

  return (
    <FormView
      title={product.name}
      subtitle={`${product.code} · ${product.categoryName}`}
      breadcrumbs={[{ label: "Products", to: "/products" }]}
      smartButtons={
        <>
          <SmartButton
            value={formatInt(pallets.size)}
            label="Pallets"
            to={listUrl("pallet", [
              contextFacet("Product", [product.name], cond("productId", "eq", product.id)),
            ])}
          />
          <SmartButton
            value={formatInt(lots.length)}
            label="Lots"
            to={listUrl("lot", [
              contextFacet("Product", [product.name], cond("productId", "eq", product.id)),
            ])}
          />
          <SmartButton
            value={formatInt(positions.size)}
            label="Positions"
            onClick={() => setTab("stock")}
          />
          <SmartButton
            value={formatInt(movements.length)}
            label="Movements"
            to={listUrl("movement", [
              contextFacet("Product", [product.name], cond("productId", "eq", product.id)),
            ])}
          />
          <SmartButton
            value="Analyse"
            label="Dashboard"
            to={`/dashboards/inventory-by-product?product=${product.id}`}
          />
        </>
      }
      fields={[
        { label: "Internal reference", value: product.code },
        { label: "Product category", value: product.categoryName },
        { label: "Material group", value: product.materialGroup },
        { label: "Unit of measure", value: product.uom },
        {
          label: "Pallet capacity",
          value: formatQty(product.capacityQty, product.uom),
          hint: "The explicit full-pallet quantity for this product. Fill percentages are measured against this, never against the 800 kg structural rating of a position.",
        },
        {
          label: "Removal strategy",
          value: STRATEGY_LABEL[product.removalStrategy] ?? product.removalStrategy,
        },
        { label: "Blend grade", value: product.blendGrade ?? "-" },
        { label: "Variants", value: formatInt(product.variantCount) },
        { label: "On hand", value: formatQty(product.onHand, product.uom) },
        { label: "Reserved", value: formatQty(product.reserved, product.uom) },
        { label: "Available", value: formatQty(product.available, product.uom) },
        {
          label: "Oldest stock",
          value:
            product.oldestAgeDays !== undefined
              ? `${formatInt(product.oldestAgeDays)} days`
              : "-",
        },
      ]}
      tabs={[
        {
          id: "stock",
          label: "Stock by position",
          count: stock.length,
          content: (
            <RelatedTable
              columns={[
                { key: "location", label: "Position" },
                { key: "pallet", label: "Pallet" },
                { key: "lot", label: "Lot" },
                { key: "qty", label: "On hand", align: "right" },
                { key: "reserved", label: "Reserved", align: "right" },
                { key: "available", label: "Available", align: "right" },
                { key: "fill", label: "Pallet fill", width: 150 },
                { key: "age", label: "Age", align: "right" },
              ]}
              rows={stock
                .slice()
                .sort((a, b) => a.inDate.localeCompare(b.inDate))
                .map((row) => ({
                  __key: row.id,
                  location: row.completeName,
                  pallet: row.palletId ? (
                    <Link to={recordUrl.pallet(row.palletId)}>{row.palletName}</Link>
                  ) : (
                    "-"
                  ),
                  lot: row.lotId ? <Link to={recordUrl.lot(row.lotId)}>{row.lotName}</Link> : "-",
                  qty: formatQty(row.quantity, row.uom),
                  reserved: formatQty(row.reservedQuantity, row.uom),
                  available: formatQty(row.availableQuantity, row.uom),
                  fill: <FillBar value={row.fillPct} width={90} />,
                  age: `${formatInt(row.ageDays)} d`,
                }))}
              empty="No stock on hand for this product."
            />
          ),
        },
        {
          id: "variants",
          label: "Variants",
          count: variants.length,
          content: (
            <RelatedTable
              columns={[
                { key: "code", label: "Reference" },
                { key: "name", label: "Variant" },
                { key: "attrs", label: "Attributes" },
                { key: "cap", label: "Pallet capacity", align: "right" },
              ]}
              rows={variants.map((variant) => ({
                __key: variant.id,
                code: variant.code,
                name: variant.name,
                attrs: Object.entries(variant.attributes)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(", "),
                cap: formatQty(
                  variant.palletCapacityQty ?? product.capacityQty,
                  product.uom,
                ),
              }))}
            />
          ),
        },
        {
          id: "lots",
          label: "Lots",
          count: lots.length,
          content: (
            <RelatedTable
              columns={[
                { key: "lot", label: "Lot" },
                { key: "received", label: "Received" },
                { key: "age", label: "Age", align: "right" },
                { key: "onhand", label: "On hand", align: "right" },
                { key: "available", label: "Available", align: "right" },
                { key: "pallets", label: "Pallets", align: "right" },
                { key: "warehouses", label: "Warehouses" },
              ]}
              rows={lots
                .slice()
                .sort((a, b) => a.receiptDate.localeCompare(b.receiptDate))
                .map((lot) => ({
                  __key: lot.id,
                  lot: <Link to={recordUrl.lot(lot.id)}>{lot.name}</Link>,
                  received: formatDate(lot.receiptDate),
                  age: `${formatInt(lot.ageDays)} d`,
                  onhand: formatQty(lot.onHand, lot.uom),
                  available: formatQty(lot.available, lot.uom),
                  pallets: formatInt(lot.palletCount),
                  warehouses: lot.warehouseCodes || "-",
                }))}
            />
          ),
        },
        {
          id: "movements",
          label: "Movement history",
          count: movements.length,
          content: (
            <RelatedTable
              columns={[
                { key: "date", label: "Date" },
                { key: "ref", label: "Operation" },
                { key: "kind", label: "Type" },
                { key: "lot", label: "Lot" },
                { key: "from", label: "From" },
                { key: "to", label: "To" },
                { key: "qty", label: "Quantity", align: "right" },
                { key: "state", label: "Status" },
              ]}
              rows={movements.map((row) => ({
                __key: row.id,
                date: formatDateTime(row.movementDate),
                ref: <Link to={recordUrl.operation(row.operationId)}>{row.operationName}</Link>,
                kind: row.kind,
                lot: row.lotName ?? "-",
                from: row.sourceLocationName,
                to: row.destLocationName,
                qty: formatQty(row.doneQty || row.quantity, row.uom),
                state: <StateBadge value={row.state} />,
              }))}
              empty="No movements recorded for this product."
            />
          ),
        },
      ]}
      activeTab={tab}
      onTab={setTab}
    />
  );
}

export function LotDetail() {
  const { id = "" } = useParams();
  const derived = useDerived();
  const [tab, setTab] = useState("stock");

  const lot = derived.lots.find((l) => l.id === id);
  const stock = useMemo(
    () => derived.stock.filter((s) => s.lotId === id),
    [derived.stock, id],
  );
  const movements = useMemo(
    () =>
      derived.movements
        .filter((m) => m.lotId === id)
        .sort((a, b) => b.movementDate.localeCompare(a.movementDate)),
    [derived.movements, id],
  );

  if (!lot) return <EmptyState title="Lot not found" />;

  const receipt = movements.find((m) => m.kind === "receipt");

  return (
    <FormView
      title={lot.name}
      subtitle={`${lot.productName} · received ${formatDate(lot.receiptDate)}`}
      breadcrumbs={[{ label: "Lots", to: "/lots" }]}
      smartButtons={
        <>
          <SmartButton
            value={formatInt(lot.palletCount)}
            label="Pallets"
            to={listUrl("pallet", [
              contextFacet("Lot", [lot.name], cond("lotId", "eq", lot.id)),
            ])}
          />
          <SmartButton value={formatInt(lot.locationCount)} label="Positions" onClick={() => setTab("stock")} />
          <SmartButton
            value={formatInt(movements.length)}
            label="Movements"
            onClick={() => setTab("movements")}
          />
          <SmartButton value="1" label="Product" to={recordUrl.product(lot.productId)} />
          <SmartButton
            value="Trace"
            label="Dashboard"
            to={`/dashboards/inventory-by-lot?lot=${lot.id}`}
          />
        </>
      }
      fields={[
        { label: "Lot / serial", value: lot.name },
        {
          label: "Product",
          value: <Link to={recordUrl.product(lot.productId)}>{lot.productName}</Link>,
        },
        { label: "Variant", value: lot.variantName },
        { label: "Material group", value: lot.materialGroup },
        {
          label: "Receipt date",
          value: formatDate(lot.receiptDate),
          hint: "The original receipt. Relocating stock never rewrites it, so stock age stays honest.",
        },
        { label: "Stock age", value: `${formatInt(lot.ageDays)} days (${lot.ageBucket})` },
        { label: "Supplier", value: lot.supplierRef ?? "-" },
        { label: "Origin", value: lot.origin ?? "-" },
        { label: "Garden mark", value: lot.gardenMark ?? "-" },
        { label: "On hand", value: formatQty(lot.onHand, lot.uom) },
        { label: "Reserved", value: formatQty(lot.reserved, lot.uom) },
        { label: "Available", value: formatQty(lot.available, lot.uom) },
        { label: "Warehouses", value: lot.warehouseCodes || "-" },
        {
          label: "Original receipt operation",
          value: receipt ? (
            <Link to={recordUrl.operation(receipt.operationId)}>{receipt.operationName}</Link>
          ) : (
            <Badge tone="neutral">Opening balance</Badge>
          ),
        },
      ]}
      tabs={[
        {
          id: "stock",
          label: "Pallets and positions",
          count: stock.length,
          content: (
            <RelatedTable
              columns={[
                { key: "pallet", label: "Pallet" },
                { key: "location", label: "Position" },
                { key: "qty", label: "On hand", align: "right" },
                { key: "reserved", label: "Reserved", align: "right" },
                { key: "available", label: "Available", align: "right" },
                { key: "fill", label: "Pallet fill", width: 150 },
              ]}
              rows={stock.map((row) => ({
                __key: row.id,
                pallet: row.palletId ? (
                  <Link to={recordUrl.pallet(row.palletId)}>{row.palletName}</Link>
                ) : (
                  "-"
                ),
                location: row.completeName,
                qty: formatQty(row.quantity, row.uom),
                reserved: formatQty(row.reservedQuantity, row.uom),
                available: formatQty(row.availableQuantity, row.uom),
                fill: <FillBar value={row.fillPct} width={90} />,
              }))}
              empty="This lot holds no stock. Its movement history still shows what happened to it."
            />
          ),
        },
        {
          id: "movements",
          label: "Movement history",
          count: movements.length,
          content: (
            <RelatedTable
              columns={[
                { key: "date", label: "Date" },
                { key: "ref", label: "Operation" },
                { key: "kind", label: "Type" },
                { key: "pallet", label: "Pallet" },
                { key: "from", label: "From" },
                { key: "to", label: "To" },
                { key: "qty", label: "Quantity", align: "right" },
                { key: "state", label: "Status" },
              ]}
              rows={movements.map((row) => ({
                __key: row.id,
                date: formatDateTime(row.movementDate),
                ref: <Link to={recordUrl.operation(row.operationId)}>{row.operationName}</Link>,
                kind: row.kind,
                pallet: row.palletId ? (
                  <Link to={recordUrl.pallet(row.palletId)}>{row.palletName}</Link>
                ) : (
                  "-"
                ),
                from: row.sourceLocationName,
                to: row.destLocationName,
                qty: formatQty(row.doneQty || row.quantity, row.uom),
                state: <StateBadge value={row.state} />,
              }))}
              empty="No movements recorded. This lot arrived as part of the opening balance."
            />
          ),
        },
      ]}
      activeTab={tab}
      onTab={setTab}
    />
  );
}
