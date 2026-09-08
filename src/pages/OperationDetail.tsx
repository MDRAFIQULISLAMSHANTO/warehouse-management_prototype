/**
 * Operation form.
 *
 * The Odoo transfer flow, working: Check Availability reserves stock, Validate
 * moves it, a short delivery asks whether to create a back order or cancel the
 * remainder, and cancelling releases reservations. Draft operations never touch
 * stock, and validating twice does nothing the second time.
 */

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DEMO_NOW_ISO, formatDate, formatDateTime } from "@/data/clock";
import { FormView, RelatedTable } from "@/odoo/FormView";
import { StateBadge, formatQty } from "@/odoo/format";
import { Badge, Dialog, EmptyState, SmartButton } from "@/odoo/primitives";
import { useAppStore, useDerived } from "@/store/appStore";
import type { RemainderChoice, ValidateLineInput } from "@/store/actions";

const STEPS = [
  { id: "draft", label: "Draft" },
  { id: "waiting", label: "Waiting" },
  { id: "ready", label: "Ready" },
  { id: "done", label: "Done" },
];

const KIND_LABEL: Record<string, string> = {
  receipt: "Receipt",
  putaway: "Put-Away",
  internal: "Internal Transfer",
  pick: "Pick",
  delivery: "Delivery",
};

