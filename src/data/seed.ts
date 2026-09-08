/**
 * Deterministic dataset builder.
 *
 * One seed, one dataset. Every dashboard, list, map, report and operation in the
 * application reads this and nothing else, so a KPI and the records behind it
 * can never disagree.
 *
 * Invariants established here and preserved by the store:
 *  - stable ids and references, no Math.random anywhere;
 *  - reservedQuantity never exceeds quantity on a quant;
 *  - one pallet per cell (palletCapacity = 1 on every rack position);
 *  - lot receipt dates are set once and never rewritten by relocation;
 *  - installed positions = cells only; input/output/staging are excluded;
 *  - fill percentage uses the product/variant pallet capacity, never the
 *    800 kg structural rating of the position.
 */

import {
  GARDEN_MARKS,
  OPERATORS,
  PACKAGE_TYPES,
  PARTNERS,
  PRODUCTS,
  PRODUCT_CATEGORIES,
  STORAGE_CATEGORIES,
  VARIANTS,
  palletCapacityFor,
} from "./catalog";
import { DEMO_NOW_ISO, addDays, addHours, demoNow } from "./clock";
import {
  PALLET_LOAD_KG,
  RACK_PROFILES,
  WAREHOUSE,
  levelsPerBay,
  type ProfileGroupSpec,
} from "./layout";
import { Rng, pad } from "./rng";
import type {
  Aisle,
  CellBlockReason,
  Dataset,
  Lot,
  Location,
  Move,
  MoveLine,
  Operation,
  OperationKind,
  OperationType,
  Operator,
  Pallet,
  Partner,
  Quant,
  Rack,
  Reservation,
  Site,
  Warehouse,
  Zone,
} from "./types";

const SUPPLIERS: Partner[] = PARTNERS.filter((p) => p.kind === "supplier");
const CUSTOMERS: Partner[] = PARTNERS.filter((p) => p.kind === "customer");
const PACKAGING_SUPPLIERS: Partner[] = SUPPLIERS.filter(
  (p) => p.ref === "SUP-005" || p.ref === "SUP-006",
);

/**
 * Identifies the shape of the dataset, not the code version.
 *
 * The store persists an action log and replays it on load; a log recorded
 * against a different dataset would replay ids that no longer exist and leave
 * operations in impossible states - a Ready pick with nothing reserved, for
 * instance. The guard that discards a stale log is only as good as this string,
 * and a hand-maintained "1.0.0" silently went stale through a restructure that
 * renamed every warehouse, section, aisle and cell. So it is derived from the
 * layout itself: change the building and old logs invalidate automatically.
 */
export const SEED_VERSION = [
  "2",
  WAREHOUSE.id,
  WAREHOUSE.declaredPositions,
  WAREHOUSE.sections
    .map((x) => `${x.id}:${x.groups.reduce((sum, g) => sum + g.bays, 0)}`)
    .join("+"),
].join("-");
const SEED = 20260906;

/**
 * Target physical occupancy per section.
 *
 * Raw runs fuller than finished goods, which is the usual shape: raw tea is
 * bought in campaigns and held, finished goods turn over against orders.
 */
const OCCUPANCY_TARGET: Record<string, number> = {
  sec_raw: 0.74,
  sec_fg: 0.58,
};

/** Share of occupied positions holding a partially filled pallet. */
const PARTIAL_SHARE = 0.24;
/** Share of occupied positions holding a physically present but empty pallet. */
const EMPTY_PALLET_SHARE = 0.022;
/** Share of positions blocked for structural or safety reasons. */
const BLOCKED_SHARE = 0.013;

const BLOCK_REASONS: { reason: CellBlockReason; note: string }[] = [
  { reason: "structural", note: "Column obstruction at this bay" },
  { reason: "damaged_beam", note: "Beam damage reported - awaiting repair" },
  { reason: "fire_access", note: "Kept clear for fire access" },
  { reason: "maintenance", note: "Under maintenance" },
  { reason: "sprinkler_clearance", note: "Sprinkler clearance at top level" },
];

// ---------------------------------------------------------------- geometry

/** Schematic plan canvas. Not traced from the drawings - see layout.ts. */
export const PLAN_WIDTH = 1000;

interface RackRunSpec {
  profileCode: string;
  bays: number;
  levels: number;
  positionsPerLevel: number;
}

/** Split a drawing profile group into physical rack runs of a sane length. */
function splitIntoRuns(group: ProfileGroupSpec): RackRunSpec[] {
  const levels = levelsPerBay(group);
  const target = group.bays > 40 ? 12 : group.bays > 20 ? 10 : 8;
  const runs: RackRunSpec[] = [];
  let remaining = group.bays;
  while (remaining > 0) {
    // Avoid orphan runs of 1-2 bays when a longer run can absorb them.
    let take = Math.min(target, remaining);
    if (remaining - take > 0 && remaining - take < 3) take = remaining;
    runs.push({
      profileCode: group.profileCode,
      bays: take,
      levels,
      positionsPerLevel: group.positionsPerLevel,
    });
    remaining -= take;
  }
  return runs;
}

// ------------------------------------------------------------------- build

