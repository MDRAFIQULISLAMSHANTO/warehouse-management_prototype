/**
 * Warehouse layout specification derived from the MinMax Rack Industry
 * drawings supplied by the client.
 *
 *   Job 2579-180825, Revise 2 dated 10.02.26  ("WH-2Job 2579-180825-Revise 2-OP 2.pdf")
 *   Job 2304-24122024, Revise 10 dated 29.09.25  ("Job 2304 241225-Revise 10-Up3.pdf")
 *
 * STRUCTURE, AS CONFIRMED BY ISPAHANI
 * -----------------------------------
 * There is ONE warehouse: the building drawn as 203' x 79'-8" on Job 2579, the
 * later of the two jobs. It is divided into TWO sections:
 *
 *   Raw Material section   - incoming tea and packing material
 *   Packed Tea / FG section - finished goods, after production
 *
 * Material flows Raw -> production -> Finished Goods, and finished goods are
 * the last stage before dispatch. Production itself is out of scope (no
 * manufacturing orders, no bills of material); the warehouse sees it as an
 * issue out of the Raw section and a receipt into the FG section.
 *
 * The three storage-capacity tables on Job 2304 (Raw Tea Warehouse-2 at 1,325
 * positions, FG Warehouse at 825, and an R5/R6 area at 548) describe an earlier
 * scheme and are superseded by Job 2579. They are not modelled.
 *
 * HOW THE CAPACITY TABLE WAS READ
 * -------------------------------
 * The Job 2579 STORAGE CAPACITY table lists, per rack profile:
 *   RACK SIZE | START RACK | EXT. RACK | RACK QTY | TOTAL LEVEL | LOAD/LEVEL |
 *   PALLET/RACK | STORAGE CAPACITY (Ton) | TOTAL PALLET
 *
 * A "rack" in that table is one *bay*: a start bay carries two frames, each
 * extension bay adds one and shares the previous one. Reading PALLET/RACK
 * against TOTAL LEVEL gives a rule that reconciles every row:
 *
 *     pallets per bay = (TOTAL LEVEL + 1) x positions per level
 *
 * i.e. the table's level count is the number of *beam* levels and the ground
 * position is additional. Positions per level is 2 on the 2300 mm profile and
 * 1 on the 1200 mm profile.
 *
 * Worked check, profile R1: 160 bays x (4+1) levels x 2 = 1,600 pallets, and
 * 160 x 4 x 1,600 kg/level = 1,024,000 kg = 1,024 t. The drawing prints exactly
 * 1600 and, with R2's 189 t, a 1,213 t total against 1,895 pallets.
 *
 * WHAT IS ASSUMED, NOT DRAWN
 * --------------------------
 * - The split of the 219 bays between the two sections. The drawing gives one
 *   capacity table for the whole building and does not say which racking is
 *   raw and which is finished goods. The split used here keeps both profiles in
 *   both sections and follows the Raw:FG proportion of the earlier Job 2304
 *   scheme (1,325 : 825, or 61.6% : 38.4%). It must be confirmed.
 * - Grouping of bays into named rack runs, and aisle naming. The drawings show
 *   rack lines but the extracted text carries no aisle labelling.
 * - Floor-plan geometry. PDF page rendering was unavailable, so plan positions
 *   are schematic rectangles laid out to the drawn building proportions.
 */

import type { MaterialGroup, RackProfile } from "./types";

export const DRAWING_JOB_2579 = "MinMax Job 2579-180825, Revise 2 (10.02.26)";
export const DRAWING_JOB_2304 =
  "MinMax Job 2304-24122024, Revise 10 (29.09.25)";

/** Every pallet position on this drawing is rated 800 kg. */
export const PALLET_LOAD_KG = 800;

export interface ProfileGroupSpec {
  profileCode: string;
  /** RACK QTY from the drawing table = number of bays. */
  bays: number;
  /** TOTAL LEVEL from the table (beam levels; ground position is extra). */
  beamLevels: number;
  positionsPerLevel: number;
  /** Positions this group contributes, used as a runtime check. */
  declaredPositions: number;
}

export interface SectionSpec {
  id: string;
  code: string;
  name: string;
  /** Material groups stored in this section. */
  materialGroups: MaterialGroup[];
  materialGroupConfirmed: boolean;
  /** Where this section sits in the Raw -> production -> FG flow. */
  stage: "raw" | "finished";
  sourceNote: string;
  aisles: number;
  groups: ProfileGroupSpec[];
}

export interface WarehouseSpec {
  id: string;
  code: string;
  name: string;
  siteId: string;
  drawingRef: string;
  sheet: string;
  sourceNote: string;
  /** TOTAL PALLET printed on the drawing. */
  declaredPositions: number;
  /** TOTAL RACK printed on the drawing (bays). */
  declaredBays: number;
  footprint: { width: number; depth: number; unit: "ft" };
  sections: SectionSpec[];
}

/**
 * Rack profiles as drawn on Job 2579. R1 is the 2300 mm bay carrying two
 * pallet positions per level; R2 is the 1200 mm bay carrying one.
 */
export const RACK_PROFILES: RackProfile[] = [
  {
    code: "R1",
    bayWidthMm: 2300,
    depthMm: 1000,
    heightMm: 8900,
    loadPerLevelKg: 1600,
    palletsPerBayLevel: 2,
    drawingRef: DRAWING_JOB_2579,
  },
  {
    code: "R2",
    bayWidthMm: 1200,
    depthMm: 1000,
    heightMm: 8900,
    loadPerLevelKg: 800,
    palletsPerBayLevel: 1,
    drawingRef: DRAWING_JOB_2579,
  },
];