export function OperationDetail() {
  const { id = "" } = useParams();
  const derived = useDerived();
  const data = useAppStore((s) => s.data);
  const dispatch = useAppStore((s) => s.dispatch);

  const [tab, setTab] = useState("lines");
  const [validateOpen, setValidateOpen] = useState(false);

  const operation = derived.operations.find((o) => o.id === id);
  const raw = data.operations.find((o) => o.id === id);

  const moves = useMemo(
    () => data.moves.filter((m) => m.operationId === id),
    [data.moves, id],
  );
  const lines = useMemo(
    () => data.moveLines.filter((l) => l.operationId === id),
    [data.moveLines, id],
  );
  const movementRows = useMemo(
    () => derived.movements.filter((m) => m.operationId === id),
    [derived.movements, id],
  );

  if (!operation || !raw) {
    return <EmptyState title="Operation not found" hint="It may have been reset." />;
  }

  const isOpen = raw.state !== "done" && raw.state !== "cancel";
  const backorders = derived.operations.filter((o) => o.backorderOfId === id);
  const origin = raw.originOperationId
    ? derived.operations.find((o) => o.id === raw.originOperationId)
    : undefined;

  const locName = (locId: string) =>
    data.locations.find((l) => l.id === locId)?.completeName ?? locId;
  const productName = (productId: string) =>
    data.products.find((p) => p.id === productId)?.name ?? productId;
  const lotName = (lotId: string | null) =>
    lotId ? (data.lots.find((l) => l.id === lotId)?.name ?? lotId) : "-";
  const palletName = (palletId: string | null) =>
    palletId ? (data.pallets.find((p) => p.id === palletId)?.name ?? palletId) : "-";

  const reservedFor = (lineId: string) =>
    data.reservations
      .filter((r) => r.moveLineId === lineId)
      .reduce((s, r) => s + r.quantity, 0);

  /**
   * Which buttons to offer is decided from the operation's own numbers, not
   * from its state label.
   *
   * Deciding from the label alone stranded operations: Check Availability was
   * hidden whenever the state read "Ready", and Validate was hidden whenever
   * there were no detailed operations, so anything marked Ready with nothing
   * reserved offered neither button and could not be progressed at all.
   */
  const totalDemand = moves.reduce((sum, m) => sum + m.demandQty, 0);
  const totalReserved = lines.reduce((sum, l) => sum + reservedFor(l.id), 0);
  const hasUnreservedDemand = totalReserved < totalDemand - 0.0001;

  const actions = (
    <>
      {isOpen && hasUnreservedDemand && (
        <button
          type="button"
          className="o-btn o-btn-primary"
          onClick={() =>
            dispatch({ type: "check_availability", operationId: id, at: DEMO_NOW_ISO })
          }
          title={
            lines.length === 0
              ? "Find stock for this demand and reserve it."
              : "Try to reserve the demand that is still unreserved."
          }
        >
          Check Availability
        </button>
      )}
      {isOpen && lines.length > 0 && (
        <button
          type="button"
          className="o-btn o-btn-primary"
          onClick={() => setValidateOpen(true)}
        >
          Validate
        </button>
      )}
      {isOpen && (
        <button
          type="button"
          className="o-btn o-btn-secondary"
          onClick={() => dispatch({ type: "cancel", operationId: id, at: DEMO_NOW_ISO })}
        >
          Cancel
        </button>
      )}
      {isOpen && raw.state !== "draft" && (
        <button
          type="button"
          className="o-btn o-btn-secondary"
          onClick={() => dispatch({ type: "set_draft", operationId: id, at: DEMO_NOW_ISO })}
        >
          Set to Draft
        </button>
      )}
    </>
  );

  const statusDone = STEPS.slice(
    0,
    Math.max(0, STEPS.findIndex((s) => s.id === raw.state)),
  ).map((s) => s.id);

  return (
    <>
      <FormView
        title={operation.name}
        subtitle={`${KIND_LABEL[operation.kind]} · ${operation.warehouseName}`}
        breadcrumbs={[{ label: "Operations", to: "/operations" }]}
        actions={actions}
        statusSteps={STEPS}
        statusActive={raw.state === "cancel" ? undefined : raw.state}
        statusDone={statusDone}
        banner={
          raw.state === "cancel" ? (
            <div className="max-w-[1500px] mx-auto mb-3 px-3 py-2 rounded-[var(--o-radius-md)] bg-[var(--o-danger-bg)] text-[var(--o-fs-sm)]">
              This operation was cancelled. Its reservations were released; no
              stock moved.
            </div>
          ) : raw.state === "done" ? (
            <div className="max-w-[1500px] mx-auto mb-3 px-3 py-2 rounded-[var(--o-radius-md)] bg-[var(--o-success-bg)] text-[var(--o-fs-sm)]">
              Validated on {formatDateTime(raw.effectiveAt)}. Stock, locations and
              movement history are updated. Validating again does nothing.
            </div>
          ) : undefined
        }
        smartButtons={
          <>
            <SmartButton
              value={moves.length}
              label="Demand lines"
              onClick={() => setTab("lines")}
            />
            <SmartButton
              value={movementRows.filter((m) => m.state === "done").length}
              label="Movements"
              onClick={() => setTab("movements")}
            />
            {backorders.length > 0 && (
              <SmartButton
                value={backorders.length}
                label="Back orders"
                to={`/operations/${backorders[0].id}`}
              />
            )}
            {origin && (
              <SmartButton value="1" label="Source operation" to={`/operations/${origin.id}`} />
            )}
          </>
        }
        fields={[
          { label: "Status", value: <StateBadge value={raw.state} /> },
          { label: "Operation type", value: operation.typeName },
          { label: "Warehouse", value: operation.warehouseName },
          { label: "Source location", value: operation.sourceLocationName },
          { label: "Destination", value: operation.destLocationName },
          { label: "Partner", value: operation.partnerName ?? "-" },
          { label: "Operator", value: operation.operatorName ?? "-" },
          { label: "Source document", value: operation.sourceDocument ?? "-" },
          { label: "Scheduled", value: formatDateTime(operation.scheduledAt) },
          { label: "Created", value: formatDateTime(operation.createdAt) },
          {
            label: "Effective",
            value: operation.effectiveAt ? formatDateTime(operation.effectiveAt) : "-",
          },
          {
            label: "Lot selection",
            value: operation.manualLotSelection ? (
              <Badge tone="brand">
                Manual{operation.blendRef ? ` · ${operation.blendRef}` : ""}
              </Badge>
            ) : (
              "By removal strategy"
            ),
            hint: "Manual selection records an authorised user choosing lots against an approved blend requirement. No blend sheet is generated in this prototype.",
          },
        ]}
        tabs={[
          {
            id: "lines",
            label: "Operation lines",
            count: moves.length,
            content: (
              <RelatedTable
                columns={[
                  { key: "product", label: "Product" },
                  { key: "lot", label: "Lot" },
                  { key: "pallet", label: "Pallet" },
                  { key: "from", label: "From" },
                  { key: "to", label: "To" },
                  { key: "demand", label: "Demand", align: "right" },
                  { key: "reserved", label: "Reserved", align: "right" },
                  { key: "done", label: "Done", align: "right" },
                ]}
                rows={moves.map((move) => {
                  const moveLines = lines.filter((l) => l.moveId === move.id);
                  const reserved = moveLines.reduce(
                    (s, l) => s + reservedFor(l.id),
                    0,
                  );
                  return {
                    __key: move.id,
                    product: (
                      <Link to={`/products/${move.productId}`}>
                        {productName(move.productId)}
                      </Link>
                    ),
                    lot: moveLines.map((l) => lotName(l.lotId)).join(", ") || "-",
                    pallet:
                      moveLines
                        .map((l) => palletName(l.sourcePalletId ?? l.destPalletId))
                        .join(", ") || "-",
                    from: locName(move.sourceLocationId),
                    to: locName(move.destLocationId),
                    demand: formatQty(move.demandQty, move.uom),
                    reserved: formatQty(reserved, move.uom),
                    done: formatQty(move.doneQty, move.uom),
                  };
                })}
                empty="No demand lines. Run Check Availability to build them from stock."
              />
            ),
          },
          {
            id: "detail",
            label: "Detailed operations",
            count: lines.length,
            content: (
              <RelatedTable
                columns={[
                  { key: "product", label: "Product" },
                  { key: "lot", label: "Lot" },
                  { key: "src", label: "From position" },
                  { key: "srcPallet", label: "From pallet" },
                  { key: "dst", label: "To position" },
                  { key: "dstPallet", label: "To pallet" },
                  { key: "qty", label: "Quantity", align: "right" },
                  { key: "done", label: "Done", align: "right" },
                ]}
                rows={lines.map((line) => ({
                  __key: line.id,
                  product: productName(line.productId),
                  lot: lotName(line.lotId),
                  src: locName(line.sourceLocationId),
                  srcPallet: palletName(line.sourcePalletId),
                  dst: locName(line.destLocationId),
                  dstPallet: palletName(line.destPalletId),
                  qty: formatQty(line.quantity, line.uom),
                  done: formatQty(line.doneQty, line.uom),
                }))}
                empty="No detailed lines yet."
              />
            ),
          },
          {
            id: "movements",
            label: "Movement history",
            count: movementRows.filter((m) => m.state === "done").length,
            content: (
              <RelatedTable
                columns={[
                  { key: "date", label: "Completed" },
                  { key: "product", label: "Product" },
                  { key: "lot", label: "Lot" },
                  { key: "from", label: "From" },
                  { key: "to", label: "To" },
                  { key: "qty", label: "Quantity", align: "right" },
                ]}
                rows={movementRows
                  .filter((m) => m.state === "done")
                  .map((m) => ({
                    __key: m.id,
                    date: formatDateTime(m.doneAt),
                    product: m.productName,
                    lot: m.lotName ?? "-",
                    from: m.sourceLocationName,
                    to: m.destLocationName,
                    qty: formatQty(m.doneQty, m.uom),
                  }))}
                empty="Nothing has been validated on this operation yet."
              />
            ),
          },
          {
            id: "note",
            label: "Notes",
            content: (
              <p className="text-[var(--o-fs-sm)] m-0">
                {operation.note ?? "No note recorded."}
              </p>
            ),
          },
        ]}
        activeTab={tab}
        onTab={setTab}
      />

      {validateOpen && (
        <ValidateDialog
          lines={lines.map((line) => ({
            id: line.id,
            label: `${productName(line.productId)} · ${lotName(line.lotId)}`,
            from: locName(line.sourceLocationId),
            to: locName(line.destLocationId),
            demand: line.quantity,
            uom: line.uom,
          }))}
          onClose={() => setValidateOpen(false)}
          onConfirm={(inputs, remainder) => {
            dispatch({
              type: "validate",
              operationId: id,
              lines: inputs,
              remainder,
              at: DEMO_NOW_ISO,
            });
            setValidateOpen(false);
          }}
        />
      )}
    </>
  );
}

