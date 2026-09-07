# Source Drawing Assumptions

What the supplied drawings actually say, how their capacity tables were decoded,
and every place this prototype had to assume something.

Also available in the application at `/about/assumptions`.

## Documents used

| Document | What it provided |
|---|---|
| `SRS_Ispahani_Warehouse_Pallet_Management.pdf` (6 pp) | Requirements, hierarchy, scope, acceptance criteria |
| `Job 2304 241225-Revise 10-Up3.pdf` (6 pp) | MinMax Job 2304-24122024, Revise 10 dated 29.09.25. Site plan, Raw Tea Warehouse-2, FG warehouse, an R5/R6/6R6 area, baseplate details |
| `WH-2Job 2579-180825-Revise 2-OP 2.pdf` (3 pp) | MinMax Job 2579-180825, Revise 2 dated 10.02.26. A building drawn as 203' × 79'-8" |

Text was extracted with `pypdf`. Page **rendering** was unavailable in the build
environment, so no drawing geometry could be traced.

## How the capacity tables were decoded

Each drawing prints a STORAGE CAPACITY table:

```
RACK NAME | START RACK | EXT. RACK | RACK QTY | TOTAL LEVEL | PALLET PER RACK | TOTAL PALLET
```

A "rack" in those tables is one **bay**: a start bay carries two frames, each
extension bay adds one and shares the previous one.

Reading PALLET PER RACK against TOTAL LEVEL gives a single rule that reconciles
**every row of all four tables** without exception:

> **pallets per bay = (TOTAL LEVEL + 1) × positions per level**

The table's level count is therefore the number of *beam* levels, and the ground
position is additional. Positions per level is **2** on the 2300 mm profiles and
**1** on the 1200 mm "H" profiles, matching the elevation details on those sheets.

### Worked check — Job 2579, profile R1

- 160 bays × (4 + 1) levels × 2 positions = **1,600 pallets** — the drawing prints 1,600.
- 160 bays × 4 beam levels × 1,600 kg per level = 1,024,000 kg = **1,024 t**.
- With R2's 189 t that totals **1,213 t** against **1,895 pallets** — exactly the
  figures printed on the sheet.

`src/data/layout.ts` re-asserts this at startup. If a decoded total ever stopped
matching a printed total the application would refuse to load rather than show a
number that disagrees with the client's own drawing.

## Provisional capacities used

| Area | Bays | Pallet positions | Material group | Source sheet |
|---|---:|---:|---|---|
| Raw Tea Warehouse-2 | 127 | 1,325 | RM — **confirmed** | Sheet 3 of 6, titled "RAW TEA WAREHOUSE -2" |
| FG Warehouse | 58 | 825 | FG — **confirmed** | Sheet 4 of 6, titled "FG WAREHOUSE" |
| R5 / R6 Area | 41 | 548 | PM — **unconfirmed** | Sheet 5 of 6, capacity table only, no area title |
| Warehouse 203' × 79'-8" | 219 | 1,895 | RM — **unconfirmed** | Job 2579, sheets 1–2 of 3 |
| **Conditional combined total** | **445** | **4,593** | | Only valid if the four areas are genuinely distinct |

### Per-profile breakdown

**Raw Tea Warehouse-2** (Job 2304): R1 30 bays × 5 levels × 2 = 300 · R1H 7 × 5 × 1 = 35 ·
R2 75 × 6 × 2 = 900 · R2H 15 × 6 × 1 = 90. Total 127 bays, 1,325 positions.

**FG Warehouse** (Job 2304): R3 26 × 7 × 2 = 364 · R3H 3 × 7 × 1 = 21 ·
R4 9 × 8 × 2 = 144 · R4H 1 × 8 × 1 = 8 · 4R4 17 × 8 × 2 = 272 · 4R4H 2 × 8 × 1 = 16.
Total 58 bays, 825 positions.

**R5 / R6 Area** (Job 2304): R5 13 × 6 × 2 = 156 · R6 14 × 7 × 2 = 196 ·
6R6 14 × 7 × 2 = 196. Total 41 bays, 548 positions.

**Job 2579 building**: R1 160 × 5 × 2 = 1,600 · R2 59 × 5 × 1 = 295.
Total 219 bays, 1,895 positions.

Every pallet position on these drawings is rated **800 kg**. The pallet is
1200 × 1000 mm.

## Open questions requiring Ispahani confirmation

1. **Is "WH-2" (Job 2579) the same building as "Raw Tea Warehouse-2" (Job 2304)?**
   The supplied filename begins "WH-2" and the Job 2304 sheet is titled "RAW TEA
   WAREHOUSE -2", but they are different jobs with different rack schedules and
   different building dimensions. They are modelled here as two separate
   warehouses and are **not** assumed to be the same building. If they are the
   same, the combined 4,593-position total double-counts and must be reduced.
2. **What is stored in the R5 / R6 / 6R6 area?** Sheet 5 carries the capacity
   table but the extracted text has no area title. Packing material is a working
   assumption for demonstration only.
3. **What is stored in the Job 2579 building?** Raw material is provisional.
4. **Aisle naming and rack numbering.** The drawings show rack lines, but the
   extracted text carries no aisle labelling. Aisle names and rack run
   identifiers here are a documented schematic. Rack profiles (R1, R2, 4R4, 6R6
   and the rest) **are** from the drawings and are modelled as profiles, not as
   rack names; every physical rack has a unique identifier of its own.
5. **Receipt and delivery routing.** Two-step inbound (receipt into an input
   area, then put-away) and two-step outbound (pick to output, then delivery) are
   assumed throughout.

## Geometry

Floor plans are **schematic**. Rack runs are laid out to the drawn building
proportions and the declared bay counts, not to surveyed coordinates. A rack run
is drawn proportionally to its bay count, and aisles are laid out as bands with
racking on both sides, which is how a VNA layout works — but plan positions are
approximate.

Rack **elevations** are exact in structure: bays, levels and positions per level
all come from the drawings. They are not exact in millimetre placement.

The **3D warehouse** view is built from the same schematic rack runs, so it
carries exactly the same caveat: the number of positions, bays and levels is
faithful to the drawings, the arrangement of the runs on the floor is not
surveyed. Level heights in the 3D view are uniform and illustrative; the
drawings give real beam heights per profile, which would be applied in the
implementation.

Input, output, staging and quality-hold areas are modelled separately per
warehouse and are deliberately **excluded** from installed-position totals.

## Demonstration data

Products, variants, lots, garden marks, suppliers, customers, operators,
quantities and movements are generated for the demonstration. They are plausible
for a tea business but they are **not** Ispahani master data or stock, and must
never be presented as such.

In the real project this master data and the opening balances arrive in Odoo from
the client, loaded by the partner handling product setup and opening inventory
(SRS section 1.2).

Pallet capacities are set **per product** on purpose — 800 kg, 780 kg, 720 kg,
60 cartons, 24 rolls and so on — because fill percentage must use an explicit
product capacity, never the structural rating of the rack position.
