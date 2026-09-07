/**
 * Physical record forms: pallet, cell, rack and warehouse.
 *
 * The pallet form is where the demonstration's warehouse operations start: pick
 * a quantity from it, or relocate it to a suggested compatible position. Both
 * create a real operation that then has to be validated, exactly as in Odoo.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { recordUrl } from "@/app/links";
import { DEMO_NOW_ISO, formatDate, formatDateTime } from "@/data/clock";
import { FormView, RelatedTable } from "@/odoo/FormView";
import { FillBar, StateBadge, formatInt, formatPct, formatQty } from "@/odoo/format";
import { Badge, Dialog, EmptyState, SmartButton } from "@/odoo/primitives";
import { CellPreview } from "@/map/CellPreview";
import { FloorPlan } from "@/map/FloorPlan";
import { ElevationLegend, RackElevation, cellStatusLabel } from "@/map/RackElevation";
import { suggestCells, suggestConsolidation } from "@/store/apply";
import { useAppStore, useDerived } from "@/store/appStore";

let opSeq = 0;
const newOperationId = () => `op_ui_${Date.now().toString(36)}_${(opSeq += 1)}`;

// ------------------------------------------------------------------ pallet

export function PalletDetail() {
  const { id = "" } = useParams();
  const derived = useDerived();
  const data = useAppStore((s) => s.data);
  const dispatch = useAppStore((s) => s.dispatch);
  const navigate = useNavigate();

  const [tab, setTab] = useState("contents");
  const [pickOpen, setPickOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

  const pallet = derived.pallets.find((p) => p.id === id);
  const cell = pallet?.locationId
    ? derived.cells.find((c) => c.id === pallet.locationId)
    : undefined;

  const stock = useMemo(
    () => derived.stock.filter((s) => s.palletId === id),
    [derived.stock, id],
  );
  const history = useMemo(
    () =>
      derived.movements
        .filter((m) => m.palletId === id)
        .sort((a, b) => b.movementDate.localeCompare(a.movementDate)),
    [derived.movements, id],
  );
  const consolidation = useMemo(
    () => (pallet?.status === "partial" ? suggestConsolidation(data, id, 6) : []),
    [data, id, pallet?.status],
  );

  if (!pallet) {
    return <EmptyState title="Pallet not found" hint="It may have been reset." />;
  }

  const canPick = pallet.availableQuantity > 0;
  const canMove = !!pallet.locationId;

  return (
    <>
      <FormView
        title={pallet.name}
        subtitle={
          pallet.completeName
            ? `${pallet.packageTypeName} · ${pallet.completeName}`
            : `${pallet.packageTypeName} · not in a rack position`
        }
        breadcrumbs={[{ label: "Pallets", to: "/pallets" }]}
        actions={
          <>
            <button
              type="button"
              className="o-btn o-btn-primary"
              disabled={!canPick}
              onClick={() => setPickOpen(true)}
              title={canPick ? undefined : "Nothing available to pick from this pallet"}
            >
              Pick from this pallet
            </button>
            <button
              type="button"
              className="o-btn o-btn-secondary"
              disabled={!canMove}
              onClick={() => setMoveOpen(true)}
            >
              Relocate pallet
            </button>
          </>
        }
        smartButtons={
          <>
            <SmartButton value={stock.length} label="Stock lines" onClick={() => setTab("contents")} />
            <SmartButton value={history.length} label="Movements" onClick={() => setTab("history")} />
            {pallet.productId && (
              <SmartButton value="1" label="Product" to={recordUrl.product(pallet.productId)} />
            )}
            {pallet.lotId && (
              <SmartButton value="1" label="Lot" to={recordUrl.lot(pallet.lotId)} />
            )}
            {cell && <SmartButton value="1" label="Position" to={recordUrl.cell(cell.id)} />}
          </>
        }
        fields={[
          {
            label: "Pallet status",
            value: (
              <Badge
                tone={
                  pallet.status === "full"
                    ? "ok"
                    : pallet.status === "partial"
                      ? "warn"
                      : "neutral"
                }
              >
                {pallet.status === "full"
                  ? "Full"
                  : pallet.status === "partial"
                    ? "Partially filled"
                    : "Empty"}
              </Badge>
            ),
          },
          { label: "Physical state", value: pallet.state },
          { label: "Package type", value: pallet.packageTypeName },
          {
            label: "Location",
            value: cell ? (
              <Link to={recordUrl.cell(cell.id)}>{pallet.completeName}</Link>
            ) : (
              pallet.completeName ?? "Not in a rack position"
            ),
          },
          { label: "Warehouse", value: pallet.warehouseName ?? "-" },
          {
            label: "Rack",
            value: pallet.rackId ? (
              <Link to={recordUrl.rack(pallet.rackId)}>{pallet.rackCode}</Link>
            ) : (
              "-"
            ),
          },
          { label: "Column / bay", value: pallet.bay !== undefined ? String(pallet.bay) : "-" },
          {
            label: "Row / level",
            value: pallet.level !== undefined ? (pallet.level === 0 ? "Ground" : `L${pallet.level}`) : "-",
          },
          {
            label: "Product",
            value: pallet.productId ? (
              <Link to={recordUrl.product(pallet.productId)}>{pallet.productName}</Link>
            ) : (
              "Empty pallet"
            ),
          },
          {
            label: "Lot",
            value: pallet.lotId ? (
              <Link to={recordUrl.lot(pallet.lotId)}>{pallet.lotName}</Link>
            ) : (
              "-"
            ),
          },
          { label: "On hand", value: formatQty(pallet.quantity, pallet.uom) },
          { label: "Reserved", value: formatQty(pallet.reservedQuantity, pallet.uom) },
          { label: "Available", value: formatQty(pallet.availableQuantity, pallet.uom) },
          {
            label: "Pallet capacity",
            value: pallet.capacityQty ? formatQty(pallet.capacityQty, pallet.uom) : "-",
            hint: "Explicit full-pallet quantity for this product or variant. This is the basis for Fill %, not the 800 kg structural rating of the position.",
          },
          {
            label: "Remaining capacity",
            value: pallet.remainingQty !== undefined ? formatQty(pallet.remainingQty, pallet.uom) : "-",
          },
          {
            label: "Fill",
            value: <FillBar value={pallet.fillPct} width={120} />,
          },
          { label: "Stock in date", value: pallet.inDate ? formatDate(pallet.inDate) : "-" },
          {
            label: "Stock age",
            value: pallet.ageDays !== undefined ? `${formatInt(pallet.ageDays)} days` : "-",
            hint: "Measured from the original receipt date. Relocating the pallet does not reset it.",
          },
        ]}
        tabs={[
          {
            id: "contents",
            label: "Contents",
            count: stock.length,
            content: (
              <RelatedTable
                columns={[
                  { key: "product", label: "Product" },
                  { key: "lot", label: "Lot" },
                  { key: "qty", label: "On hand", align: "right" },
                  { key: "reserved", label: "Reserved", align: "right" },
                  { key: "available", label: "Available", align: "right" },
                  { key: "fill", label: "Fill", width: 150 },
                  { key: "in", label: "In date" },
                ]}
                rows={stock.map((row) => ({
                  __key: row.id,
                  product: <Link to={recordUrl.product(row.productId)}>{row.productName}</Link>,
                  lot: row.lotId ? <Link to={recordUrl.lot(row.lotId)}>{row.lotName}</Link> : "-",
                  qty: formatQty(row.quantity, row.uom),
                  reserved: formatQty(row.reservedQuantity, row.uom),
                  available: formatQty(row.availableQuantity, row.uom),
                  fill: <FillBar value={row.fillPct} width={90} />,
                  in: formatDate(row.inDate),
                }))}
                empty="This pallet is empty. It keeps its identity and still occupies its position until it is removed or relocated."
              />
            ),
          },
          {
            id: "history",
            label: "Movement history",
            count: history.length,
            content: (
              <RelatedTable
                columns={[
                  { key: "date", label: "Date" },
                  { key: "ref", label: "Operation" },
                  { key: "kind", label: "Type" },
                  { key: "from", label: "From" },
                  { key: "to", label: "To" },
                  { key: "qty", label: "Quantity", align: "right" },
                  { key: "state", label: "Status" },
                ]}
                rows={history.map((row) => ({
                  __key: row.id,
                  date: formatDateTime(row.movementDate),
                  ref: <Link to={recordUrl.operation(row.operationId)}>{row.operationName}</Link>,
                  kind: row.kind,
                  from: row.sourceLocationName,
                  to: row.destLocationName,
                  qty: formatQty(row.doneQty || row.quantity, row.uom),
                  state: <StateBadge value={row.state} />,
                }))}
                empty="No recorded movements. This pallet was part of the opening balance loaded before the demonstration window."
              />
            ),
          },
          {
            id: "consolidation",
            label: "Consolidation",
            count: consolidation.length,
            content:
              pallet.status !== "partial" ? (
                <p className="text-[var(--o-fs-sm)] m-0 text-[var(--o-text-muted)]">
                  Consolidation applies to partially filled pallets only.
                </p>
              ) : (
                <>
                  <RelatedTable
                    columns={[
                      { key: "pallet", label: "Target pallet" },
                      { key: "location", label: "Position" },
                      { key: "remaining", label: "Room available", align: "right" },
                      { key: "fill", label: "Current fill", align: "right" },
                    ]}
                    rows={consolidation.map((candidate) => ({
                      __key: candidate.palletId,
                      pallet: (
                        <Link to={recordUrl.pallet(candidate.palletId)}>
                          {candidate.palletName}
                        </Link>
                      ),
                      location: candidate.completeName,
                      remaining: formatQty(candidate.remaining, candidate.uom),
                      fill: formatPct(candidate.fillPct),
                    }))}
                    empty="No compatible pallet found under the conservative rule."
                  />
                  <p className="mt-2 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
                    Rule: same product, same variant, same lot, and enough
                    remaining capacity to absorb this pallet's whole quantity.
                  </p>
                </>
              ),
          },
        ]}
        activeTab={tab}
        onTab={setTab}
      />

      {pickOpen && (
        <PickDialog
          pallet={pallet}
          onClose={() => setPickOpen(false)}
          onConfirm={(quantity, manual) => {
            const operationId = newOperationId();
            const result = dispatch({
              type: "create_pick",
              operationId,
              palletId: pallet.id,
              quantity,
              operatorId: data.operators[0].id,
              manualLotSelection: manual,
              at: DEMO_NOW_ISO,
            });
            setPickOpen(false);
            if (result.ok && result.createdOperationId) {
              navigate(recordUrl.operation(result.createdOperationId));
            }
          }}
        />
      )}

      {moveOpen && (
        <RelocateDialog
          palletId={pallet.id}
          onClose={() => setMoveOpen(false)}
          onConfirm={(destLocationId) => {
            const operationId = newOperationId();
            const result = dispatch({
              type: "create_relocation",
              operationId,
              palletId: pallet.id,
              destLocationId,
              operatorId: data.operators[0].id,
              at: DEMO_NOW_ISO,
            });
            setMoveOpen(false);
            if (result.ok && result.createdOperationId) {
              navigate(recordUrl.operation(result.createdOperationId));
            }
          }}
        />
      )}
    </>
  );
}

function PickDialog({
  pallet,
  onClose,
  onConfirm,
}: {
  pallet: { availableQuantity: number; uom?: string; name: string; productName?: string };
  onClose: () => void;
  onConfirm: (quantity: number, manual: boolean) => void;
}) {
  const [quantity, setQuantity] = useState(String(pallet.availableQuantity));
  const [manual, setManual] = useState(false);
  const value = Number(quantity) || 0;
  const valid = value > 0 && value <= pallet.availableQuantity + 0.0001;

  return (
    <Dialog
      title={`Pick from ${pallet.name}`}
      width={520}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="o-btn o-btn-secondary" onClick={onClose}>
            Discard
          </button>
          <button
            type="button"
            className="o-btn o-btn-primary"
            disabled={!valid}
            onClick={() => onConfirm(value, manual)}
          >
            Create pick
          </button>
        </>
      }
    >
      <p className="mt-0 text-[var(--o-fs-sm)]">
        {pallet.productName} · available {formatQty(pallet.availableQuantity, pallet.uom)}
      </p>
      <label className="block">
        <span className="block text-[var(--o-fs-xs)] mb-1">
          Quantity to pick ({pallet.uom})
        </span>
        <input
          className="o-input"
          type="number"
          min={0}
          max={pallet.availableQuantity}
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          autoFocus
        />
      </label>
      {!valid && (
        <p className="mt-1 mb-0 text-[var(--o-fs-xs)] text-[var(--o-danger-text)]">
          Enter a quantity between 0 and {formatQty(pallet.availableQuantity, pallet.uom)}.
          Picking beyond what is available is not permitted.
        </p>
      )}
      <label className="flex items-start gap-2 mt-3 text-[var(--o-fs-sm)]">
        <input
          type="checkbox"
          checked={manual}
          onChange={(e) => setManual(e.target.checked)}
        />
        <span>
          Record this as a <strong>manual lot selection</strong> against an
          approved blend requirement (SRS REQ-BLD-002). No blend sheet is
          generated.
        </span>
      </label>
      <p className="mt-3 mb-0 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
        This creates a Ready pick and reserves the quantity. Stock only moves when
        the operation is validated.
      </p>
    </Dialog>
  );
}

function RelocateDialog({
  palletId,
  onClose,
  onConfirm,
}: {
  palletId: string;
  onClose: () => void;
  onConfirm: (destLocationId: string) => void;
}) {
  const data = useAppStore((s) => s.data);
  const suggestions = useMemo(() => suggestCells(data, palletId, 10), [data, palletId]);
  const [selected, setSelected] = useState(suggestions[0]?.locationId ?? "");

  return (
    <Dialog
      title="Relocate pallet"
      width={760}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="o-btn o-btn-secondary" onClick={onClose}>
            Discard
          </button>
          <button
            type="button"
            className="o-btn o-btn-primary"
            disabled={!selected}
            onClick={() => onConfirm(selected)}
          >
            Create internal transfer
          </button>
        </>
      }
    >
      {suggestions.length === 0 ? (
        <EmptyState
          title="No compatible destination available"
          hint="Every other position is occupied, blocked, already reserved by a pending operation, or incompatible with this product."
        />
      ) : (
        <>
          <table className="o-list">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Suggested position</th>
                <th>Why it qualifies</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((suggestion) => (
                <tr key={suggestion.locationId}>
                  <td>
                    <input
                      type="radio"
                      name="destination"
                      checked={selected === suggestion.locationId}
                      onChange={() => setSelected(suggestion.locationId)}
                      aria-label={suggestion.completeName}
                    />
                  </td>
                  <td className="font-medium">{suggestion.completeName}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {suggestion.reasons.map((reason) => (
                        <Badge key={reason} tone="neutral">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 mb-0 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
            Ranking is a documented proximity and accessibility heuristic - same
            warehouse, aisle and rack score higher, ground positions score higher
            - not a measured forklift route. Creating the transfer claims the
            destination so no other pending operation can take it.
          </p>
        </>
      )}
    </Dialog>
  );
}

// -------------------------------------------------------------------- cell

export function CellDetail() {
  const { id = "" } = useParams();
  const derived = useDerived();
  const [tab, setTab] = useState("preview");

  const cell = derived.cells.find((c) => c.id === id);
  const rack = cell ? derived.racks.find((r) => r.id === cell.rackId) : undefined;
  const rackCells = useMemo(
    () => (cell ? derived.cells.filter((c) => c.rackId === cell.rackId) : []),
    [derived.cells, cell],
  );
  const history = useMemo(
    () =>
      derived.movements
        .filter(
          (m) =>
            m.sourceLocationName === cell?.completeName ||
            m.destLocationName === cell?.completeName,
        )
        .sort((a, b) => b.movementDate.localeCompare(a.movementDate)),
    [derived.movements, cell],
  );

  if (!cell) return <EmptyState title="Position not found" />;

  return (
    <FormView
      title={cell.completeName}
      subtitle={cellStatusLabel(cell)}
      breadcrumbs={[
        { label: "Locations", to: "/locations/cells" },
        ...(rack ? [{ label: rack.code, to: recordUrl.rack(rack.id) }] : []),
      ]}
      smartButtons={
        <>
          {cell.palletId && (
            <SmartButton value="1" label="Pallet" to={recordUrl.pallet(cell.palletId)} />
          )}
          {cell.productId && (
            <SmartButton value="1" label="Product" to={recordUrl.product(cell.productId)} />
          )}
          {cell.lotId && <SmartButton value="1" label="Lot" to={recordUrl.lot(cell.lotId)} />}
          <SmartButton value={history.length} label="Movements" onClick={() => setTab("history")} />
          {rack && <SmartButton value={rack.positions} label="Rack positions" to={recordUrl.rack(rack.id)} />}
        </>
      }
      fields={[
        { label: "Warehouse", value: `${cell.warehouseCode} - ${cell.warehouseName}` },
        { label: "Aisle", value: cell.aisleCode },
        {
          label: "Rack",
          value: <Link to={recordUrl.rack(cell.rackId)}>{cell.rackCode}</Link>,
        },
        { label: "Rack profile", value: cell.rackProfile },
        { label: "Column / bay", value: String(cell.bay) },
        { label: "Row / level", value: cell.level === 0 ? "Ground" : `L${cell.level}` },
        { label: "Position in bay", value: String(cell.slot) },
        { label: "Position rating", value: `${cell.maxWeightKg} kg` },
        { label: "Storage category", value: cell.storageCategoryName ?? "-" },
        {
          label: "Occupancy status",
          value: (
            <Badge
              tone={
                cell.blocked ? "bad" : cell.occupied ? "ok" : cell.reservedIncoming ? "info" : "neutral"
              }
            >
              {cellStatusLabel(cell)}
            </Badge>
          ),
        },
        {
          label: "Available for put-away",
          value: cell.availableForPutaway ? "Yes" : "No",
          hint: "Requires the position to be empty, unblocked and not already claimed by a pending operation.",
        },
        { label: "Blocked", value: cell.blocked ? (cell.blockNote ?? "Yes") : "No" },
      ]}
      tabs={[
        {
          id: "preview",
          label: "Position detail",
          content: (
            <div className="grid gap-3 grid-cols-1 xl:grid-cols-[340px_1fr]">
              <CellPreview cell={cell} compact />
              {rack && (
                <div className="min-w-0">
                  <h4 className="text-[var(--o-fs-sm)] font-medium m-0 mb-2">
                    Position within {rack.code}
                  </h4>
                  <RackElevation
                    rack={rack}
                    cells={rackCells}
                    selectedCellId={cell.id}
                    maxWidth={840}
                  />
                  <div className="mt-2">
                    <ElevationLegend />
                  </div>
                </div>
              )}
            </div>
          ),
        },
        {
          id: "history",
          label: "Movement history",
          count: history.length,
          content: (
            <RelatedTable
              columns={[
                { key: "date", label: "Date" },
                { key: "ref", label: "Operation" },
                { key: "product", label: "Product" },
                { key: "lot", label: "Lot" },
                { key: "pallet", label: "Pallet" },
                { key: "from", label: "From" },
                { key: "to", label: "To" },
                { key: "qty", label: "Quantity", align: "right" },
              ]}
              rows={history.map((row) => ({
                __key: row.id,
                date: formatDateTime(row.movementDate),
                ref: <Link to={recordUrl.operation(row.operationId)}>{row.operationName}</Link>,
                product: row.productName,
                lot: row.lotName ?? "-",
                pallet: row.palletName ?? "-",
                from: row.sourceLocationName,
                to: row.destLocationName,
                qty: formatQty(row.doneQty || row.quantity, row.uom),
              }))}
              empty="No movements recorded through this position."
            />
          ),
        },
      ]}
      activeTab={tab}
      onTab={setTab}
    />
  );
}

// -------------------------------------------------------------------- rack

export function RackDetail() {
  const { id = "" } = useParams();
  const derived = useDerived();
  const rackProfiles = useAppStore((s) => s.data.rackProfiles);
  const [tab, setTab] = useState("elevation");
  const [cellId, setCellId] = useState<string | null>(null);

  const rack = derived.racks.find((r) => r.id === id);
  const cells = useMemo(
    () => derived.cells.filter((c) => c.rackId === id),
    [derived.cells, id],
  );
  const profile = rack
    ? derived.index.rackById.get(rack.id)
    : undefined;
  const selectedCell = cells.find((c) => c.id === cellId);

  if (!rack) return <EmptyState title="Rack not found" />;

  const rackProfile = rackProfiles.find((p) => p.code === rack.profileCode);

  return (
    <FormView
      title={rack.code}
      subtitle={`${rack.warehouseName} · Aisle ${rack.aisleCode} · profile ${rack.profileCode}`}
      breadcrumbs={[{ label: "Locations", to: "/locations/racks" }]}
      smartButtons={
        <>
          <SmartButton value={rack.positions} label="Positions" onClick={() => setTab("positions")} />
          <SmartButton value={rack.occupied} label="Occupied" />
          <SmartButton value={rack.availableForPutaway} label="Available" />
          <SmartButton
            value="1"
            label="Warehouse"
            to={recordUrl.warehouse(rack.warehouseId)}
          />
        </>
      }
      fields={[
        { label: "Warehouse", value: rack.warehouseName },
        { label: "Aisle", value: rack.aisleCode },
        { label: "Side", value: rack.side },
        { label: "Rack profile", value: rack.profileCode },
        { label: "Columns / bays", value: formatInt(rack.bays) },
        { label: "Rows / levels", value: formatInt(rack.levels) },
        { label: "Positions per bay level", value: formatInt(rack.positionsPerBayLevel) },
        { label: "Installed positions", value: formatInt(rack.positions) },
        { label: "Occupied", value: formatInt(rack.occupied) },
        { label: "Physically empty", value: formatInt(rack.empty) },
        { label: "Blocked", value: formatInt(rack.blocked) },
        { label: "Available for put-away", value: formatInt(rack.availableForPutaway) },
        { label: "Occupancy", value: formatPct(rack.occupancyPct) },
        { label: "Partial pallets", value: formatInt(rack.partialPallets) },
        { label: "Empty pallets in position", value: formatInt(rack.emptyPallets) },
        ...(rackProfile
          ? [
              {
                label: "Profile dimensions",
                value: `${rackProfile.bayWidthMm} × ${rackProfile.depthMm} × ${rackProfile.heightMm} mm`,
              },
              {
                label: "Load per level",
                value: `${rackProfile.loadPerLevelKg} kg`,
              },
              { label: "Drawing", value: rackProfile.drawingRef },
            ]
          : []),
      ]}
      tabs={[
        {
          id: "elevation",
          label: "Elevation",
          content: (
            <div className="grid gap-3 grid-cols-1 xl:grid-cols-[1fr_340px]">
              <div className="min-w-0">
                <RackElevation
                  rack={rack}
                  cells={cells}
                  selectedCellId={cellId ?? undefined}
                  onSelectCell={(cid) => setCellId(cid)}
                />
                <div className="mt-2">
                  <ElevationLegend />
                </div>
                {profile && (
                  <p className="mt-2 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
                    Bay 1 is at the left of the elevation; the ground position is
                    the bottom row.
                  </p>
                )}
              </div>
              {selectedCell ? (
                <CellPreview cell={selectedCell} onClose={() => setCellId(null)} />
              ) : (
                <div className="o-card p-4 text-[var(--o-fs-sm)] text-[var(--o-text-muted)]">
                  Select a position to inspect it.
                </div>
              )}
            </div>
          ),
        },
        {
          id: "positions",
          label: "Positions",
          count: cells.length,
          content: (
            <RelatedTable
              columns={[
                { key: "cell", label: "Position" },
                { key: "bay", label: "Bay", align: "right" },
                { key: "level", label: "Level", align: "right" },
                { key: "status", label: "Status" },
                { key: "pallet", label: "Pallet" },
                { key: "product", label: "Product" },
                { key: "qty", label: "Quantity", align: "right" },
              ]}
              rows={cells.map((cell) => ({
                __key: cell.id,
                cell: <Link to={recordUrl.cell(cell.id)}>{cell.name}</Link>,
                bay: cell.bay,
                level: cell.level === 0 ? "G" : cell.level,
                status: cellStatusLabel(cell),
                pallet: cell.palletId ? (
                  <Link to={recordUrl.pallet(cell.palletId)}>{cell.palletName}</Link>
                ) : (
                  "-"
                ),
                product: cell.productName ?? "-",
                qty: cell.quantity ? formatQty(cell.quantity, cell.uom) : "-",
              }))}
            />
          ),
        },
      ]}
      activeTab={tab}
      onTab={setTab}
    />
  );
}

// --------------------------------------------------------------- warehouse

export function WarehouseDetail() {
  const { id = "" } = useParams();
  const derived = useDerived();
  const [tab, setTab] = useState("plan");
  const [rackId, setRackId] = useState<string | null>(null);

  const warehouse = derived.warehouses.find((w) => w.id === id);
  const racks = useMemo(
    () => derived.racks.filter((r) => r.warehouseId === id),
    [derived.racks, id],
  );

  if (!warehouse) return <EmptyState title="Warehouse not found" />;

  return (
    <FormView
      title={warehouse.name}
      subtitle={`${warehouse.code} · ${formatInt(warehouse.positions)} installed positions`}
      breadcrumbs={[{ label: "Locations", to: "/locations/warehouses" }]}
      banner={
        !warehouse.materialGroupConfirmed ? (
          <div className="max-w-[1500px] mx-auto mb-3 px-3 py-2 rounded-[var(--o-radius-md)] bg-[var(--o-warning-bg)] text-[var(--o-fs-sm)]">
            <strong>Unconfirmed assumption.</strong> {warehouse.sourceNote}
          </div>
        ) : undefined
      }
      smartButtons={
        <>
          <SmartButton value={formatInt(warehouse.positions)} label="Positions" />
          <SmartButton value={formatInt(warehouse.occupied)} label="Occupied" />
          <SmartButton value={formatInt(warehouse.availableForPutaway)} label="Available" />
          <SmartButton value={formatInt(warehouse.rackCount)} label="Racks" onClick={() => setTab("racks")} />
          <SmartButton
            value={formatInt(warehouse.aisleCount)}
            label="Aisles"
          />
        </>
      }
      fields={[
        { label: "Code", value: warehouse.code },
        {
          label: "Material group",
          value: warehouse.materialGroupConfirmed ? (
            warehouse.materialGroup
          ) : (
            <Badge tone="warn">{warehouse.materialGroup} (unconfirmed)</Badge>
          ),
        },
        { label: "Installed positions", value: formatInt(warehouse.positions) },
        {
          label: "Declared on the drawing",
          value: formatInt(warehouse.declaredPositions),
          hint: "The total printed in the MinMax storage-capacity table for this area.",
        },
        { label: "Occupied", value: formatInt(warehouse.occupied) },
        { label: "Physically empty", value: formatInt(warehouse.empty) },
        { label: "Blocked", value: formatInt(warehouse.blocked) },
        { label: "Reserved for incoming", value: formatInt(warehouse.reservedIncoming) },
        { label: "Available for put-away", value: formatInt(warehouse.availableForPutaway) },
        { label: "Occupancy", value: formatPct(warehouse.occupancyPct) },
        { label: "Partial pallets", value: formatInt(warehouse.partialPallets) },
        { label: "Empty pallets in position", value: formatInt(warehouse.emptyPallets) },
        { label: "Source drawing", value: warehouse.drawingRef },
      ]}
      tabs={[
        {
          id: "plan",
          label: "Floor plan",
          content: (
            <FloorPlan
              warehouse={warehouse}
              racks={racks}
              selectedRackId={rackId ?? undefined}
              onSelectRack={(rid) => setRackId(rid)}
              height={430}
            />
          ),
        },
        {
          id: "racks",
          label: "Racks",
          count: racks.length,
          content: (
            <RelatedTable
              columns={[
                { key: "rack", label: "Rack" },
                { key: "aisle", label: "Aisle" },
                { key: "profile", label: "Profile" },
                { key: "bays", label: "Bays", align: "right" },
                { key: "levels", label: "Levels", align: "right" },
                { key: "positions", label: "Positions", align: "right" },
                { key: "occupied", label: "Occupied", align: "right" },
                { key: "available", label: "Available", align: "right" },
                { key: "occupancy", label: "Occupancy", align: "right" },
              ]}
              rows={racks.map((rack) => ({
                __key: rack.id,
                rack: <Link to={recordUrl.rack(rack.id)}>{rack.code}</Link>,
                aisle: rack.aisleCode,
                profile: rack.profileCode,
                bays: rack.bays,
                levels: rack.levels,
                positions: formatInt(rack.positions),
                occupied: formatInt(rack.occupied),
                available: formatInt(rack.availableForPutaway),
                occupancy: formatPct(rack.occupancyPct),
              }))}
            />
          ),
        },
        {
          id: "source",
          label: "Source and assumptions",
          content: (
            <div className="text-[var(--o-fs-sm)] leading-relaxed">
              <p className="mt-0">
                <strong>Drawing:</strong> {warehouse.drawingRef}
              </p>
              <p>{warehouse.sourceNote}</p>
              <p className="mb-0">
                Installed positions were derived from the drawing's storage
                capacity table and reconcile exactly with the printed total of{" "}
                {formatInt(warehouse.declaredPositions)}. The floor plan geometry
                is schematic: rack runs, bay counts and level counts come from the
                drawing, but plan coordinates are approximate.
              </p>
            </div>
          ),
        },
      ]}
      activeTab={tab}
      onTab={setTab}
    />
  );
}