export function buildDataset(): Dataset {
  const rng = new Rng(SEED);
  const now = demoNow();

  const sites: Site[] = [
    {
      id: "site_main",
      name: "Ispahani Tea - Warehouse Site",
      drawingRef: WAREHOUSE.drawingRef,
    },
  ];

  const warehouses: Warehouse[] = [
    {
      id: WAREHOUSE.id,
      code: WAREHOUSE.code,
      name: WAREHOUSE.name,
      siteId: WAREHOUSE.siteId,
      materialGroups: ["RM", "PM", "FG"],
      materialGroupConfirmed: true,
      drawingRef: WAREHOUSE.drawingRef,
      sourceNote: WAREHOUSE.sourceNote,
      declaredPositions: WAREHOUSE.declaredPositions,
      footprint: WAREHOUSE.footprint,
    },
  ];

  const zones: Zone[] = [];
  const aisles: Aisle[] = [];
  const racks: Rack[] = [];
  const locations: Location[] = [];

  let rackSeq = 0;

  // One building, so the two sections share one plan canvas: each takes a
  // contiguous run of aisle bands rather than getting a canvas of its own.
  const planHeight = Math.round(
    (PLAN_WIDTH * WAREHOUSE.footprint.depth) / WAREHOUSE.footprint.width,
  );
  const totalAisles = WAREHOUSE.sections.reduce((sum, x) => sum + x.aisles, 0);
  const bandHeight = planHeight / totalAisles;
  const rackDepth = Math.min(26, bandHeight * 0.3);
  const margin = PLAN_WIDTH * 0.03;
  let aisleOffset = 0;

  for (const section of WAREHOUSE.sections) {
    const primaryGroup = section.materialGroups[0];
    const zoneId = section.id;

    zones.push({
      id: zoneId,
      warehouseId: WAREHOUSE.id,
      code: section.code,
      name: section.name,
      materialGroups: section.materialGroups,
      materialGroup: primaryGroup,
      materialGroupConfirmed: section.materialGroupConfirmed,
      stage: section.stage,
      sourceNote: section.sourceNote,
      positions: section.groups.reduce((sum, g) => sum + g.declaredPositions, 0),
    });

    // Aisle codes are qualified by section. Both sections number their aisles
    // from 1, so a bare "A1" would be ambiguous across the building - and any
    // chart or grouping keyed on the code would silently merge two aisles.
    const sectionAisles: Aisle[] = [];
    for (let a = 0; a < section.aisles; a++) {
      const aisle: Aisle = {
        id: `ai_${section.code.toLowerCase()}_${a + 1}`,
        warehouseId: WAREHOUSE.id,
        zoneId,
        code: `${section.code}-A${a + 1}`,
        name: `${section.name} - Aisle ${a + 1}`,
        sequence: a + 1,
      };
      sectionAisles.push(aisle);
      aisles.push(aisle);
    }

    // --- rack runs ------------------------------------------------------
    const runs: RackRunSpec[] = [];
    for (const group of section.groups) runs.push(...splitIntoRuns(group));

    // Distribute runs across aisles and sides so both sides of every aisle
    // carry racking, the way a VNA layout works.
    const perAisle: RackRunSpec[][] = Array.from(
      { length: section.aisles },
      () => [],
    );
    runs.forEach((run, i) => perAisle[i % section.aisles].push(run));

    // One bay width for the whole section, so a 7-bay run is visibly shorter
    // than a 16-bay run instead of both stretching to fill their side.
    const gap = 6;
    const usable = PLAN_WIDTH - margin * 2;
    const widestSide = Math.max(
      1,
      ...perAisle.flatMap((aisleRuns) => {
        const a = aisleRuns.filter((_, i) => i % 2 === 0);
        const b = aisleRuns.filter((_, i) => i % 2 === 1);
        return [
          a.reduce((sum, r) => sum + r.bays, 0) + gap * Math.max(0, a.length - 1),
          b.reduce((sum, r) => sum + r.bays, 0) + gap * Math.max(0, b.length - 1),
        ];
      }),
    );
    const bayWidth = Math.max(3.5, usable / widestSide);

    perAisle.forEach((aisleRuns, aisleIndex) => {
      const aisle = sectionAisles[aisleIndex];
      const bandTop = (aisleOffset + aisleIndex) * bandHeight;
      const sideA = aisleRuns.filter((_, i) => i % 2 === 0);
      const sideB = aisleRuns.filter((_, i) => i % 2 === 1);

      for (const [side, sideRuns] of [
        ["A", sideA],
        ["B", sideB],
      ] as const) {
        let cursorX = margin;
        const y =
          side === "A"
            ? bandTop + bandHeight * 0.14
            : bandTop + bandHeight * 0.62;

        for (const run of sideRuns) {
          rackSeq += 1;
          const profile = RACK_PROFILES.find(
            (x) => x.code === run.profileCode,
          )!;
          const width = run.bays * bayWidth;
          const rackId = `rk_${section.code.toLowerCase()}_${pad(rackSeq, 4)}`;
          // The rack code is globally unique; the short label is what appears
          // inside a location path, so an address does not repeat its prefix.
          const rackShort = `R${pad(rackSeq, 3)}`;
          const aisleShort = `A${aisle.sequence}`;
          const rackCode = `${aisle.code}-${rackShort}`;
          const positions = run.bays * run.levels * run.positionsPerLevel;

          racks.push({
            id: rackId,
            code: rackCode,
            name: `Rack ${rackCode} (${profile.code})`,
            warehouseId: WAREHOUSE.id,
            zoneId,
            aisleId: aisle.id,
            profileCode: profile.code,
            bays: run.bays,
            levels: run.levels,
            positionsPerBayLevel: run.positionsPerLevel,
            positions,
            x: cursorX,
            y,
            width,
            depth: rackDepth,
            orientation: "h",
            side,
          });

          // --- cells ---------------------------------------------------
          for (let bay = 1; bay <= run.bays; bay++) {
            for (let level = 0; level < run.levels; level++) {
              for (let slot = 1; slot <= run.positionsPerLevel; slot++) {
                const cellCode =
                  run.positionsPerLevel > 1
                    ? `B${pad(bay, 2)}-L${level}-P${slot}`
                    : `B${pad(bay, 2)}-L${level}`;
                const storageCategoryId =
                  primaryGroup === "RM"
                    ? "sc_rm"
                    : primaryGroup === "FG"
                      ? "sc_fg"
                      : "sc_pm";

                // Blocked positions cluster near the top level and at the
                // ends of runs, which is what a real survey tends to show.
                const topLevel = level === run.levels - 1;
                const edgeBay = bay === 1 || bay === run.bays;
                const blockOdds =
                  BLOCKED_SHARE * (topLevel ? 2.4 : 1) * (edgeBay ? 1.8 : 1);
                const blocked = rng.chance(blockOdds);
                const blockPick = blocked
                  ? BLOCK_REASONS[
                      topLevel
                        ? 4
                        : edgeBay
                          ? rng.int(0, 2)
                          : rng.int(1, 3)
                    ]
                  : undefined;

                locations.push({
                  id: `loc_${rackId}_${bay}_${level}_${slot}`,
                  code: cellCode,
                  name: cellCode,
                  completeName: `${section.code}/${aisleShort}/${rackShort}/${cellCode}`,
                  kind: "cell",
                  usage: "internal",
                  warehouseId: WAREHOUSE.id,
                  zoneId,
                  aisleId: aisle.id,
                  rackId,
                  bay,
                  level,
                  slot,
                  isPosition: true,
                  palletCapacity: 1,
                  maxWeightKg: PALLET_LOAD_KG,
                  storageCategoryId,
                  blocked,
                  blockReason: blockPick?.reason,
                  blockNote: blockPick?.note,
                  ex: bay,
                  ey: level,
                });
              }
            }
          }

          cursorX += width + gap;
        }
      }
    });

    aisleOffset += section.aisles;
  }

  // --- logical locations, one set for the building ----------------------
  const logical: {
    key: string;
    code: string;
    name: string;
    kind: Location["kind"];
    zoneId?: string;
  }[] = [
    { key: "in", code: "IN", name: "Input / Goods-In", kind: "input", zoneId: "sec_raw" },
    { key: "out", code: "OUT", name: "Output / Dispatch Staging", kind: "output", zoneId: "sec_fg" },
    { key: "stg", code: "STG", name: "Floor Staging", kind: "staging" },
    { key: "qc", code: "QC", name: "Quality Hold", kind: "quality", zoneId: "sec_raw" },
  ];
  for (const l of logical) {
    locations.push({
      id: `loc_${WAREHOUSE.code.toLowerCase()}_${l.key}`,
      code: `${WAREHOUSE.code}/${l.code}`,
      name: l.name,
      completeName: `${WAREHOUSE.code}/${l.code}`,
      kind: l.kind,
      usage: "internal",
      warehouseId: WAREHOUSE.id,
      zoneId: l.zoneId,
      isPosition: false,
      palletCapacity: 999,
      maxWeightKg: 0,
      blocked: false,
    });
  }

  // Site-wide virtual locations, as in Odoo.
  locations.push(
    {
      id: "loc_vendors",
      code: "Partners/Vendors",
      name: "Vendors",
      completeName: "Partners/Vendors",
      kind: "supplier",
      usage: "supplier",
      isPosition: false,
      palletCapacity: 0,
      maxWeightKg: 0,
      blocked: false,
    },
    {
      id: "loc_customers",
      code: "Partners/Customers",
      name: "Customers",
      completeName: "Partners/Customers",
      kind: "customer",
      usage: "customer",
      isPosition: false,
      palletCapacity: 0,
      maxWeightKg: 0,
      blocked: false,
    },
    {
      id: "loc_transit",
      code: "Inter-warehouse Transit",
      name: "Inter-warehouse Transit",
      completeName: "Transit/Inter-warehouse",
      kind: "transit",
      usage: "transit",
      isPosition: false,
      palletCapacity: 0,
      maxWeightKg: 0,
      blocked: false,
    },
    {
      id: "loc_production",
      code: "Virtual/Production",
      name: "Production",
      completeName: "Virtual/Production",
      kind: "production",
      usage: "production",
      isPosition: false,
      palletCapacity: 0,
      maxWeightKg: 0,
      blocked: false,
    },
    {
      id: "loc_scrap",
      code: "Scrap",
      name: "Scrap",
      completeName: "Virtual/Scrap",
      kind: "scrap",
      usage: "inventory",
      isPosition: false,
      palletCapacity: 0,
      maxWeightKg: 0,
      blocked: false,
    },
  );

  // ------------------------------------------------------------ operation types
  const operationTypes: OperationType[] = [];
  for (const wh of warehouses) {
    const inLoc = `loc_${wh.code.toLowerCase()}_in`;
    const outLoc = `loc_${wh.code.toLowerCase()}_out`;
    operationTypes.push(
      {
        id: `ot_${wh.code.toLowerCase()}_in`,
        code: `${wh.code}/IN`,
        name: `${wh.code}: Receipts`,
        kind: "receipt",
        warehouseId: wh.id,
        sequencePrefix: `${wh.code}/IN/`,
        defaultSourceId: "loc_vendors",
        defaultDestId: inLoc,
      },
      {
        id: `ot_${wh.code.toLowerCase()}_put`,
        code: `${wh.code}/PUT`,
        name: `${wh.code}: Put-Away`,
        kind: "putaway",
        warehouseId: wh.id,
        sequencePrefix: `${wh.code}/PUT/`,
        defaultSourceId: inLoc,
      },
      // The two ends of production. Manufacturing itself is out of scope: the
      // warehouse issues raw material to a virtual production location and
      // receives finished goods back from it, with no order or bill of
      // materials in between.
      {
        id: `ot_${wh.code.toLowerCase()}_mo_issue`,
        code: `${wh.code}/PROD-OUT`,
        name: `${wh.code}: Issue to Production`,
        kind: "production_issue",
        warehouseId: wh.id,
        sequencePrefix: `${wh.code}/PRD-OUT/`,
        defaultDestId: "loc_production",
      },
      {
        id: `ot_${wh.code.toLowerCase()}_mo_receipt`,
        code: `${wh.code}/PROD-IN`,
        name: `${wh.code}: Receive from Production`,
        kind: "production_receipt",
        warehouseId: wh.id,
        sequencePrefix: `${wh.code}/PRD-IN/`,
        defaultSourceId: "loc_production",
      },
      {
        id: `ot_${wh.code.toLowerCase()}_int`,
        code: `${wh.code}/INT`,
        name: `${wh.code}: Internal Transfers`,
        kind: "internal",
        warehouseId: wh.id,
        sequencePrefix: `${wh.code}/INT/`,
      },
      {
        id: `ot_${wh.code.toLowerCase()}_pick`,
        code: `${wh.code}/PICK`,
        name: `${wh.code}: Pick`,
        kind: "pick",
        warehouseId: wh.id,
        sequencePrefix: `${wh.code}/PICK/`,
        defaultDestId: outLoc,
      },
      {
        id: `ot_${wh.code.toLowerCase()}_out`,
        code: `${wh.code}/OUT`,
        name: `${wh.code}: Delivery Orders`,
        kind: "delivery",
        warehouseId: wh.id,
        sequencePrefix: `${wh.code}/OUT/`,
        defaultSourceId: outLoc,
        defaultDestId: "loc_customers",
      },
    );
  }

  const operators = OPERATORS.map((op) => ({
    ...op,
    warehouseIds: warehouses.map((w) => w.id),
  }));

  // ------------------------------------------------------------------ lots
  const lots: Lot[] = [];
  const lotsByProduct = new Map<string, Lot[]>();
  let lotSeq = 0;

  for (const product of PRODUCTS) {
    const variantsOf = VARIANTS.filter((v) => v.productId === product.id);
    // More lots for fast-moving RM leaf, fewer for slow PM consumables.
    const lotCount =
      product.materialGroup === "RM" ? rng.int(14, 22)
      : product.materialGroup === "FG" ? rng.int(8, 14)
      : rng.int(4, 8);

    const bucket: Lot[] = [];
    for (let i = 0; i < lotCount; i++) {
      lotSeq += 1;
      const variant = rng.pick(variantsOf);
      // Spread receipts across ~330 days, weighted toward the recent months.
      const skew = rng.float() ** 1.7;
      const daysAgo = Math.round(skew * 330) + rng.int(1, 6);
      // Receipts land during working hours on their day, always in the past
      // relative to the fixed demonstration clock.
      const dayStart = addDays(now, -daysAgo);
      dayStart.setUTCHours(0, 0, 0, 0);
      const receiptDate = addHours(dayStart, rng.int(6, 17)).toISOString();
      const prefix =
        product.materialGroup === "RM"
          ? "RM"
          : product.materialGroup === "FG"
            ? "FG"
            : "PM";
      const lot: Lot = {
        id: `lot_${pad(lotSeq, 5)}`,
        name: `${prefix}/${new Date(receiptDate).getUTCFullYear()}/${pad(lotSeq, 5)}`,
        productId: product.id,
        variantId: variant.id,
        receiptDate,
        supplierRef:
          product.materialGroup === "PM"
            ? rng.pick(PACKAGING_SUPPLIERS).name
            : rng.pick(SUPPLIERS).name,
        origin:
          product.materialGroup === "RM"
            ? `${rng.pick(GARDEN_MARKS)} Estate`
            : undefined,
        gardenMark:
          product.materialGroup === "RM" ? rng.pick(GARDEN_MARKS) : undefined,
      };
      lots.push(lot);
      bucket.push(lot);
    }
    lotsByProduct.set(product.id, bucket);
  }

  // -------------------------------------------------------- pallets & stock
  const pallets: Pallet[] = [];
  const quants: Quant[] = [];
  let palletSeq = 0;
  let quantSeq = 0;

  // Stock is generated per section: the two sections hold different material
  // groups and run at different occupancies.
  const cellsBySection = new Map<string, Location[]>();
  for (const loc of locations) {
    if (loc.kind !== "cell" || !loc.zoneId) continue;
    const list = cellsBySection.get(loc.zoneId) ?? [];
    list.push(loc);
    cellsBySection.set(loc.zoneId, list);
  }

  /** Pallets that hold stock, kept for later history generation. */
  const storedPallets: StoredPallet[] = [];
  /** Positions left free per section, used to target pending put-aways. */
  const freeCellsBySection = new Map<string, Location[]>();

  for (const section of zones) {
    const cells = cellsBySection.get(section.id) ?? [];
    const free = cells.filter((c) => !c.blocked);
    const target = Math.round(free.length * (OCCUPANCY_TARGET[section.id] ?? 0.6));
    // Occupancy is not uniform: lower bays and mid-levels fill first, which is
    // what a real VNA warehouse looks like and makes the heat maps readable.
    const scored = free
      .map((cell) => {
        const levelPenalty = (cell.level ?? 0) * 0.055;
        const noise = rng.float() * 0.55;
        return { cell, score: noise + levelPenalty };
      })
      .sort((a, b) => a.score - b.score)
      .map((s) => s.cell);

    const chosen = scored.slice(0, target);
    freeCellsBySection.set(section.id, scored.slice(target));
    const groupProducts = PRODUCTS.filter((p) =>
      section.materialGroups.includes(p.materialGroup),
    );

    for (const cell of chosen) {
      palletSeq += 1;
      const pallet: Pallet = {
        id: `pal_${pad(palletSeq, 6)}`,
        name: `PAL-${pad(palletSeq, 6)}`,
        packageTypeId: "pkg_euro",
        locationId: cell.id,
        state: "stored",
        createdAt: DEMO_NOW_ISO,
      };
      pallets.push(pallet);

      // A small share of positions hold a physically present, empty pallet.
      if (rng.chance(EMPTY_PALLET_SHARE)) continue;

      const product = rng.pick(groupProducts);
      const lotPool = lotsByProduct.get(product.id) ?? [];
      if (!lotPool.length) continue;
      const lot = rng.pick(lotPool);
      const variant = VARIANTS.find((v) => v.id === lot.variantId)!;
      const capacity = palletCapacityFor(product, variant);

      const partial = rng.chance(PARTIAL_SHARE);
      const quantity = partial
        ? Math.max(
            1,
            Math.round(capacity * (0.12 + rng.float() * 0.74) * 100) / 100,
          )
        : capacity;

      quantSeq += 1;
      const quant: Quant = {
        id: `qt_${pad(quantSeq, 6)}`,
        productId: product.id,
        variantId: variant.id,
        lotId: lot.id,
        palletId: pallet.id,
        locationId: cell.id,
        quantity,
        reservedQuantity: 0,
        uom: product.uom,
        inDate: lot.receiptDate,
      };
      quants.push(quant);
      pallet.createdAt = lot.receiptDate;
      storedPallets.push({
        pallet,
        quant,
        lot,
        warehouseId: WAREHOUSE.id,
        sectionId: section.id,
      });
    }
  }

  // Pallets received but not yet put away. These sit in the warehouse Input
  // area and each has a Ready put-away claiming a specific empty position, so
  // "reserved for incoming" is real state rather than a decorative label.
  const inboundPallets: StoredPallet[] = [];
  for (const section of zones) {
    const inLocationId = `loc_${WAREHOUSE.code.toLowerCase()}_in`;
    const groupProducts = PRODUCTS.filter((p) =>
      section.materialGroups.includes(p.materialGroup),
    );
    const count = rng.int(6, 11);
    for (let i = 0; i < count; i++) {
      const product = rng.pick(groupProducts);
      const variant = rng.pick(VARIANTS.filter((v) => v.productId === product.id));
      const capacity = palletCapacityFor(product, variant);

      const dayStart = addDays(now, -rng.int(1, 3));
      dayStart.setUTCHours(0, 0, 0, 0);
      const receiptDate = addHours(dayStart, rng.int(7, 15)).toISOString();

      lotSeq += 1;
      const prefix =
        product.materialGroup === "RM"
          ? "RM"
          : product.materialGroup === "FG"
            ? "FG"
            : "PM";
      const lot: Lot = {
        id: `lot_${pad(lotSeq, 5)}`,
        name: `${prefix}/${new Date(receiptDate).getUTCFullYear()}/${pad(lotSeq, 5)}`,
        productId: product.id,
        variantId: variant.id,
        receiptDate,
        supplierRef: rng.pick(
          product.materialGroup === "PM" ? PACKAGING_SUPPLIERS : SUPPLIERS,
        ).name,
        origin:
          product.materialGroup === "RM"
            ? `${rng.pick(GARDEN_MARKS)} Estate`
            : undefined,
        gardenMark:
          product.materialGroup === "RM" ? rng.pick(GARDEN_MARKS) : undefined,
      };
      lots.push(lot);

      palletSeq += 1;
      const pallet: Pallet = {
        id: `pal_${pad(palletSeq, 6)}`,
        name: `PAL-${pad(palletSeq, 6)}`,
        packageTypeId: "pkg_euro",
        locationId: inLocationId,
        state: "staged",
        createdAt: receiptDate,
      };
      pallets.push(pallet);

      quantSeq += 1;
      const quant: Quant = {
        id: `qt_${pad(quantSeq, 6)}`,
        productId: product.id,
        variantId: variant.id,
        lotId: lot.id,
        palletId: pallet.id,
        locationId: inLocationId,
        quantity: rng.chance(0.75)
          ? capacity
          : Math.max(1, Math.round(capacity * (0.3 + rng.float() * 0.6) * 100) / 100),
        reservedQuantity: 0,
        uom: product.uom,
        inDate: receiptDate,
      };
      quants.push(quant);
      inboundPallets.push({
        pallet,
        quant,
        lot,
        warehouseId: WAREHOUSE.id,
        sectionId: section.id,
      });
    }
  }

  // Free pallets waiting in the yard, available for the next receipt.
  for (let i = 0; i < 46; i++) {
    palletSeq += 1;
    pallets.push({
      id: `pal_${pad(palletSeq, 6)}`,
      name: `PAL-${pad(palletSeq, 6)}`,
      packageTypeId: rng.chance(0.12) ? "pkg_half" : "pkg_euro",
      locationId: null,
      state: "free",
      createdAt: addDays(now, -rng.int(20, 300)).toISOString(),
    });
  }

  const built = buildOperations({
    rng,
    now,
    warehouses,
    operationTypes,
    operators,
    locations,
    storedPallets,
    inboundPallets,
    freeCellsBySection,
    quants,
    pallets,
  });

  return {
    sites,
    warehouses,
    zones,
    aisles,
    rackProfiles: RACK_PROFILES,
    racks,
    storageCategories: STORAGE_CATEGORIES,
    locations,
    packageTypes: PACKAGE_TYPES,
    pallets,
    productCategories: PRODUCT_CATEGORIES,
    products: PRODUCTS,
    variants: VARIANTS,
    lots,
    quants,
    operationTypes,
    operators,
    partners: PARTNERS,
    operations: built.operations,
    moves: built.moves,
    moveLines: built.moveLines,
    reservations: built.reservations,
  };
}

