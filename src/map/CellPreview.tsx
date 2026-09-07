/**
 * Cell preview panel.
 *
 * Opens when a position is selected on a floor plan or rack elevation. Physical
 * occupancy is kept visually separate from restrictions and reservations,
 * because "there is a pallet here" and "you may not put one here" are different
 * facts that operations planning must not confuse.
 */

import { Link } from "react-router-dom";
import type { CellRow } from "@/data/derive";
import { formatDate } from "@/data/clock";
import { FillBar, formatQty } from "@/odoo/format";
import { Badge } from "@/odoo/primitives";
import { cellStatusLabel } from "./RackElevation";
import { recordUrl } from "@/app/links";

export function CellPreview({
  cell,
  onClose,
  compact,
}: {
  cell: CellRow;
  onClose?: () => void;
  compact?: boolean;
}) {
  return (
    <div className="o-card p-3 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)] uppercase tracking-wide">
            Full address
          </div>
          <div className="font-medium o-truncate" title={cell.completeName}>
            {cell.completeName}
          </div>
        </div>
        {onClose && (
          <button type="button" className="o-btn o-btn-ghost o-btn-sm" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge
          tone={
            cell.blocked
              ? "bad"
              : cell.occupied
                ? "ok"
                : cell.reservedIncoming
                  ? "info"
                  : "neutral"
          }
        >
          {cellStatusLabel(cell)}
        </Badge>
        {cell.palletStatus && (
          <Badge
            tone={
              cell.palletStatus === "full"
                ? "ok"
                : cell.palletStatus === "partial"
                  ? "warn"
                  : "neutral"
            }
          >
            Pallet: {cell.palletStatus}
          </Badge>
        )}
        {cell.reservedIncoming && (
          <Badge tone="info">Destination of a pending operation</Badge>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--o-fs-sm)] m-0">
        <Field label="Warehouse" value={`${cell.warehouseCode} - ${cell.warehouseName}`} />
        <Field label="Aisle" value={cell.aisleCode} />
        <Field
          label="Rack"
          value={
            <Link to={recordUrl.rack(cell.rackId)}>{cell.rackCode}</Link>
          }
        />
        <Field label="Rack profile" value={cell.rackProfile} />
        <Field label="Column / bay" value={String(cell.bay)} />
        <Field label="Row / level" value={cell.level === 0 ? "Ground" : `L${cell.level}`} />
        <Field label="Position rating" value={`${cell.maxWeightKg} kg`} />
        <Field label="Storage category" value={cell.storageCategoryName ?? "-"} />
      </dl>

      {cell.occupied ? (
        <div className="border-t border-[var(--o-border-subtle)] pt-2">
          <div className="text-[var(--o-fs-xxs)] text-[var(--o-text-subtle)] uppercase tracking-wide mb-1">
            Contents
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[var(--o-fs-sm)] m-0">
            <Field
              label="Pallet"
              value={
                cell.palletId ? (
                  <Link to={recordUrl.pallet(cell.palletId)}>{cell.palletName}</Link>
                ) : (
                  "-"
                )
              }
            />
            <Field
              label="Product"
              value={
                cell.productId ? (
                  <Link to={recordUrl.product(cell.productId)}>{cell.productName}</Link>
                ) : (
                  "Empty pallet"
                )
              }
            />
            <Field
              label="Lot"
              value={
                cell.lotId ? <Link to={recordUrl.lot(cell.lotId)}>{cell.lotName}</Link> : "-"
              }
            />
            <Field
              label="Quantity"
              value={cell.quantity ? formatQty(cell.quantity, cell.uom) : "-"}
            />
            <Field
              label="Reserved"
              value={formatQty(cell.reservedQuantity, cell.uom)}
            />
            <Field
              label="Available"
              value={formatQty(cell.availableQuantity, cell.uom)}
            />
            <Field
              label="Pallet capacity"
              value={
                cell.capacityQty ? formatQty(cell.capacityQty, cell.uom) : "-"
              }
            />
            <Field label="Stock in date" value={formatDate(cell.inDate)} />
          </dl>
          {cell.fillPct !== undefined && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
                Pallet fill
              </span>
              <FillBar value={cell.fillPct} width={120} />
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-[var(--o-border-subtle)] pt-2 text-[var(--o-fs-sm)] text-[var(--o-text-muted)]">
          {cell.blocked
            ? `No pallet. This position is blocked: ${cell.blockNote ?? cell.blockReason}.`
            : cell.reservedIncoming
              ? "No pallet yet. A pending operation has this position as its destination, so it is not offered for put-away."
              : "No pallet. This position is available for put-away."}
        </div>
      )}

      {!compact && (
        <div className="flex gap-2 flex-wrap border-t border-[var(--o-border-subtle)] pt-2">
          <Link className="o-btn o-btn-secondary o-btn-sm" to={recordUrl.cell(cell.id)}>
            Open Cell
          </Link>
          {cell.palletId && (
            <Link
              className="o-btn o-btn-secondary o-btn-sm"
              to={recordUrl.pallet(cell.palletId)}
            >
              Open Pallet
            </Link>
          )}
          <Link
            className="o-btn o-btn-secondary o-btn-sm"
            to={`/movements?q=${encodeURIComponent(
              JSON.stringify({
                f: [
                  {
                    id: `ctx:cell:${cell.id}`,
                    type: "context",
                    label: "Location",
                    values: [cell.completeName],
                    domain: {
                      kind: "group",
                      op: "or",
                      children: [
                        { kind: "cond", field: "sourceLocationName", operator: "eq", value: cell.completeName },
                        { kind: "cond", field: "destLocationName", operator: "eq", value: cell.completeName },
                      ],
                    },
                  },
                ],
              }),
            )}`}
          >
            Movement History
          </Link>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-[var(--o-text-muted)] m-0">{label}</dt>
      <dd className="m-0 o-truncate">{value}</dd>
    </>
  );
}
