# Walkthroughs

Scripted routes for a client session, plus the end-to-end journeys used to verify
the prototype. Also available in the application at `/about/walkthroughs`, and as
a step-through **Guided demo** panel in the bottom-left corner of every screen.

The warehouse is **one building** with **two sections** — Raw Material and Packed
Tea / FG — holding **1,895 installed pallet positions**. Stock flows
**Raw → production → Finished Goods**.

---

## Management walkthrough (~10 minutes)

Capacity and control first, detail second.

1. **Open with the building** — `/dashboards/warehouse-occupancy`
   1,895 installed positions taken straight from the MinMax capacity table, how
   many hold a pallet, and how many are *genuinely available* for put-away
   rather than merely empty. The comparison chart splits it into the two
   sections.

2. **Make the distinction that matters** — `/dashboards/empty-cells`
   Physically empty, available for put-away, reserved for incoming stock, and
   empty but blocked. The gap between the first and the second is the number an
   operator can actually use today.

3. **Show where capacity is being lost** — `/dashboards/partial-pallets`
   Part loads quantified, with conservative consolidation candidates. Every fill
   percentage states its basis: the product's own pallet capacity, not the
   800 kg structural rating of the position.

4. **Show the building in three dimensions** — `/dashboards/warehouse-occupancy?view=3d`
   Every installed position drawn and coloured by what is in it. Use the legend
   to filter, then click a position to glide the camera in and read its
   capacity, remaining space and contents.

5. **Follow the material through the building** — `/operations?preset=prod_issue`
   Operations is grouped the way the warehouse runs: Inbound receives and puts
   away into the Raw section, Production issues raw material out and receives
   finished goods back into the FG section, Outbound picks and dispatches.

6. **Move to stock value and availability** — `/dashboards/stock-visibility`
   On hand, reserved and available to pick, each quantity inside its own unit of
   measure. Reservations reduce what can be picked without touching on-hand
   quantity.

7. **Prove the numbers connect**
   Click any figure or chart segment. A card that counts distinct pallets opens
   exactly that many pallet records, with the condition carried across as a
   visible facet that can be removed.

8. **Close on traceability and honesty** — `/dashboards/inventory-by-lot`, then
   `/about/assumptions`
   Walk one lot from receipt to its current pallets and positions. Then show
   what came from the drawing and what is provisional — starting with how the
   219 bays split between the two sections.

---

## Operations walkthrough (~10 minutes)

Daily work, in the order an operator meets it.

1. **Start at the outstanding work** — `/operations?preset=todo`
2. **Complete a put-away** — `/operations?preset=putaway`
3. **Bring a waiting pick to Ready** — `/operations?preset=waiting`
   Demand is set but nothing is reserved and the line has no lot or pallet.
   Check Availability reserves stock and fills them in; only then does Validate
   appear.
4. **Pick part of a pallet** — `/pallets?preset=partial`
5. **Relocate a pallet** — `/pallets`
6. **Find anything by any handle** — `/stock`
7. **Show the audit trail** — `/reporting/inventory-movement-history`

---

## End-to-end journeys

### J1 — Stock Visibility → product → lot → pallet → locate on the map

**Expected outcome:** the same lot and pallet identifiers appear at every step,
and the final screen shows the physical position in the rack.

### J2 — Warehouse Occupancy → section → rack elevation → cell → pallet

**Expected outcome:** occupancy percentages on the rack match the tiles drawn in
its elevation, and the pallet record matches the preview.

### J2b — 3D warehouse → filter → position → info card, and live recolouring

1. Switch to 3D and note the legend counts.
2. Filter by a legend row; filtered-out positions stay as faint shells.
3. Show all, then click a red position for its capacity card.
4. Pick part of that pallet, validate, and return.

**Expected outcome:** the position changes from red to green and the legend
counts move by one. The six legend counts always sum to 1,895.

### J3 — Empty Cell → compatible destination → internal transfer → updated occupancy

**Expected outcome:** total stock and the overall occupied-position count are
unchanged — a relocation moves a pallet, it does not create or destroy one. The
source and destination rack summaries both change.

### J4 — Full pallet → partial pick → updated quantity and fill

1. Open a full 800 kg pallet — `PAL-000024` in `RAW/A2/R004/B09-L0-P1` is one of
   97 that qualify.
2. Pick 200 kg, then validate.

**Expected outcome:** 600 kg remaining, fill 75% against the same 800 kg basis,
position still occupied, stock age unchanged.

### J4b — Waiting pick → Check Availability → Ready → Validate

**Expected outcome:** Check Availability reserves the demand and fills in the lot
and pallet, the state moves to Ready, and only then is Validate offered. A Ready
operation always has its demand reserved — the integrity page asserts it.

### J5 — Raw → production → finished goods

1. Open Issues to Production: each moves raw or packing material out of a Raw
   position to `Virtual/Production`.
2. Open Receipts from Production: each brings finished goods back into an FG
   position.
3. Search one batch reference to see both halves.

**Expected outcome:** the two halves share a source document, and stock is only
ever consumed from Raw and produced into FG.

*Verified:* `PRD/2026/4557` returns exactly two operations — the issue from
`RAW/A2/R004/B03-L0-P2` on 04 Sept and the receipt into `FG/A1/R016/B05-L0-P2`
on 05 Sept. All 41 production runs are paired, which the integrity page checks.

### J6 — Inventory by Location / Product / Lot → filter and group → supporting records

**Expected outcome:** group counts and subtotals reconcile with the dashboard,
and the CSV contains exactly the filtered scope.

### J7 — Save a favourite → navigate away → restore → open a record → return

**Expected outcome:** filters, grouping, sort order and page are all restored,
and returning from the record keeps them.

---

## Baseline figures

Seeded state, before any operation is validated in the session:

| Figure | Value |
|---|---:|
| Installed positions | 1,895 |
| Occupied | 1,266 |
| Physically empty | 599 |
| Blocked | 30 |
| Available for put-away | 582 |
| Reserved for incoming | 17 |
| Physical occupancy | 66.8% |
| Partial pallets | 300 |
| Production runs (issue + receipt) | 41 |

Use **Reset Demo** to return to these.

---

## Presenting honestly

- All stock, lots, pallets, operators and partners are illustrative demonstration
  data, **not real warehouse records**.
- Capacity comes from the MinMax drawing and reconciles with it exactly. The
  split of the 219 bays between the two sections is **assumed** and needs
  confirming. Floor-plan geometry is schematic.
- The maps, occupancy colouring and consolidation suggestions are **proposed
  extensions**, not stock Odoo configuration.
- Do not quote accuracy percentages, savings or ROI from this prototype.
- Use **Reset Demo** between sessions.
