/**
 * Action reducer.
 *
 * Every rule the brief calls for is enforced here, in one place:
 *  - draft and suggested operations do not change physical stock;
 *  - reservations reduce available quantity, never on-hand;
 *  - validation moves stock and rewrites location balances;
 *  - cancelling an uncompleted operation releases its reservations;
 *  - partial validation asks for backorder or cancel of the remainder, and
 *    cancelling the remainder does not remove undelivered stock;
 *  - completed operations keep their movement history;
 *  - re-applying an action that already ran is a no-op, so a double click or
 *    a refresh can never post an operation twice;
 *  - a pallet emptied by a pick keeps its identity and stays in its cell;
 *  - stock in-dates survive relocation, so age never resets.
 */

import { palletCapacityFor } from "@/data/catalog";
import type {
  Dataset,
  Move,
  MoveLine,
  Operation,
  Quant,
} from "@/data/types";
import type { ActionResult, DemoAction } from "./actions";

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}_x${String(counter).padStart(5, "0")}`;
}

/** Reset the id counter so replaying the same log yields the same ids. */
export function resetIdCounter(): void {
  counter = 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ------------------------------------------------------------- utilities

function movesOf(data: Dataset, operationId: string): Move[] {
  return data.moves.filter((m) => m.operationId === operationId);
}

function linesOf(data: Dataset, operationId: string): MoveLine[] {
  return data.moveLines.filter((l) => l.operationId === operationId);
}

function findQuant(
  data: Dataset,
  locationId: string,
  productId: string,
  variantId: string,
  lotId: string | null,
  palletId: string | null,
): Quant | undefined {
  return data.quants.find(
    (q) =>
      q.locationId === locationId &&
      q.productId === productId &&
      q.variantId === variantId &&
      (q.lotId ?? null) === (lotId ?? null) &&
      (q.palletId ?? null) === (palletId ?? null),
  );
}

/** Release every reservation attached to a move line and give the quant back. */
function releaseReservationsFor(data: Dataset, lineIds: Set<string>): void {
  const keep: typeof data.reservations = [];
  for (const reservation of data.reservations) {
    if (!lineIds.has(reservation.moveLineId)) {
      keep.push(reservation);
      continue;
    }
    const quant = data.quants.find((q) => q.id === reservation.quantId);
    if (quant) {
      quant.reservedQuantity = round2(
        Math.max(0, quant.reservedQuantity - reservation.quantity),
      );
    }
  }
  data.reservations = keep;
}

/**
 * Reserve `qty` of a product/lot from a specific pallet, respecting what is
 * actually available. Returns the quantity that could be reserved.
 */
function reserveFromPallet(
  data: Dataset,
  line: MoveLine,
  qty: number,
  at: string,
): number {
  if (!line.sourcePalletId) return 0;
  const quant = data.quants.find(
    (q) =>
      q.palletId === line.sourcePalletId &&
      q.productId === line.productId &&
      q.variantId === line.variantId &&
      (q.lotId ?? null) === (line.lotId ?? null),
  );
  if (!quant) return 0;
  const available = round2(quant.quantity - quant.reservedQuantity);
  const take = round2(Math.min(available, qty));
  if (take <= 0) return 0;
  quant.reservedQuantity = round2(quant.reservedQuantity + take);
  data.reservations.push({
    id: nextId("rs"),
    moveLineId: line.id,
    quantId: quant.id,
    quantity: take,
    createdAt: at,
  });
  return take;
}

/** Move `qty` of a line's product from its source to its destination. */
function applyStockMove(
  data: Dataset,
  line: MoveLine,
  qty: number,
  at: string,
): void {
  if (qty <= 0) return;

  const source = findQuant(
    data,
    line.sourceLocationId,
    line.productId,
    line.variantId,
    line.lotId,
    line.sourcePalletId,
  );

  // The in-date travels with the stock; relocation must not reset stock age.
  let inDate = at;
  if (source) {
    inDate = source.inDate;
    source.quantity = round2(source.quantity - qty);
    if (source.quantity <= 0.0001) {
      data.quants = data.quants.filter((q) => q.id !== source.id);
      data.reservations = data.reservations.filter(
        (r) => r.quantId !== source.id,
      );
    }
  }

  const destLocation = data.locations.find((l) => l.id === line.destLocationId);
  // Stock leaving the site (customer, scrap) is consumed, not re-created.
  if (destLocation && destLocation.usage !== "internal") return;

  const destPalletId = line.destPalletId ?? null;
  const existing = findQuant(
    data,
    line.destLocationId,
    line.productId,
    line.variantId,
    line.lotId,
    destPalletId,
  );
  if (existing) {
    existing.quantity = round2(existing.quantity + qty);
    // Keep the oldest in-date so aging reflects the oldest stock present.
    if (inDate < existing.inDate) existing.inDate = inDate;
  } else {
    data.quants.push({
      id: nextId("qt"),
      productId: line.productId,
      variantId: line.variantId,
      lotId: line.lotId,
      palletId: destPalletId,
      locationId: line.destLocationId,
      quantity: round2(qty),
      reservedQuantity: 0,
      uom: line.uom,
      inDate,
    });
  }

  // A pallet only changes cell when the line explicitly carries it there.
  if (
    destPalletId &&
    destPalletId === line.sourcePalletId &&
    destLocation?.kind === "cell"
  ) {
    const pallet = data.pallets.find((p) => p.id === destPalletId);
    if (pallet) {
      pallet.locationId = destLocation.id;
      pallet.state = "stored";
    }
  }
}

function sequenceName(data: Dataset, typeId: string): string {
  const type = data.operationTypes.find((t) => t.id === typeId)!;
  const used = data.operations.filter((o) => o.typeId === typeId).length + 1;
  return `${type.sequencePrefix}${String(used).padStart(5, "0")}`;
}

// --------------------------------------------------------------- reducer

export function applyAction(data: Dataset, action: DemoAction): ActionResult {
  switch (action.type) {
    case "check_availability":
      return doCheckAvailability(data, action.operationId, action.at);
    case "validate":
      return doValidate(data, action);
    case "cancel":
      return doCancel(data, action.operationId);
    case "set_draft":
      return doSetDraft(data, action.operationId);
    case "create_relocation":
      return doCreateRelocation(data, action);
    case "create_pick":
      return doCreatePick(data, action);
    case "create_putaway":
      return doCreatePutaway(data, action);
    default:
      return { ok: false, message: "Unknown action." };
  }
}

function doCheckAvailability(
  data: Dataset,
  operationId: string,
  at: string,
): ActionResult {
  const op = data.operations.find((o) => o.id === operationId);
  if (!op) return { ok: false, message: "Operation not found." };
  if (op.state === "done" || op.state === "cancel") {
    return { ok: false, message: "This operation is already closed." };
  }

  const moves = movesOf(data, op.id);
  let reservedAny = false;

  for (const move of moves) {
    let lines = data.moveLines.filter((l) => l.moveId === move.id);

    // A move with no detail line yet gets one from the best matching quant,
    // honouring the product's removal strategy.
    if (!lines.length) {
      const candidates = data.quants
        .filter(
          (q) =>
            q.productId === move.productId &&
            q.variantId === move.variantId &&
            q.quantity - q.reservedQuantity > 0 &&
            isUnder(data, q.locationId, move.sourceLocationId),
        )
        .sort((a, b) => strategyOrder(data, move, a, b));

      let remaining = move.demandQty;
      for (const quant of candidates) {
        if (remaining <= 0.0001) break;
        const available = round2(quant.quantity - quant.reservedQuantity);
        const take = round2(Math.min(available, remaining));
        if (take <= 0) continue;
        const line: MoveLine = {
          id: nextId("ml"),
          moveId: move.id,
          operationId: op.id,
          productId: move.productId,
          variantId: move.variantId,
          lotId: quant.lotId,
          uom: move.uom,
          quantity: take,
          doneQty: 0,
          sourceLocationId: quant.locationId,
          destLocationId: move.destLocationId,
          sourcePalletId: quant.palletId,
          destPalletId: null,
          state: "ready",
        };
        data.moveLines.push(line);
        quant.reservedQuantity = round2(quant.reservedQuantity + take);
        data.reservations.push({
          id: nextId("rs"),
          moveLineId: line.id,
          quantId: quant.id,
          quantity: take,
          createdAt: at,
        });
        remaining = round2(remaining - take);
        reservedAny = true;
      }
      lines = data.moveLines.filter((l) => l.moveId === move.id);
    } else {
      for (const line of lines) {
        const alreadyReserved = data.reservations
          .filter((r) => r.moveLineId === line.id)
          .reduce((s, r) => s + r.quantity, 0);
        const missing = round2(line.quantity - alreadyReserved);
        if (missing > 0) {
          const got = reserveFromPallet(data, line, missing, at);
          if (got > 0) reservedAny = true;
        }
      }
    }

    const reservedForMove = lines.reduce(
      (sum, line) =>
        sum +
        data.reservations
          .filter((r) => r.moveLineId === line.id)
          .reduce((s, r) => s + r.quantity, 0),
      0,
    );
    move.state = reservedForMove >= move.demandQty - 0.0001 ? "ready" : "waiting";
  }

  const allReady = movesOf(data, op.id).every((m) => m.state === "ready");
  op.state = allReady ? "ready" : "waiting";
  for (const line of linesOf(data, op.id)) line.state = op.state;

  return {
    ok: true,
    message: allReady
      ? "Availability confirmed. The operation is Ready."
      : reservedAny
        ? "Partially reserved. The operation stays in Waiting."
        : "No stock could be reserved. The operation stays in Waiting.",
  };
}

/** Location containment for the shallow model: cell -> rack -> aisle -> warehouse. */
function isUnder(data: Dataset, locationId: string, ancestorId: string): boolean {
  if (locationId === ancestorId) return true;
  const loc = data.locations.find((l) => l.id === locationId);
  if (!loc) return false;
  return (
    loc.rackId === ancestorId ||
    loc.aisleId === ancestorId ||
    loc.zoneId === ancestorId ||
    loc.warehouseId === ancestorId
  );
}

function strategyOrder(
  data: Dataset,
  move: Move,
  a: Quant,
  b: Quant,
): number {
  const product = data.products.find((p) => p.id === move.productId);
  const category = product
    ? data.productCategories.find((c) => c.id === product.categoryId)
    : undefined;
  const strategy = product?.removalStrategy ?? category?.removalStrategy ?? "fifo";
  switch (strategy) {
    case "lifo":
      return b.inDate.localeCompare(a.inDate);
    case "least_packages":
      return b.quantity - a.quantity;
    case "closest": {
      const la = data.locations.find((l) => l.id === a.locationId);
      const lb = data.locations.find((l) => l.id === b.locationId);
      return (la?.level ?? 0) - (lb?.level ?? 0) || (la?.bay ?? 0) - (lb?.bay ?? 0);
    }
    case "fifo":
    default:
      return a.inDate.localeCompare(b.inDate);
  }
}

function doValidate(
  data: Dataset,
  action: Extract<DemoAction, { type: "validate" }>,
): ActionResult {
  const op = data.operations.find((o) => o.id === action.operationId);
  if (!op) return { ok: false, message: "Operation not found." };
  // Idempotency: a second click, or a refresh replaying the log, does nothing.
  if (op.state === "done") {
    return { ok: true, message: "This operation was already validated." };
  }
  if (op.state === "cancel") {
    return { ok: false, message: "A cancelled operation cannot be validated." };
  }

  const byLine = new Map(action.lines.map((l) => [l.lineId, l]));
  const lines = linesOf(data, op.id);
  if (!lines.length) {
    return {
      ok: false,
      message: "Nothing to validate. Run Check Availability first.",
    };
  }

  const lineIds = new Set(lines.map((l) => l.id));
  releaseReservationsFor(data, lineIds);

  let movedAnything = false;
  const shortfalls: { move: Move; missing: number }[] = [];

  for (const move of movesOf(data, op.id)) {
    const moveLines = lines.filter((l) => l.moveId === move.id);
    let done = 0;
    for (const line of moveLines) {
      const input = byLine.get(line.id);
      const qty = round2(
        Math.max(0, Math.min(input?.doneQty ?? line.quantity, line.quantity)),
      );
      if (input?.destLocationId) line.destLocationId = input.destLocationId;
      if (input?.destPalletId !== undefined) line.destPalletId = input.destPalletId;

      line.doneQty = qty;
      line.state = qty > 0 ? "done" : "cancel";
      line.doneAt = action.at;
      if (qty > 0) {
        applyStockMove(data, line, qty, action.at);
        movedAnything = true;
      }
      done = round2(done + qty);
    }
    move.doneQty = done;
    move.state = "done";
    const missing = round2(move.demandQty - done);
    if (missing > 0.0001) shortfalls.push({ move, missing });
  }

  op.state = "done";
  op.effectiveAt = action.at;

  // Dependent operations may now be startable.
  for (const other of data.operations) {
    if (other.originOperationId === op.id && other.state === "waiting") {
      other.state = "draft";
    }
  }

  let message = movedAnything
    ? "Operation validated. Stock and locations are updated."
    : "Operation closed with nothing moved.";
  let createdOperationId: string | undefined;

  if (shortfalls.length && action.remainder === "backorder") {
    const backorder = createBackorder(data, op, shortfalls, action.at);
    createdOperationId = backorder.id;
    message = `Operation validated. Back order ${backorder.name} created for the remaining demand.`;
  } else if (shortfalls.length) {
    // Cancelling the remaining demand closes the paperwork only. Stock that was
    // never delivered stays exactly where it is.
    message =
      "Operation validated. The remaining demand was cancelled; undelivered stock is untouched.";
  }

  return { ok: true, message, createdOperationId };
}

function createBackorder(
  data: Dataset,
  origin: Operation,
  shortfalls: { move: Move; missing: number }[],
  at: string,
): Operation {
  const backorder: Operation = {
    id: nextId("op"),
    name: sequenceName(data, origin.typeId),
    typeId: origin.typeId,
    kind: origin.kind,
    state: "waiting",
    warehouseId: origin.warehouseId,
    sourceLocationId: origin.sourceLocationId,
    destLocationId: origin.destLocationId,
    partnerId: origin.partnerId,
    operatorId: origin.operatorId,
    sourceDocument: origin.sourceDocument,
    scheduledAt: at,
    createdAt: at,
    backorderOfId: origin.id,
    note: `Back order of ${origin.name} for the quantity not processed.`,
  };
  data.operations.push(backorder);

  shortfalls.forEach(({ move, missing }, i) => {
    data.moves.push({
      id: nextId("mv"),
      operationId: backorder.id,
      productId: move.productId,
      variantId: move.variantId,
      uom: move.uom,
      demandQty: missing,
      doneQty: 0,
      sourceLocationId: move.sourceLocationId,
      destLocationId: move.destLocationId,
      state: "waiting",
      sequence: i + 1,
    });
  });

  return backorder;
}

function doCancel(data: Dataset, operationId: string): ActionResult {
  const op = data.operations.find((o) => o.id === operationId);
  if (!op) return { ok: false, message: "Operation not found." };
  if (op.state === "cancel") return { ok: true, message: "Already cancelled." };
  if (op.state === "done") {
    return {
      ok: false,
      message: "A validated operation keeps its history and cannot be cancelled.",
    };
  }

  const lines = linesOf(data, op.id);
  releaseReservationsFor(data, new Set(lines.map((l) => l.id)));
  for (const line of lines) line.state = "cancel";
  for (const move of movesOf(data, op.id)) move.state = "cancel";
  op.state = "cancel";

  return { ok: true, message: "Operation cancelled. Reservations were released." };
}

function doSetDraft(data: Dataset, operationId: string): ActionResult {
  const op = data.operations.find((o) => o.id === operationId);
  if (!op) return { ok: false, message: "Operation not found." };
  if (op.state === "done") {
    return { ok: false, message: "A validated operation cannot return to draft." };
  }
  const lines = linesOf(data, op.id);
  releaseReservationsFor(data, new Set(lines.map((l) => l.id)));
  data.moveLines = data.moveLines.filter((l) => l.operationId !== op.id);
  for (const move of movesOf(data, op.id)) {
    move.state = "draft";
    move.doneQty = 0;
  }
  op.state = "draft";
  return { ok: true, message: "Operation reset to draft. Reservations released." };
}

// ------------------------------------------------------- created records

function doCreateRelocation(
  data: Dataset,
  action: Extract<DemoAction, { type: "create_relocation" }>,
): ActionResult {
  if (data.operations.some((o) => o.id === action.operationId)) {
    return { ok: true, createdOperationId: action.operationId };
  }
  const pallet = data.pallets.find((p) => p.id === action.palletId);
  if (!pallet?.locationId) {
    return { ok: false, message: "That pallet is not in a rack position." };
  }
  const dest = data.locations.find((l) => l.id === action.destLocationId);
  if (!dest || dest.kind !== "cell") {
    return { ok: false, message: "Destination must be a rack position." };
  }
  if (dest.blocked) {
    return { ok: false, message: `${dest.completeName} is blocked.` };
  }
  if (data.pallets.some((p) => p.locationId === dest.id)) {
    return { ok: false, message: `${dest.completeName} is already occupied.` };
  }
  // No two pending operations may claim the same exclusive destination.
  const claimed = data.moves.some((m) => {
    if (m.destLocationId !== dest.id) return false;
    const other = data.operations.find((o) => o.id === m.operationId);
    return !!other && other.state !== "done" && other.state !== "cancel";
  });
  if (claimed) {
    return {
      ok: false,
      message: `${dest.completeName} is already reserved by another pending operation.`,
    };
  }

  const source = data.locations.find((l) => l.id === pallet.locationId)!;
  const warehouseId = source.warehouseId!;
  const type = data.operationTypes.find(
    (t) => t.warehouseId === warehouseId && t.kind === "internal",
  )!;

  const op: Operation = {
    id: action.operationId,
    name: sequenceName(data, type.id),
    typeId: type.id,
    kind: "internal",
    state: "ready",
    warehouseId,
    sourceLocationId: source.id,
    destLocationId: dest.id,
    operatorId: action.operatorId,
    scheduledAt: action.at,
    createdAt: action.at,
    note:
      action.note ??
      "Relocation created from the Empty Cell dashboard during the demonstration.",
  };
  data.operations.push(op);

  const quants = data.quants.filter((q) => q.palletId === pallet.id);
  if (!quants.length) {
    // An empty pallet still moves; it just carries no stock line.
    data.moves.push({
      id: nextId("mv"),
      operationId: op.id,
      productId: "",
      variantId: "",
      uom: "units",
      demandQty: 0,
      doneQty: 0,
      sourceLocationId: source.id,
      destLocationId: dest.id,
      state: "ready",
      sequence: 1,
    });
    return { ok: true, createdOperationId: op.id, message: `Relocation ${op.name} created.` };
  }

  quants.forEach((quant, i) => {
    const move: Move = {
      id: nextId("mv"),
      operationId: op.id,
      productId: quant.productId,
      variantId: quant.variantId,
      uom: quant.uom,
      demandQty: quant.quantity,
      doneQty: 0,
      sourceLocationId: source.id,
      destLocationId: dest.id,
      state: "ready",
      sequence: i + 1,
    };
    data.moves.push(move);
    data.moveLines.push({
      id: nextId("ml"),
      moveId: move.id,
      operationId: op.id,
      productId: quant.productId,
      variantId: quant.variantId,
      lotId: quant.lotId,
      uom: quant.uom,
      quantity: quant.quantity,
      doneQty: 0,
      sourceLocationId: source.id,
      destLocationId: dest.id,
      sourcePalletId: pallet.id,
      destPalletId: pallet.id,
      state: "ready",
    });
  });

  return {
    ok: true,
    createdOperationId: op.id,
    message: `Relocation ${op.name} created and ready to validate.`,
  };
}

function doCreatePick(
  data: Dataset,
  action: Extract<DemoAction, { type: "create_pick" }>,
): ActionResult {
  if (data.operations.some((o) => o.id === action.operationId)) {
    return { ok: true, createdOperationId: action.operationId };
  }
  const pallet = data.pallets.find((p) => p.id === action.palletId);
  if (!pallet?.locationId) {
    return { ok: false, message: "That pallet is not in a rack position." };
  }
  const quant = data.quants.find((q) => q.palletId === pallet.id);
  if (!quant) return { ok: false, message: "That pallet holds no stock." };

  const available = round2(quant.quantity - quant.reservedQuantity);
  if (action.quantity > available + 0.0001) {
    return {
      ok: false,
      message: `Only ${available} ${quant.uom} are available on this pallet.`,
    };
  }

  const source = data.locations.find((l) => l.id === pallet.locationId)!;
  const warehouseId = source.warehouseId!;
  const type = data.operationTypes.find(
    (t) => t.warehouseId === warehouseId && t.kind === "pick",
  )!;
  const warehouse = data.warehouses.find((w) => w.id === warehouseId)!;
  const outId = `loc_${warehouse.code.toLowerCase()}_out`;

  const op: Operation = {
    id: action.operationId,
    name: sequenceName(data, type.id),
    typeId: type.id,
    kind: "pick",
    state: "ready",
    warehouseId,
    sourceLocationId: source.id,
    destLocationId: outId,
    partnerId: action.partnerId,
    operatorId: action.operatorId,
    scheduledAt: action.at,
    createdAt: action.at,
    manualLotSelection: action.manualLotSelection,
    note: action.manualLotSelection
      ? "Lot selected manually by an authorised user (SRS REQ-BLD-002). No blend sheet is produced."
      : "Created from the pallet form during the demonstration.",
  };
  data.operations.push(op);

  const move: Move = {
    id: nextId("mv"),
    operationId: op.id,
    productId: quant.productId,
    variantId: quant.variantId,
    uom: quant.uom,
    demandQty: action.quantity,
    doneQty: 0,
    sourceLocationId: source.id,
    destLocationId: outId,
    state: "ready",
    sequence: 1,
  };
  data.moves.push(move);

  const line: MoveLine = {
    id: nextId("ml"),
    moveId: move.id,
    operationId: op.id,
    productId: quant.productId,
    variantId: quant.variantId,
    lotId: quant.lotId,
    uom: quant.uom,
    quantity: action.quantity,
    doneQty: 0,
    sourceLocationId: source.id,
    destLocationId: outId,
    sourcePalletId: pallet.id,
    destPalletId: null,
    state: "ready",
  };
  data.moveLines.push(line);

  quant.reservedQuantity = round2(quant.reservedQuantity + action.quantity);
  data.reservations.push({
    id: nextId("rs"),
    moveLineId: line.id,
    quantId: quant.id,
    quantity: action.quantity,
    createdAt: action.at,
  });

  return {
    ok: true,
    createdOperationId: op.id,
    message: `Pick ${op.name} created and reserved.`,
  };
}

function doCreatePutaway(
  data: Dataset,
  action: Extract<DemoAction, { type: "create_putaway" }>,
): ActionResult {
  if (data.operations.some((o) => o.id === action.operationId)) {
    return { ok: true, createdOperationId: action.operationId };
  }
  return doCreateRelocation(data, {
    type: "create_relocation",
    operationId: action.operationId,
    palletId: action.palletId,
    destLocationId: action.destLocationId,
    operatorId: action.operatorId,
    at: action.at,
    note: "Put-away created from a suggested compatible cell.",
  });
}

// ------------------------------------------------------------ suggestions

export interface CellSuggestion {
  locationId: string;
  completeName: string;
  score: number;
  reasons: string[];
}

/**
 * Suggest compatible empty cells for a pallet.
 *
 * The ranking basis is stated to the user rather than implied: this is a
 * same-aisle / same-rack proximity heuristic over the location codes, not a
 * measured forklift route. A real route model needs the aisle graph and truck
 * speeds, which are not part of this prototype.
 */
export function suggestCells(
  data: Dataset,
  palletId: string,
  limit = 12,
): CellSuggestion[] {
  const pallet = data.pallets.find((p) => p.id === palletId);
  if (!pallet) return [];
  const quant = data.quants.find((q) => q.palletId === palletId);
  const product = quant
    ? data.products.find((p) => p.id === quant.productId)
    : undefined;
  const variant = quant
    ? data.variants.find((v) => v.id === quant.variantId)
    : undefined;
  const weight =
    product && quant ? quant.quantity * product.unitWeightKg : 0;
  const capacity =
    product && variant ? palletCapacityFor(product, variant) : undefined;

  const origin = pallet.locationId
    ? data.locations.find((l) => l.id === pallet.locationId)
    : undefined;

  const occupied = new Set(
    data.pallets.filter((p) => p.locationId).map((p) => p.locationId!),
  );
  const claimed = new Set(
    data.moves
      .filter((m) => {
        const op = data.operations.find((o) => o.id === m.operationId);
        return !!op && op.state !== "done" && op.state !== "cancel";
      })
      .map((m) => m.destLocationId),
  );

  const results: CellSuggestion[] = [];
  for (const loc of data.locations) {
    if (loc.kind !== "cell") continue;
    if (loc.blocked) continue;
    if (occupied.has(loc.id)) continue;
    if (claimed.has(loc.id)) continue;
    if (loc.id === pallet.locationId) continue;

    const reasons: string[] = ["Position is empty, unblocked and unreserved"];

    // Product compatibility through the storage category.
    if (product && loc.storageCategoryId) {
      const category = data.storageCategories.find(
        (c) => c.id === loc.storageCategoryId,
      );
      if (category && !category.accepts.includes(product.materialGroup)) continue;
      if (category) {
        reasons.push(
          `Storage category "${category.name}" accepts ${product.materialGroup}`,
        );
        if (weight > category.maxWeightKg) continue;
      }
    }
    if (weight > loc.maxWeightKg) continue;
    if (weight > 0) {
      reasons.push(
        `Load ${Math.round(weight)} kg is within the ${loc.maxWeightKg} kg position rating`,
      );
    }

    let score = 0;
    if (origin) {
      if (loc.warehouseId === origin.warehouseId) {
        score += 40;
        reasons.push("Same warehouse");
      }
      if (loc.aisleId === origin.aisleId) {
        score += 25;
        reasons.push("Same aisle");
      }
      if (loc.rackId === origin.rackId) {
        score += 15;
        reasons.push("Same rack");
      }
    }
    if ((loc.level ?? 0) === 0) {
      score += 12;
      reasons.push("Ground position - easiest to access");
    } else {
      score += Math.max(0, 10 - (loc.level ?? 0));
    }
    if (capacity) {
      reasons.push(
        `Pallet capacity ${capacity} ${product?.uom ?? ""} is the fill basis for this product`.trim(),
      );
    }

    results.push({
      locationId: loc.id,
      completeName: loc.completeName,
      score,
      reasons,
    });
  }

  results.sort((a, b) => b.score - a.score || a.completeName.localeCompare(b.completeName));
  return results.slice(0, limit);
}

/**
 * Suggest compatible empty positions for a product rather than for an existing
 * pallet. Used by the Empty Cell dashboard to show *why* a position qualifies
 * before any pallet exists.
 */
export function suggestCellsForProduct(
  data: Dataset,
  productId: string,
  variantId: string | undefined,
  quantity: number,
  options?: { warehouseId?: string; limit?: number },
): CellSuggestion[] {
  const product = data.products.find((p) => p.id === productId);
  if (!product) return [];
  const variant = variantId
    ? data.variants.find((v) => v.id === variantId)
    : data.variants.find((v) => v.productId === productId);
  const capacity = palletCapacityFor(product, variant);
  const qty = quantity > 0 ? quantity : capacity;
  const weight = qty * product.unitWeightKg;

  const occupied = new Set(
    data.pallets.filter((p) => p.locationId).map((p) => p.locationId!),
  );
  const claimed = new Set(
    data.moves
      .filter((m) => {
        const op = data.operations.find((o) => o.id === m.operationId);
        return !!op && op.state !== "done" && op.state !== "cancel";
      })
      .map((m) => m.destLocationId),
  );

  const results: CellSuggestion[] = [];
  for (const loc of data.locations) {
    if (loc.kind !== "cell") continue;
    if (options?.warehouseId && loc.warehouseId !== options.warehouseId) continue;
    if (loc.blocked || occupied.has(loc.id) || claimed.has(loc.id)) continue;

    const reasons = ["Position is empty, unblocked and not reserved"];
    const category = loc.storageCategoryId
      ? data.storageCategories.find((c) => c.id === loc.storageCategoryId)
      : undefined;
    if (category) {
      if (!category.accepts.includes(product.materialGroup)) continue;
      reasons.push(
        `Storage category "${category.name}" accepts ${product.materialGroup}`,
      );
      if (weight > category.maxWeightKg) continue;
    }
    if (weight > loc.maxWeightKg) continue;
    reasons.push(
      `${Math.round(weight)} kg load is within the ${loc.maxWeightKg} kg position rating`,
    );
    reasons.push(
      `Full-pallet basis for this product is ${capacity} ${product.uom}`,
    );

    let score = 0;
    if ((loc.level ?? 0) === 0) {
      score += 20;
      reasons.push("Ground position - fastest to access");
    } else {
      score += Math.max(0, 12 - (loc.level ?? 0) * 2);
      reasons.push(`Level ${loc.level} position`);
    }
    if ((loc.bay ?? 99) <= 4) {
      score += 6;
      reasons.push("Near the head of the rack run");
    }

    results.push({
      locationId: loc.id,
      completeName: loc.completeName,
      score,
      reasons,
    });
  }

  results.sort(
    (a, b) => b.score - a.score || a.completeName.localeCompare(b.completeName),
  );
  return results.slice(0, options?.limit ?? 12);
}

/**
 * Consolidation candidates for a partially filled pallet.
 *
 * Deliberately conservative, and the rule is shown to the user: same product,
 * same variant, same lot, and enough remaining capacity to take the quantity.
 */
export interface ConsolidationCandidate {
  palletId: string;
  palletName: string;
  completeName: string;
  remaining: number;
  uom: string;
  fillPct: number;
}

export function suggestConsolidation(
  data: Dataset,
  palletId: string,
  limit = 8,
): ConsolidationCandidate[] {
  const quant = data.quants.find((q) => q.palletId === palletId);
  if (!quant) return [];
  const product = data.products.find((p) => p.id === quant.productId);
  const variant = data.variants.find((v) => v.id === quant.variantId);
  if (!product || !variant) return [];
  const capacity = palletCapacityFor(product, variant);
  const needed = round2(quant.quantity - quant.reservedQuantity);

  const out: ConsolidationCandidate[] = [];
  for (const other of data.quants) {
    if (other.palletId === palletId || !other.palletId) continue;
    if (other.productId !== quant.productId) continue;
    if (other.variantId !== quant.variantId) continue;
    if ((other.lotId ?? null) !== (quant.lotId ?? null)) continue;
    const remaining = round2(capacity - other.quantity);
    if (remaining < needed || remaining <= 0) continue;
    const pallet = data.pallets.find((p) => p.id === other.palletId);
    if (!pallet?.locationId) continue;
    const loc = data.locations.find((l) => l.id === pallet.locationId);
    out.push({
      palletId: pallet.id,
      palletName: pallet.name,
      completeName: loc?.completeName ?? "",
      remaining,
      uom: other.uom,
      fillPct: round2((other.quantity / capacity) * 100),
    });
  }
  out.sort((a, b) => a.remaining - b.remaining);
  return out.slice(0, limit);
}