function ValidateDialog({
  lines,
  onClose,
  onConfirm,
}: {
  lines: {
    id: string;
    label: string;
    from: string;
    to: string;
    demand: number;
    uom: string;
  }[];
  onClose: () => void;
  onConfirm: (inputs: ValidateLineInput[], remainder: RemainderChoice) => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.id, String(l.demand)])),
  );
  const [remainder, setRemainder] = useState<RemainderChoice>("backorder");

  const inputs: ValidateLineInput[] = lines.map((line) => ({
    lineId: line.id,
    doneQty: Math.max(0, Math.min(Number(quantities[line.id]) || 0, line.demand)),
  }));

  const short = inputs.some((input, i) => input.doneQty < lines[i].demand - 0.0001);

  return (
    <Dialog
      title="Validate operation"
      width={720}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="o-btn o-btn-secondary" onClick={onClose}>
            Discard
          </button>
          <button
            type="button"
            className="o-btn o-btn-primary"
            onClick={() => onConfirm(inputs, remainder)}
          >
            Validate
          </button>
        </>
      }
    >
      <p className="mt-0 text-[var(--o-fs-sm)] text-[var(--o-text-muted)]">
        Record what was actually handled. Reducing a quantity performs a partial
        transfer.
      </p>
      <table className="o-list">
        <thead>
          <tr>
            <th>Line</th>
            <th>From</th>
            <th>To</th>
            <th style={{ textAlign: "right" }}>Demand</th>
            <th style={{ textAlign: "right", width: 140 }}>Done</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td className="o-truncate">{line.label}</td>
              <td className="o-truncate">{line.from}</td>
              <td className="o-truncate">{line.to}</td>
              <td className="num">{formatQty(line.demand, line.uom)}</td>
              <td>
                <input
                  className="o-input text-right"
                  type="number"
                  min={0}
                  max={line.demand}
                  step="0.01"
                  value={quantities[line.id] ?? ""}
                  onChange={(e) =>
                    setQuantities((prev) => ({ ...prev, [line.id]: e.target.value }))
                  }
                  aria-label={`Done quantity for ${line.label}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {short && (
        <fieldset className="mt-3 border border-[var(--o-border)] rounded-[var(--o-radius)] p-3">
          <legend className="text-[var(--o-fs-sm)] font-medium px-1">
            Some quantity is not being processed
          </legend>
          <label className="flex items-start gap-2 text-[var(--o-fs-sm)] mb-1.5">
            <input
              type="radio"
              name="remainder"
              checked={remainder === "backorder"}
              onChange={() => setRemainder("backorder")}
            />
            <span>
              <strong>Create a back order.</strong> A new operation carries the
              remaining demand so it stays visible and can be completed later.
            </span>
          </label>
          <label className="flex items-start gap-2 text-[var(--o-fs-sm)]">
            <input
              type="radio"
              name="remainder"
              checked={remainder === "cancel"}
              onChange={() => setRemainder("cancel")}
            />
            <span>
              <strong>Cancel the remaining demand.</strong> Closes the paperwork
              only - stock that was never moved stays exactly where it is.
            </span>
          </label>
        </fieldset>
      )}
    </Dialog>
  );
}

export { formatDate };
