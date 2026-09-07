# Source Drawing Assumptions

What the supplied drawings say, how the capacity table was decoded, and every
place this prototype had to assume something.

Also available in the application at `/about/assumptions`.

## Structure, as confirmed by Ispahani

There is **one warehouse**, divided into **two sections**:

| Section | Holds | Role in the flow |
|---|---|---|
| Raw Material Section | Raw tea (RM) and packing material (PM) | Receives from suppliers, issues to production |
| Packed Tea / FG Section | Finished goods (FG) | Receives from production, dispatches to customers |

Material flows **Raw → production → Finished Goods**, and finished goods are the
last stage before dispatch. Production itself is out of scope: there are no
manufacturing orders and no bills of material. The warehouse sees only the two
ends of it — an issue out of the Raw section to a virtual production location,
and a receipt back from it into the FG section. That is exactly how Odoo models
production from the warehouse side.

## Documents used

| Document | What it provided |
|---|---|
| `SRS_Ispahani_Warehouse_Pallet_Management.pdf` (6 pp) | Requirements, hierarchy, scope, acceptance criteria |
| `WH-2Job 2579-180825-Revise 2-OP 2.pdf` (3 pp) | **The warehouse modelled here.** MinMax Job 2579-180825, Revise 2 dated 10.02.26, for the building drawn as 203' × 79'-8" |
| `Job 2304 241225-Revise 10-Up3.pdf` (6 pp) | MinMax Job 2304-24122024, Revise 10 dated 29.09.25. **Superseded** — see below |

Text was extracted with `pypdf`. Page **rendering** was unavailable in the build
environment, so no drawing geometry could be traced.

### Why Job 2304 is not modelled

Job 2304 carries three separate storage-capacity tables — a Raw Tea Warehouse-2
at 1,325 positions, an FG Warehouse at 825, and an untitled R5/R6 area at 548.
Job 2579 is the **later** drawing (10.02.26 against 29.09.25) and describes the
building that is actually being fitted out. Ispahani confirmed that Job 2579 is
the warehouse, so the Job 2304 tables describe a superseded scheme and are not
part of the model. Nothing from them contributes to any figure in this
prototype.

## How the capacity table was decoded

The Job 2579 STORAGE CAPACITY table lists, per rack profile:

```
RACK NAME | RACK SIZE | START RACK | EXT. RACK | RACK QTY | TOTAL LEVEL |
LOAD/LEVEL | PALLET/RACK | STORAGE CAPACITY (Ton) | TOTAL PALLET
```

A "rack" in that table is one **bay**: a start bay carries two frames, each
extension bay adds one and shares the previous one.

Reading PALLET/RACK against TOTAL LEVEL gives a rule that reconciles every row:

> **pallets per bay = (TOTAL LEVEL + 1) × positions per level**

The table's level count is therefore the number of *beam* levels, and the ground
position is additional. Positions per level is **2** on the 2300 mm profile (R1)
and **1** on the 1200 mm profile (R2).

### Worked check — profile R1

- 160 bays × (4 + 1) levels × 2 positions = **1,600 pallets** — the drawing prints 1,600.
- 160 bays × 4 beam levels × 1,600 kg per level = 1,024,000 kg = **1,024 t**.
- With R2's 189 t that totals **1,213 t** against **1,895 pallets** — exactly the
  figures printed on the sheet.

## Capacity

| Profile | Bay size | Bays | Levels | Positions/level | Positions |
|---|---|---:|---:|---:|---:|
| R1 | 2300 × 1000 × 8900 mm | 160 | 5 | 2 | 1,600 |
| R2 | 1200 × 1000 × 8900 mm | 59 | 5 | 1 | 295 |
| **Total** | | **219** | | | **1,895** |

Split between the two sections:

| Section | R1 bays | R2 bays | Bays | Positions |
|---|---:|---:|---:|---:|
| Raw Material | 100 | 34 | 134 | 1,170 |
| Packed Tea / FG | 60 | 25 | 85 | 725 |
| **Total** | **160** | **59** | **219** | **1,895** |

Every pallet position is rated **800 kg**. The pallet is 1200 × 1000 mm.

`src/data/layout.ts` re-asserts all of this at startup — per section, for the
building, and against the drawing's own per-profile rows (160 R1 bays, 59 R2
bays). If a decoded total ever stopped matching a printed total the application
would refuse to load rather than show a number that disagrees with the client's
own capacity table.

## Open questions requiring Ispahani confirmation

1. **How are the 219 bays actually split between the two sections?** The drawing
   gives one capacity table for the whole building and does not say which racking
   is raw and which is finished goods. The split used here — 134 bays / 1,170
   positions raw, 85 bays / 725 positions finished — preserves the drawing's own
   per-profile totals exactly and divides them in the 61.6 : 38.4 proportion the
   earlier Job 2304 scheme used. **This is the single most important number to
   confirm**, because it sets the capacity of each section.
2. **Should packing material have its own section?** PM currently shares the Raw
   section, because it is also an input to production. If Ispahani keeps it
   separately, it needs a third section or a sub-zone.
3. **Aisle naming and rack numbering.** The drawing shows rack lines but the
   extracted text carries no aisle labelling. Aisle codes (`RAW-A1`, `FG-A1` …)
   and rack run identifiers are a documented schematic. Rack profiles R1 and R2
   **are** from the drawing.
4. **Receipt and delivery routing.** Two-step inbound (receipt into an input
   area, then put-away) and two-step outbound (pick to output, then delivery) are
   assumed throughout.

## Geometry

The floor plan is **schematic**. The two sections occupy contiguous bands of one
plan canvas laid out to the drawn building proportions (203' × 79'-8"), with rack
runs sized in proportion to their bay counts. Plan positions are not surveyed
coordinates.

Rack **elevations** are exact in structure: bays, levels and positions per level
all come from the drawing. They are not exact in millimetre placement.

The **3D warehouse** carries the same caveat: the number of positions, bays and
levels is faithful to the drawing, the arrangement of the runs on the floor is
not. Level heights in 3D are uniform and illustrative; the drawing gives real
beam heights, which would be applied in the implementation.

Input, output, staging, quality-hold and the virtual production location are
modelled separately and are deliberately **excluded** from installed-position
totals.

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
