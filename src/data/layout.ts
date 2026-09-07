/**
 * Warehouse layout specification derived from the MinMax Rack Industry
 * drawings supplied by the client.
 *
 *   Job 2304-24122024, Revise 10 dated 29.09.25  ("Job 2304 241225-Revise 10-Up3.pdf")
 *   Job 2579-180825,   Revise 2  dated 10.02.26  ("WH-2Job 2579-180825-Revise 2-OP 2.pdf")
 *
 * HOW THE DRAWING TABLES WERE READ
 * --------------------------------
 * Each "STORAGE CAPACITY" table lists, per rack profile:
 *   START RACK | EXT. RACK | RACK QTY | TOTAL LEVEL | PALLET PER RACK | TOTAL PALLET
 *
 * A "rack" in those tables is one *bay*: a start bay carries two frames, each
 * extension bay adds one frame and shares the previous one. Reading
 * PALLET PER RACK against TOTAL LEVEL gives a rule that reconciles every single
 * row of all four tables without exception:
 *
 *     pallets per bay = (TOTAL LEVEL + 1) x positions per level
 *
 * i.e. the table's level count is the number of *beam* levels and the ground
 * position is additional. Positions per level is 2 on the 2300 mm profiles
 * (R1, R2, R3, R4, 4R4, R5, R6, 6R6 on Job 2304) and 1 on the 1200 mm "H"
 * profiles, which matches the elevation details on those sheets.
 *
 * Worked check, Job 2579 R1: 160 bays x (4+1) levels x 2 = 1,600 pallets, and
 * 160 x 4 x 1,600 kg/level = 1,024,000 kg = 1,024 t. The drawing prints exactly
 * 1600 and 1213 t total against 1,895 pallets. Every other row agrees too; the
 * assertions at the bottom of this file re-check it at runtime.
 *
 * WHAT IS ASSUMED, NOT DRAWN
 * --------------------------
 * - Grouping of bays into named rack runs and aisles. The drawings show rack
 *   lines but the extracted text carries no aisle labelling, so runs and aisle
 *   names here are a documented schematic.
 * - Floor-plan geometry. PDF page rendering was unavailable, so plan positions
 *   are schematic rectangles laid out to the drawn building proportions, not
 *   traced coordinates.
 * - Material group per area, except where the drawing labels it.
 */

import type { MaterialGroup, RackProfile } from "./types";

export const DRAWING_JOB_2304 =
  "MinMax Job 2304-24122024, Revise 10 (29.09.25)";
export const DRAWING_JOB_2579 = "MinMax Job 2579-180825, Revise 2 (10.02.26)";

/** Every pallet position on these drawings is rated 800 kg. */
export const PALLET_LOAD_KG = 800;

export interface ProfileGroupSpec {
  profileCode: string;
  /** RACK QTY from the drawing table = number of bays. */
  bays: number;
  /** TOTAL LEVEL from the table (beam levels; ground position is extra). */
  beamLevels: number;
  positionsPerLevel: number;
  /** TOTAL PALLET printed on the drawing, used as a runtime check. */
  declaredPositions: number;
}

export interface WarehouseSpec {
  id: string;
  code: string;
  name: string;
  siteId: string;
  drawingRef: string;
  sheet: string;
  materialGroups: MaterialGroup[];
  materialGroupConfirmed: boolean;
  sourceNote: string;
  declaredPositions: number;
  declaredBays: number;
  footprint: { width: number; depth: number; unit: "ft" };
  /** Aisle count used by the schematic layout. */
  aisles: number;
  groups: ProfileGroupSpec[];
}