// -------------------------------------------------------------- operations

interface StoredPallet {
  pallet: Pallet;
  quant: Quant;
  lot: Lot;
  warehouseId: string;
  /** Which section of the building the pallet belongs to. */
  sectionId: string;
}

interface OpBuildArgs {
  rng: Rng;
  now: Date;
  warehouses: Warehouse[];
  operationTypes: OperationType[];
  operators: Operator[];
  locations: Location[];
  storedPallets: StoredPallet[];
  inboundPallets: StoredPallet[];
  freeCellsBySection: Map<string, Location[]>;
  quants: Quant[];
  pallets: Pallet[];
}

/** History window: operations older than this are treated as opening balance. */
const HISTORY_DAYS = 180;

function buildOperations(args: OpBuildArgs): {
  operations: Operation[];
  moves: Move[];
  moveLines: MoveLine[];
  reservations: Reservation[];
} {
  const { rng, now, warehouses, operationTypes, operators, locations } = args;

  const operations: Operation[] = [];
  const moves: Move[] = [];
  const moveLines: MoveLine[] = [];
  const reservations: Reservation[] = [];

  const seqByPrefix = new Map<string, number>();
  const nextName = (prefix: string) => {
    const n = (seqByPrefix.get(prefix) ?? 0) + 1;
    seqByPrefix.set(prefix, n);
    return `${prefix}${pad(n, 5)}`;
  };

  let opSeq = 0;
  let moveSeq = 0;
  let lineSeq = 0;
  let resSeq = 0;

  const typeFor = (whId: string, kind: OperationKind) =>
    operationTypes.find((t) => t.warehouseId === whId && t.kind === kind)!;

  const locOf = (id: string) => locations.find((l) => l.id === id)!;

  const addOperation = (op: Omit<Operation, "id" | "name">): Operation => {
    opSeq += 1;
    const type = operationTypes.find((t) => t.id === op.typeId)!;
    const record: Operation = {
      ...op,
      id: `op_${pad(opSeq, 6)}`,
      name: nextName(type.sequencePrefix),
    };
    operations.push(record);
    return record;
  };

  const moveCountByOp = new Map<string, number>();
  const addMove = (
    op: Operation,
    input: Omit<Move, "id" | "operationId" | "sequence" | "state">,
  ): Move => {
    moveSeq += 1;
    const sequence = (moveCountByOp.get(op.id) ?? 0) + 1;
    moveCountByOp.set(op.id, sequence);
    const move: Move = {
      ...input,
      id: `mv_${pad(moveSeq, 6)}`,
      operationId: op.id,
      sequence,
      state: op.state,
    };
    moves.push(move);
    return move;
  };

  const addLine = (
    op: Operation,
    move: Move,
    input: Omit<
      MoveLine,
      "id" | "moveId" | "operationId" | "state" | "productId" | "variantId" | "uom"
    >,
  ): MoveLine => {
    lineSeq += 1;
    const line: MoveLine = {
      ...input,
      id: `ml_${pad(lineSeq, 6)}`,
      moveId: move.id,
      operationId: op.id,
      productId: move.productId,
      variantId: move.variantId,
      uom: move.uom,
      state: op.state,
    };
    moveLines.push(line);
    return line;
  };

  // ---- 1. history for pallets received inside the history window --------
  const recent = args.storedPallets.filter(
    (p) =>
      (now.getTime() - new Date(p.lot.receiptDate).getTime()) / 86_400_000 <=
      HISTORY_DAYS,
  );

  // Group pallets into receipts by warehouse and receipt day.
  const receiptGroups = new Map<string, typeof recent>();
  for (const entry of recent) {
    const day = entry.lot.receiptDate.slice(0, 10);
    const key = `${entry.warehouseId}|${day}|${Math.floor(rng.float() * 3)}`;
    const list = receiptGroups.get(key) ?? [];
    list.push(entry);
    receiptGroups.set(key, list);
  }

  for (const [key, entries] of receiptGroups) {
    const warehouseId = key.split("|")[0];
    const wh = warehouses.find((w) => w.id === warehouseId)!;
    const inLoc = `loc_${wh.code.toLowerCase()}_in`;
    const receiptAt = entries[0].lot.receiptDate;
    const operator = rng.pick(operators);
    const supplier = rng.pick(SUPPLIERS);

    // ---- receipt: vendor -> input
    const receiptType = typeFor(wh.id, "receipt");
    const receipt = addOperation({
      typeId: receiptType.id,
      kind: "receipt",
      state: "done",
      warehouseId: wh.id,
      sourceLocationId: "loc_vendors",
      destLocationId: inLoc,
      partnerId: supplier.id,
      operatorId: operator.id,
      sourceDocument: `PO/${new Date(receiptAt).getUTCFullYear()}/${pad(
        rng.int(1, 9999),
        4,
      )}`,
      scheduledAt: receiptAt,
      createdAt: addHours(new Date(receiptAt), -rng.int(4, 40)).toISOString(),
      effectiveAt: receiptAt,
    });

    for (const entry of entries) {
      const move = addMove(receipt, {
        productId: entry.quant.productId,
        variantId: entry.quant.variantId,
        uom: entry.quant.uom,
        demandQty: entry.quant.quantity,
        doneQty: entry.quant.quantity,
        sourceLocationId: "loc_vendors",
        destLocationId: inLoc,
      });
      addLine(receipt, move, {
        lotId: entry.lot.id,
        quantity: entry.quant.quantity,
        doneQty: entry.quant.quantity,
        sourceLocationId: "loc_vendors",
        destLocationId: inLoc,
        sourcePalletId: null,
        destPalletId: entry.pallet.id,
        doneAt: receiptAt,
      });
    }

    // ---- put-away: input -> cell
    const putAt = addHours(new Date(receiptAt), rng.int(1, 9)).toISOString();
    const putType = typeFor(wh.id, "putaway");
    const putaway = addOperation({
      typeId: putType.id,
      kind: "putaway",
      state: "done",
      warehouseId: wh.id,
      sourceLocationId: inLoc,
      destLocationId: entries[0].pallet.locationId ?? inLoc,
      operatorId: rng.pick(operators).id,
      sourceDocument: receipt.name,
      scheduledAt: putAt,
      createdAt: receiptAt,
      effectiveAt: putAt,
      originOperationId: receipt.id,
    });

    for (const entry of entries) {
      const dest = entry.pallet.locationId!;
      const move = addMove(putaway, {
        productId: entry.quant.productId,
        variantId: entry.quant.variantId,
        uom: entry.quant.uom,
        demandQty: entry.quant.quantity,
        doneQty: entry.quant.quantity,
        sourceLocationId: inLoc,
        destLocationId: dest,
      });
      addLine(putaway, move, {
        lotId: entry.lot.id,
        quantity: entry.quant.quantity,
        doneQty: entry.quant.quantity,
        sourceLocationId: inLoc,
        destLocationId: dest,
        sourcePalletId: entry.pallet.id,
        destPalletId: entry.pallet.id,
        doneAt: putAt,
      });
    }
  }

  // ---- 2. historical relocations ----------------------------------------
  // Index cells per warehouse once so picking a plausible previous position is
  // both cheap and varied.
  const cellIndex = new Map<string, Location[]>();
  for (const loc of locations) {
    if (loc.kind !== "cell" || !loc.warehouseId || loc.blocked) continue;
    const list = cellIndex.get(loc.warehouseId) ?? [];
    list.push(loc);
    cellIndex.set(loc.warehouseId, list);
  }

  const relocatable = rng.shuffle(recent).slice(0, Math.round(recent.length * 0.14));
  for (const entry of relocatable) {
    const wh = warehouses.find((w) => w.id === entry.warehouseId)!;
    const dest = locOf(entry.pallet.locationId!);
    // Fabricate a plausible previous position elsewhere in the same warehouse.
    const pool = cellIndex.get(wh.id) ?? [];
    let previous: Location | undefined;
    for (let attempt = 0; attempt < 6 && !previous; attempt++) {
      const candidate = rng.pick(pool);
      if (candidate && candidate.rackId !== dest.rackId) previous = candidate;
    }
    if (!previous) continue;
    const movedAt = addHours(
      new Date(entry.lot.receiptDate),
      rng.int(48, 1400),
    );
    if (movedAt > now) continue;

    const intType = typeFor(wh.id, "internal");
    const op = addOperation({
      typeId: intType.id,
      kind: "internal",
      state: "done",
      warehouseId: wh.id,
      sourceLocationId: previous.id,
      destLocationId: dest.id,
      operatorId: rng.pick(operators).id,
      scheduledAt: movedAt.toISOString(),
      createdAt: movedAt.toISOString(),
      effectiveAt: movedAt.toISOString(),
      note: "Consolidation move recorded during the demonstration period.",
    });
    const move = addMove(op, {
      productId: entry.quant.productId,
      variantId: entry.quant.variantId,
      uom: entry.quant.uom,
      demandQty: entry.quant.quantity,
      doneQty: entry.quant.quantity,
      sourceLocationId: previous.id,
      destLocationId: dest.id,
    });
    addLine(op, move, {
      lotId: entry.lot.id,
      quantity: entry.quant.quantity,
      doneQty: entry.quant.quantity,
      sourceLocationId: previous.id,
      destLocationId: dest.id,
      sourcePalletId: entry.pallet.id,
      destPalletId: entry.pallet.id,
      doneAt: movedAt.toISOString(),
    });
  }

  // ---- 2b. the production flow ------------------------------------------
  //
  // Raw material and packing material are issued out of the Raw section to a
  // virtual production location; finished goods come back from it into the FG
  // section. Manufacturing itself is out of scope - there is no order and no
  // bill of materials - but the warehouse still has to show stock leaving one
  // section and arriving in the other, because that is what an operator sees.
  for (const wh of args.warehouses) {
    const rawPool = args.storedPallets.filter(
      (entry) => entry.sectionId === "sec_raw",
    );
    const fgPool = args.storedPallets.filter(
      (entry) => entry.sectionId === "sec_fg",
    );
    if (!rawPool.length || !fgPool.length) continue;

    const issueType = typeFor(wh.id, "production_issue");
    const receiptType = typeFor(wh.id, "production_receipt");
    const runs = Math.max(6, Math.round(rawPool.length * 0.05));

    for (let i = 0; i < runs; i++) {
      const daysAgo = rng.int(1, HISTORY_DAYS);
      const at = addHours(addDays(now, -daysAgo), rng.int(6, 16));
      // Both halves of a run are decided together. Creating the issue and then
      // skipping the receipt because it would land after the demo clock left
      // raw material that had gone to production and never come back - stock
      // that simply vanished from the building.
      const producedAt = addHours(at, rng.int(4, 30));
      if (producedAt > now) continue;
      const operator = rng.pick(operators);
      const batchRef = `PRD/${at.getUTCFullYear()}/${pad(rng.int(1, 9999), 4)}`;

      // --- issue raw material out of the Raw section
      const consumed = rng.shuffle(rawPool).slice(0, rng.int(1, 3));
      const issue = addOperation({
        typeId: issueType.id,
        kind: "production_issue",
        state: "done",
        warehouseId: wh.id,
        sourceLocationId: consumed[0].pallet.locationId!,
        destLocationId: "loc_production",
        operatorId: operator.id,
        sourceDocument: batchRef,
        scheduledAt: at.toISOString(),
        createdAt: addHours(at, -rng.int(2, 12)).toISOString(),
        effectiveAt: at.toISOString(),
        note: "Raw material issued to production. Production itself is outside the scope of this prototype.",
      });

      for (const entry of consumed) {
        const qty =
          Math.round(entry.quant.quantity * (0.3 + rng.float() * 0.6) * 100) / 100;
        const move = addMove(issue, {
          productId: entry.quant.productId,
          variantId: entry.quant.variantId,
          uom: entry.quant.uom,
          demandQty: qty,
          doneQty: qty,
          sourceLocationId: entry.pallet.locationId!,
          destLocationId: "loc_production",
        });
        addLine(issue, move, {
          lotId: entry.lot.id,
          quantity: qty,
          doneQty: qty,
          sourceLocationId: entry.pallet.locationId!,
          destLocationId: "loc_production",
          sourcePalletId: entry.pallet.id,
          destPalletId: null,
          doneAt: at.toISOString(),
        });
      }

      // --- receive finished goods back into the FG section
      const produced = rng.shuffle(fgPool).slice(0, rng.int(1, 2));
      const receipt = addOperation({
        typeId: receiptType.id,
        kind: "production_receipt",
        state: "done",
        warehouseId: wh.id,
        sourceLocationId: "loc_production",
        destLocationId: produced[0].pallet.locationId!,
        operatorId: rng.pick(operators).id,
        sourceDocument: batchRef,
        scheduledAt: producedAt.toISOString(),
        createdAt: at.toISOString(),
        effectiveAt: producedAt.toISOString(),
        originOperationId: issue.id,
        note: "Finished goods received from production into the FG section.",
      });

      for (const entry of produced) {
        const dest = entry.pallet.locationId!;
        const move = addMove(receipt, {
          productId: entry.quant.productId,
          variantId: entry.quant.variantId,
          uom: entry.quant.uom,
          demandQty: entry.quant.quantity,
          doneQty: entry.quant.quantity,
          sourceLocationId: "loc_production",
          destLocationId: dest,
        });
        addLine(receipt, move, {
          lotId: entry.lot.id,
          quantity: entry.quant.quantity,
          doneQty: entry.quant.quantity,
          sourceLocationId: "loc_production",
          destLocationId: dest,
          sourcePalletId: null,
          destPalletId: entry.pallet.id,
          doneAt: producedAt.toISOString(),
        });
      }
    }
  }

  // ---- 3. historical picks and deliveries -------------------------------
  for (const wh of warehouses) {
    const pool = args.storedPallets.filter((p) => p.warehouseId === wh.id);
    if (!pool.length) continue;
    const outLoc = `loc_${wh.code.toLowerCase()}_out`;
    const deliveries = Math.round(pool.length * 0.09);

    for (let i = 0; i < deliveries; i++) {
      const daysAgo = rng.int(1, HISTORY_DAYS);
      const at = addHours(addDays(now, -daysAgo), rng.int(7, 18));
      const customer = rng.pick(CUSTOMERS);
      const lines = rng.int(1, 3);
      const picked = rng.shuffle(pool).slice(0, lines);
      const operator = rng.pick(operators);
      const pickedQty = new Map<string, number>();

      const pickType = typeFor(wh.id, "pick");
      const pick = addOperation({
        typeId: pickType.id,
        kind: "pick",
        state: "done",
        warehouseId: wh.id,
        sourceLocationId: picked[0].pallet.locationId!,
        destLocationId: outLoc,
        partnerId: customer.id,
        operatorId: operator.id,
        scheduledAt: at.toISOString(),
        createdAt: addHours(at, -rng.int(2, 20)).toISOString(),
        effectiveAt: at.toISOString(),
        sourceDocument: `SO/${at.getUTCFullYear()}/${pad(rng.int(1, 9999), 4)}`,
        manualLotSelection: rng.chance(0.18),
      });
      if (pick.manualLotSelection) {
        pick.blendRef = `BLD/${at.getUTCFullYear()}/${pad(rng.int(1, 400), 3)}`;
        pick.note =
          "Lots selected manually by an authorised user against an approved blend requirement (SRS REQ-BLD-002). No blend sheet is generated in this prototype.";
      }

      for (const entry of picked) {
        const capacity = entry.quant.quantity;
        const qty = rng.chance(0.45)
          ? Math.round(capacity * (0.2 + rng.float() * 0.5) * 100) / 100
          : capacity;
        pickedQty.set(entry.pallet.id, qty);
        const move = addMove(pick, {
          productId: entry.quant.productId,
          variantId: entry.quant.variantId,
          uom: entry.quant.uom,
          demandQty: qty,
          doneQty: qty,
          sourceLocationId: entry.pallet.locationId!,
          destLocationId: outLoc,
        });
        addLine(pick, move, {
          lotId: entry.lot.id,
          quantity: qty,
          doneQty: qty,
          sourceLocationId: entry.pallet.locationId!,
          destLocationId: outLoc,
          sourcePalletId: entry.pallet.id,
          destPalletId: null,
          doneAt: at.toISOString(),
        });
      }

      // matching delivery out of the site
      const deliverAt = addHours(at, rng.int(1, 10));
      const outType = typeFor(wh.id, "delivery");
      const delivery = addOperation({
        typeId: outType.id,
        kind: "delivery",
        state: "done",
        warehouseId: wh.id,
        sourceLocationId: outLoc,
        destLocationId: "loc_customers",
        partnerId: customer.id,
        operatorId: operator.id,
        scheduledAt: deliverAt.toISOString(),
        createdAt: at.toISOString(),
        effectiveAt: deliverAt.toISOString(),
        sourceDocument: pick.sourceDocument,
        originOperationId: pick.id,
      });
      for (const entry of picked) {
        const qty = pickedQty.get(entry.pallet.id) ?? 0;
        if (!qty) continue;
        const move = addMove(delivery, {
          productId: entry.quant.productId,
          variantId: entry.quant.variantId,
          uom: entry.quant.uom,
          demandQty: qty,
          doneQty: qty,
          sourceLocationId: outLoc,
          destLocationId: "loc_customers",
        });
        addLine(delivery, move, {
          lotId: entry.lot.id,
          quantity: qty,
          doneQty: qty,
          sourceLocationId: outLoc,
          destLocationId: "loc_customers",
          sourcePalletId: null,
          destPalletId: null,
          doneAt: deliverAt.toISOString(),
        });
      }
    }
  }

  // ---- 3b. received but not yet put away --------------------------------
  // A done receipt brought these pallets to Input; a Ready put-away claims a
  // specific empty position for each one, which is what makes a cell show as
  // "reserved for incoming".
  const inboundByWarehouse = new Map<string, StoredPallet[]>();
  for (const entry of args.inboundPallets) {
    const list = inboundByWarehouse.get(entry.warehouseId) ?? [];
    list.push(entry);
    inboundByWarehouse.set(entry.warehouseId, list);
  }

  for (const [warehouseId, entries] of inboundByWarehouse) {
    const wh = warehouses.find((w) => w.id === warehouseId)!;
    const inLoc = `loc_${wh.code.toLowerCase()}_in`;
    const receiptAt = entries[0].lot.receiptDate;
    const supplier = rng.pick(SUPPLIERS);

    const receipt = addOperation({
      typeId: typeFor(wh.id, "receipt").id,
      kind: "receipt",
      state: "done",
      warehouseId: wh.id,
      sourceLocationId: "loc_vendors",
      destLocationId: inLoc,
      partnerId: supplier.id,
      operatorId: rng.pick(operators).id,
      sourceDocument: `PO/${new Date(receiptAt).getUTCFullYear()}/${pad(rng.int(1, 9999), 4)}`,
      scheduledAt: receiptAt,
      createdAt: addHours(new Date(receiptAt), -rng.int(4, 30)).toISOString(),
      effectiveAt: receiptAt,
      note: "Received into the input area. Put-away is still outstanding.",
    });

    for (const entry of entries) {
      const move = addMove(receipt, {
        productId: entry.quant.productId,
        variantId: entry.quant.variantId,
        uom: entry.quant.uom,
        demandQty: entry.quant.quantity,
        doneQty: entry.quant.quantity,
        sourceLocationId: "loc_vendors",
        destLocationId: inLoc,
      });
      addLine(receipt, move, {
        lotId: entry.lot.id,
        quantity: entry.quant.quantity,
        doneQty: entry.quant.quantity,
        sourceLocationId: "loc_vendors",
        destLocationId: inLoc,
        sourcePalletId: null,
        destPalletId: entry.pallet.id,
        doneAt: entry.lot.receiptDate,
      });
    }

    // One Ready put-away per pallet, each claiming a distinct empty position
    // in the section that pallet belongs to - raw stock does not get put away
    // into finished-goods racking.
    const freeBySection = new Map<string, Location[]>();
    for (const [sectionId, list] of args.freeCellsBySection) {
      freeBySection.set(sectionId, rng.shuffle(list));
    }
    const cursorBySection = new Map<string, number>();

    for (const entry of entries) {
      const pool = freeBySection.get(entry.sectionId) ?? [];
      let cellCursor = cursorBySection.get(entry.sectionId) ?? 0;
      let dest: Location | undefined;
      while (cellCursor < pool.length && !dest) {
        const candidate: Location = pool[cellCursor++];
        if (!candidate.blocked) dest = candidate;
      }
      cursorBySection.set(entry.sectionId, cellCursor);
      if (!dest) break;

      const putAt = addHours(now, rng.int(1, 20)).toISOString();
      const putaway = addOperation({
        typeId: typeFor(wh.id, "putaway").id,
        kind: "putaway",
        state: "ready",
        warehouseId: wh.id,
        sourceLocationId: inLoc,
        destLocationId: dest.id,
        operatorId: rng.pick(operators).id,
        sourceDocument: receipt.name,
        scheduledAt: putAt,
        createdAt: entry.lot.receiptDate,
        originOperationId: receipt.id,
        note: `Suggested position ${dest.completeName} - empty, unblocked and compatible.`,
      });
      const move = addMove(putaway, {
        productId: entry.quant.productId,
        variantId: entry.quant.variantId,
        uom: entry.quant.uom,
        demandQty: entry.quant.quantity,
        doneQty: 0,
        sourceLocationId: inLoc,
        destLocationId: dest.id,
      });
      const line = addLine(putaway, move, {
        lotId: entry.lot.id,
        quantity: entry.quant.quantity,
        doneQty: 0,
        sourceLocationId: inLoc,
        destLocationId: dest.id,
        sourcePalletId: entry.pallet.id,
        destPalletId: entry.pallet.id,
      });

      // The stock is physically in Input and committed to this put-away.
      entry.quant.reservedQuantity = entry.quant.quantity;
      resSeq += 1;
      reservations.push({
        id: `rs_${pad(resSeq, 6)}`,
        moveLineId: line.id,
        quantId: entry.quant.id,
        quantity: entry.quant.quantity,
        createdAt: putaway.createdAt,
      });
    }
  }

  // ---- 4. live operations, with real reservations -----------------------
  for (const wh of warehouses) {
    const pool = args.storedPallets.filter((p) => p.warehouseId === wh.id);
    if (!pool.length) continue;
    const inLoc = `loc_${wh.code.toLowerCase()}_in`;
    const outLoc = `loc_${wh.code.toLowerCase()}_out`;

    // Ready picks reserve stock. Reservation reduces available, never on-hand.
    const readyCount = Math.max(3, Math.round(pool.length * 0.012));
    const candidates = rng.shuffle(pool).slice(0, readyCount * 3);
    let made = 0;

    for (const entry of candidates) {
      if (made >= readyCount) break;
      // storedPallets holds the same quant object instances as dataset.quants,
      // so mutating this reference updates the dataset.
      const quant = entry.quant;
      const available = quant.quantity - quant.reservedQuantity;
      if (available <= 1) continue;

      const at = addHours(now, rng.int(2, 72));
      const customer = rng.pick(CUSTOMERS);
      const qty =
        Math.round(Math.min(available, available * (0.3 + rng.float() * 0.7)) * 100) /
        100;

      const pickType = typeFor(wh.id, "pick");
      const pick = addOperation({
        typeId: pickType.id,
        kind: "pick",
        state: "ready",
        warehouseId: wh.id,
        sourceLocationId: entry.pallet.locationId!,
        destLocationId: outLoc,
        partnerId: customer.id,
        operatorId: rng.pick(operators).id,
        scheduledAt: at.toISOString(),
        createdAt: addHours(now, -rng.int(2, 30)).toISOString(),
        sourceDocument: `SO/${now.getUTCFullYear()}/${pad(rng.int(1, 9999), 4)}`,
      });
      const move = addMove(pick, {
        productId: quant.productId,
        variantId: quant.variantId,
        uom: quant.uom,
        demandQty: qty,
        doneQty: 0,
        sourceLocationId: entry.pallet.locationId!,
        destLocationId: outLoc,
      });
      const line = addLine(pick, move, {
        lotId: entry.lot.id,
        quantity: qty,
        doneQty: 0,
        sourceLocationId: entry.pallet.locationId!,
        destLocationId: outLoc,
        sourcePalletId: entry.pallet.id,
        destPalletId: null,
      });

      quant.reservedQuantity = Math.round((quant.reservedQuantity + qty) * 100) / 100;
      resSeq += 1;
      reservations.push({
        id: `rs_${pad(resSeq, 6)}`,
        moveLineId: line.id,
        quantId: quant.id,
        quantity: qty,
        createdAt: pick.createdAt,
      });
      made += 1;
    }

    // Waiting picks: demand exists but nothing reserved yet.
    for (let i = 0; i < Math.max(2, Math.round(readyCount * 0.6)); i++) {
      const entry = rng.pick(pool);
      const at = addHours(now, rng.int(24, 160));
      const customer = rng.pick(CUSTOMERS);
      const pickType = typeFor(wh.id, "pick");
      const pick = addOperation({
        typeId: pickType.id,
        kind: "pick",
        state: "waiting",
        warehouseId: wh.id,
        sourceLocationId: entry.pallet.locationId!,
        destLocationId: outLoc,
        partnerId: customer.id,
        operatorId: rng.pick(operators).id,
        scheduledAt: at.toISOString(),
        createdAt: addHours(now, -rng.int(1, 12)).toISOString(),
        sourceDocument: `SO/${now.getUTCFullYear()}/${pad(rng.int(1, 9999), 4)}`,
        note: "Awaiting upstream availability.",
      });
      const qty = Math.round(entry.quant.quantity * 0.5 * 100) / 100;
      addMove(pick, {
        productId: entry.quant.productId,
        variantId: entry.quant.variantId,
        uom: entry.quant.uom,
        demandQty: qty,
        doneQty: 0,
        sourceLocationId: entry.pallet.locationId!,
        destLocationId: outLoc,
      });
    }

    // Draft receipts waiting to be processed - they must not touch stock.
    for (let i = 0; i < 3; i++) {
      const supplier = rng.pick(SUPPLIERS);
      const at = addHours(now, rng.int(6, 120));
      const receiptType = typeFor(wh.id, "receipt");
      const receipt = addOperation({
        typeId: receiptType.id,
        kind: "receipt",
        state: "draft",
        warehouseId: wh.id,
        sourceLocationId: "loc_vendors",
        destLocationId: inLoc,
        partnerId: supplier.id,
        operatorId: rng.pick(operators).id,
        scheduledAt: at.toISOString(),
        createdAt: addHours(now, -rng.int(1, 24)).toISOString(),
        sourceDocument: `PO/${now.getUTCFullYear()}/${pad(rng.int(1, 9999), 4)}`,
      });
      const productPool = PRODUCTS.filter((p) =>
        wh.materialGroups.includes(p.materialGroup),
      );
      for (let l = 0; l < rng.int(1, 3); l++) {
        const product = rng.pick(productPool);
        const variant = rng.pick(VARIANTS.filter((v) => v.productId === product.id));
        addMove(receipt, {
          productId: product.id,
          variantId: variant.id,
          uom: product.uom,
          demandQty: palletCapacityFor(product, variant) * rng.int(1, 4),
          doneQty: 0,
          sourceLocationId: "loc_vendors",
          destLocationId: inLoc,
        });
      }
    }

    // A couple of cancelled operations so the state filter has real data.
    const cancelEntry = rng.pick(pool);
    const intType = typeFor(wh.id, "internal");
    const cancelled = addOperation({
      typeId: intType.id,
      kind: "internal",
      state: "cancel",
      warehouseId: wh.id,
      sourceLocationId: cancelEntry.pallet.locationId!,
      destLocationId: outLoc,
      operatorId: rng.pick(operators).id,
      scheduledAt: addDays(now, -rng.int(2, 20)).toISOString(),
      createdAt: addDays(now, -rng.int(21, 40)).toISOString(),
      note: "Cancelled before validation. Reservations were released.",
    });
    addMove(cancelled, {
      productId: cancelEntry.quant.productId,
      variantId: cancelEntry.quant.variantId,
      uom: cancelEntry.quant.uom,
      demandQty: cancelEntry.quant.quantity,
      doneQty: 0,
      sourceLocationId: cancelEntry.pallet.locationId!,
      destLocationId: outLoc,
    });
  }

  return { operations, moves, moveLines, reservations };
}