/**
 * The bay split between the two sections.
 *
 * ASSUMPTION. The drawing gives one table for the whole building. These numbers
 * preserve the drawing's own totals exactly - 160 R1 bays and 59 R2 bays,
 * 1,895 positions - and divide them in the 61.6 : 38.4 proportion the earlier
 * Job 2304 scheme used between raw and finished goods.
 */
export const WAREHOUSE: WarehouseSpec = {
  id: "wh_main",
  code: "WH",
  name: "Ispahani Tea Warehouse",
  siteId: "site_main",
  drawingRef: DRAWING_JOB_2579,
  sheet: 'Sheets 1-2 of 3 - WARE HOUSE 203\' x 79\'-8"',
  sourceNote:
    'One building, drawn as 203\' x 79\'-8" on MinMax Job 2579 (Revise 2, 10.02.26), divided into a Raw Material section and a Packed Tea / Finished Goods section. The three capacity tables on the earlier Job 2304 describe a superseded scheme and are not modelled.',
  declaredPositions: 1895,
  declaredBays: 219,
  footprint: { width: 203, depth: 79.67, unit: "ft" },
  sections: [
    {
      id: "sec_raw",
      code: "RAW",
      name: "Raw Material Section",
      materialGroups: ["RM", "PM"],
      materialGroupConfirmed: true,
      stage: "raw",
      sourceNote:
        "Incoming tea and packing material, held until it is issued to production. Packing material shares this section because it is also an input to production; confirm whether Ispahani wants it separated.",
      aisles: 5,
      groups: [
        {
          profileCode: "R1",
          bays: 100,
          beamLevels: 4,
          positionsPerLevel: 2,
          declaredPositions: 1000,
        },
        {
          profileCode: "R2",
          bays: 34,
          beamLevels: 4,
          positionsPerLevel: 1,
          declaredPositions: 170,
        },
      ],
    },
    {
      id: "sec_fg",
      code: "FG",
      name: "Packed Tea / FG Section",
      materialGroups: ["FG"],
      materialGroupConfirmed: true,
      stage: "finished",
      sourceNote:
        "Finished goods received from production and held until dispatch. This is the last stage before the customer.",
      aisles: 3,
      groups: [
        {
          profileCode: "R1",
          bays: 60,
          beamLevels: 4,
          positionsPerLevel: 2,
          declaredPositions: 600,
        },
        {
          profileCode: "R2",
          bays: 25,
          beamLevels: 4,
          positionsPerLevel: 1,
          declaredPositions: 125,
        },
      ],
    },
  ],
};

/** Positions per bay under the decoded rule. */
export function positionsPerBay(group: ProfileGroupSpec): number {
  return (group.beamLevels + 1) * group.positionsPerLevel;
}

/** Storage levels per bay (ground + beam levels). */
export function levelsPerBay(group: ProfileGroupSpec): number {
  return group.beamLevels + 1;
}

/**
 * Re-verify the decoded layout against the numbers printed on the drawing.
 *
 * Two things are checked: that each section's own arithmetic holds, and that
 * the sections together still reproduce the drawing's per-profile totals
 * (160 R1 bays, 59 R2 bays, 1,895 positions, 219 bays). Throwing here beats
 * shipping a dashboard whose totals silently drift from the client's own
 * capacity table.
 */
function verifySpec(): void {
  const perProfile = new Map<string, { bays: number; positions: number }>();
  let positions = 0;
  let bays = 0;

  for (const section of WAREHOUSE.sections) {
    for (const group of section.groups) {
      const computed = group.bays * positionsPerBay(group);
      if (computed !== group.declaredPositions) {
        throw new Error(
          `Layout mismatch in ${section.code}/${group.profileCode}: computed ${computed} positions but the spec declares ${group.declaredPositions}.`,
        );
      }
      positions += computed;
      bays += group.bays;
      const tally = perProfile.get(group.profileCode) ?? { bays: 0, positions: 0 };
      tally.bays += group.bays;
      tally.positions += computed;
      perProfile.set(group.profileCode, tally);
    }
  }

  if (positions !== WAREHOUSE.declaredPositions) {
    throw new Error(
      `Layout mismatch: sections total ${positions} positions but the drawing declares ${WAREHOUSE.declaredPositions}.`,
    );
  }
  if (bays !== WAREHOUSE.declaredBays) {
    throw new Error(
      `Layout mismatch: sections total ${bays} bays but the drawing declares ${WAREHOUSE.declaredBays}.`,
    );
  }

  // The drawing's own per-profile rows, which the split must not disturb.
  const drawn = { R1: { bays: 160, positions: 1600 }, R2: { bays: 59, positions: 295 } };
  for (const [code, expected] of Object.entries(drawn)) {
    const actual = perProfile.get(code);
    if (!actual || actual.bays !== expected.bays || actual.positions !== expected.positions) {
      throw new Error(
        `Layout mismatch for profile ${code}: sections give ${actual?.bays ?? 0} bays / ${actual?.positions ?? 0} positions, the drawing prints ${expected.bays} / ${expected.positions}.`,
      );
    }
  }
}

verifySpec();

export const TOTAL_DECLARED_POSITIONS = WAREHOUSE.declaredPositions;
export const TOTAL_DECLARED_BAYS = WAREHOUSE.declaredBays;

/** Convenience: every section, for callers that iterate them. */
export const SECTIONS = WAREHOUSE.sections;