export const RACK_PROFILES: RackProfile[] = [
  {
    code: "R1",
    bayWidthMm: 2300,
    depthMm: 1000,
    heightMm: 8900,
    loadPerLevelKg: 1600,
    palletsPerBayLevel: 2,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "R1H",
    bayWidthMm: 1200,
    depthMm: 1000,
    heightMm: 8900,
    loadPerLevelKg: 800,
    palletsPerBayLevel: 1,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "R2",
    bayWidthMm: 2300,
    depthMm: 1000,
    heightMm: 10000,
    loadPerLevelKg: 1600,
    palletsPerBayLevel: 2,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "R2H",
    bayWidthMm: 1200,
    depthMm: 1000,
    heightMm: 12000,
    loadPerLevelKg: 800,
    palletsPerBayLevel: 1,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "R3",
    bayWidthMm: 2300,
    depthMm: 1000,
    heightMm: 10500,
    loadPerLevelKg: 1600,
    palletsPerBayLevel: 2,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "R3H",
    bayWidthMm: 1200,
    depthMm: 1000,
    heightMm: 10500,
    loadPerLevelKg: 800,
    palletsPerBayLevel: 1,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "R4",
    bayWidthMm: 2300,
    depthMm: 1000,
    heightMm: 10800,
    loadPerLevelKg: 1600,
    palletsPerBayLevel: 2,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "R4H",
    bayWidthMm: 1200,
    depthMm: 1000,
    heightMm: 10800,
    loadPerLevelKg: 800,
    palletsPerBayLevel: 1,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "4R4",
    bayWidthMm: 2300,
    depthMm: 1000,
    heightMm: 12000,
    loadPerLevelKg: 1600,
    palletsPerBayLevel: 2,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "4R4H",
    bayWidthMm: 1200,
    depthMm: 1000,
    heightMm: 12000,
    loadPerLevelKg: 800,
    palletsPerBayLevel: 1,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "R5",
    bayWidthMm: 2300,
    depthMm: 1000,
    heightMm: 9834,
    loadPerLevelKg: 1600,
    palletsPerBayLevel: 2,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "R6",
    bayWidthMm: 2300,
    depthMm: 1000,
    heightMm: 11339,
    loadPerLevelKg: 1600,
    palletsPerBayLevel: 2,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "6R6",
    bayWidthMm: 2300,
    depthMm: 1000,
    heightMm: 11339,
    loadPerLevelKg: 1600,
    palletsPerBayLevel: 2,
    drawingRef: DRAWING_JOB_2304,
  },
  {
    code: "J79-R1",
    bayWidthMm: 2300,
    depthMm: 1000,
    heightMm: 8900,
    loadPerLevelKg: 1600,
    palletsPerBayLevel: 2,
    drawingRef: DRAWING_JOB_2579,
  },
  {
    code: "J79-R2",
    bayWidthMm: 1200,
    depthMm: 1000,
    heightMm: 8900,
    loadPerLevelKg: 800,
    palletsPerBayLevel: 1,
    drawingRef: DRAWING_JOB_2579,
  },
];

export const WAREHOUSE_SPECS: WarehouseSpec[] = [
  {
    id: "wh_rtw2",
    code: "RTW2",
    name: "Raw Tea Warehouse-2",
    siteId: "site_2304",
    drawingRef: DRAWING_JOB_2304,
    sheet: "Sheet 3 of 6 - RAW TEA WAREHOUSE -2",
    materialGroups: ["RM"],
    materialGroupConfirmed: true,
    sourceNote:
      "Sheet titled 'RAW TEA WAREHOUSE -2'. Raw-material use is stated on the drawing.",
    declaredPositions: 1325,
    declaredBays: 127,
    footprint: { width: 100, depth: 94.67, unit: "ft" },
    aisles: 6,
    groups: [
      {
        profileCode: "R1",
        bays: 30,
        beamLevels: 4,
        positionsPerLevel: 2,
        declaredPositions: 300,
      },
      {
        profileCode: "R1H",
        bays: 7,
        beamLevels: 4,
        positionsPerLevel: 1,
        declaredPositions: 35,
      },
      {
        profileCode: "R2",
        bays: 75,
        beamLevels: 5,
        positionsPerLevel: 2,
        declaredPositions: 900,
      },
      {
        profileCode: "R2H",
        bays: 15,
        beamLevels: 5,
        positionsPerLevel: 1,
        declaredPositions: 90,
      },
    ],
  },
  {
    id: "wh_fg",
    code: "FGW",
    name: "FG Warehouse",
    siteId: "site_2304",
    drawingRef: DRAWING_JOB_2304,
    sheet: "Sheet 4 of 6 - FG WAREHOUSE",
    materialGroups: ["FG"],
    materialGroupConfirmed: true,
    sourceNote:
      "Sheet titled 'FG WAREHOUSE'. Finished-goods use is stated on the drawing.",
    declaredPositions: 825,
    declaredBays: 58,
    footprint: { width: 100, depth: 50.17, unit: "ft" },
    aisles: 4,
    groups: [
      {
        profileCode: "R3",
        bays: 26,
        beamLevels: 6,
        positionsPerLevel: 2,
        declaredPositions: 364,
      },
      {
        profileCode: "R3H",
        bays: 3,
        beamLevels: 6,
        positionsPerLevel: 1,
        declaredPositions: 21,
      },
      {
        profileCode: "R4",
        bays: 9,
        beamLevels: 7,
        positionsPerLevel: 2,
        declaredPositions: 144,
      },
      {
        profileCode: "R4H",
        bays: 1,
        beamLevels: 7,
        positionsPerLevel: 1,
        declaredPositions: 8,
      },
      {
        profileCode: "4R4",
        bays: 17,
        beamLevels: 7,
        positionsPerLevel: 2,
        declaredPositions: 272,
      },
      {
        profileCode: "4R4H",
        bays: 2,
        beamLevels: 7,
        positionsPerLevel: 1,
        declaredPositions: 16,
      },
    ],
  },
  {
    id: "wh_r56",
    code: "R56",
    name: "R5 / R6 Area",
    siteId: "site_2304",
    drawingRef: DRAWING_JOB_2304,
    sheet: "Sheet 5 of 6 - R5 / R6 / 6R6 storage capacity table",
    materialGroups: ["PM"],
    materialGroupConfirmed: false,
    sourceNote:
      "UNCONFIRMED USE. Sheet 5 gives the R5/R6/6R6 capacity table but the extracted text carries no area title. Packing-material use is a provisional working assumption for the demonstration only and must be confirmed with Ispahani.",
    declaredPositions: 548,
    declaredBays: 41,
    footprint: { width: 59, depth: 119.42, unit: "ft" },
    aisles: 3,
    groups: [
      {
        profileCode: "R5",
        bays: 13,
        beamLevels: 5,
        positionsPerLevel: 2,
        declaredPositions: 156,
      },
      {
        profileCode: "R6",
        bays: 14,
        beamLevels: 6,
        positionsPerLevel: 2,
        declaredPositions: 196,
      },
      {
        profileCode: "6R6",
        bays: 14,
        beamLevels: 6,
        positionsPerLevel: 2,
        declaredPositions: 196,
      },
    ],
  },
  {
    id: "wh_j2579",
    code: "WH2",
    name: "Warehouse 203' x 79'-8\"",
    siteId: "site_2579",
    drawingRef: DRAWING_JOB_2579,
    sheet: "Sheets 1-2 of 3 - WARE HOUSE 203' x 79'-8\"",
    materialGroups: ["RM"],
    materialGroupConfirmed: false,
    sourceNote:
      "UNCONFIRMED USE AND IDENTITY. Separate MinMax job (2579) for a building drawn as 203' x 79'-8\". The supplied file is named 'WH-2...' but this is NOT assumed to be the same building as 'Raw Tea Warehouse-2' on Job 2304; the two are modelled as distinct warehouses until Ispahani confirms. Raw-material use is provisional.",
    declaredPositions: 1895,
    declaredBays: 219,
    footprint: { width: 203, depth: 79.67, unit: "ft" },
    aisles: 8,
    groups: [
      {
        profileCode: "J79-R1",
        bays: 160,
        beamLevels: 4,
        positionsPerLevel: 2,
        declaredPositions: 1600,
      },
      {
        profileCode: "J79-R2",
        bays: 59,
        beamLevels: 4,
        positionsPerLevel: 1,
        declaredPositions: 295,
      },
    ],
  },
];

/** Positions per bay under the decoded rule. */
export function positionsPerBay(group: ProfileGroupSpec): number {
  return (group.beamLevels + 1) * group.positionsPerLevel;
}

/** Storage levels per bay (ground + beam levels). */
export function levelsPerBay(group: ProfileGroupSpec): number {
  return group.beamLevels + 1;
}

/**
 * Re-verify the decoded rule against every number printed on the drawings.
 * Throwing here beats shipping a dashboard whose totals silently drift from
 * the client's own capacity tables.
 */
function verifySpecs(): void {
  for (const wh of WAREHOUSE_SPECS) {
    let positions = 0;
    let bays = 0;
    for (const group of wh.groups) {
      const computed = group.bays * positionsPerBay(group);
      if (computed !== group.declaredPositions) {
        throw new Error(
          `Layout mismatch in ${wh.code}/${group.profileCode}: computed ${computed} positions but the drawing declares ${group.declaredPositions}.`,
        );
      }
      positions += computed;
      bays += group.bays;
    }
    if (positions !== wh.declaredPositions) {
      throw new Error(
        `Layout mismatch in ${wh.code}: computed ${positions} positions but the drawing declares ${wh.declaredPositions}.`,
      );
    }
    if (bays !== wh.declaredBays) {
      throw new Error(
        `Layout mismatch in ${wh.code}: computed ${bays} bays but the drawing declares ${wh.declaredBays}.`,
      );
    }
  }
}

verifySpecs();

export const TOTAL_DECLARED_POSITIONS = WAREHOUSE_SPECS.reduce(
  (sum, wh) => sum + wh.declaredPositions,
  0,
);

export const TOTAL_DECLARED_BAYS = WAREHOUSE_SPECS.reduce(
  (sum, wh) => sum + wh.declaredBays,
  0,
);
