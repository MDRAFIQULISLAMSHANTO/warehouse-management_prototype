# Walkthroughs

Scripted routes for a client session, plus the end-to-end journeys used to verify
the prototype. Also available in the application at `/about/walkthroughs`, and as
a step-through **Guided demo** panel in the bottom-left corner of every screen.

---

## Management walkthrough (~10 minutes)

Capacity and control first, detail second.

1. **Open with the whole estate** — `/dashboards/warehouse-occupancy`
   All four modelled areas at once: 4,593 installed positions taken straight from
   the MinMax capacity tables, how many hold a pallet, and how many are *genuinely
   available* for put-away rather than merely empty.

2. **Make the distinction that matters** — `/dashboards/empty-cells`
   Physically empty, available for put-away, reserved for incoming stock, and
   empty but blocked. The gap between the first and the second is the number an
   operator can actually use today.

3. **Show where capacity is being lost** — `/dashboards/partial-pallets`
   Part loads quantified, with conservative consolidation candidates. Every fill
   percentage states its basis: the product's own pallet capacity, not the rack's
   800 kg rating.

4. **Show the building in three dimensions** — `/dashboards/warehouse-occupancy?view=3d`
   Every installed position drawn and coloured by what is in it. Orbit it, hover
   a position to read it, and click one to glide the camera in and open its
   capacity, remaining space and contents.

5. **Move to stock value and availability** — `/dashboards/stock-visibility`
   On hand, reserved and available to pick, each quantity inside its own unit of
   measure. Reservations reduce what can be picked without touching on-hand
   quantity.

6. **Prove the numbers connect**
   Click any figure. A card that counts distinct pallets opens exactly that many
   pallet records, with the filter carried across as a visible facet that can be
   removed.

7. **Close on traceability and honesty** — `/dashboards/inventory-by-lot`, then
   `/about/assumptions`
   Walk one lot from receipt to its current pallets and positions. Then show what
   came from the drawings, what is provisional, and what still needs Ispahani's
   confirmation.

---

## Operations walkthrough (~10 minutes)

Daily work, in the order an operator meets it.

1. **Start at the outstanding work** — `/operations?preset=todo`
   Draft receipts, put-aways waiting to be done, picks that are Ready because
   stock is reserved for them.

2. **Complete a put-away** — `/operations?preset=putaway`
   Open a Ready put-away. Its destination was suggested because it is empty,
   unblocked, compatible and not already claimed. Validate it and watch the
   position change state on the map.

3. **Pick part of a pallet** — `/pallets?preset=partial`
   Open a pallet, use *Pick from this pallet*, then Validate with a reduced
   quantity. The system offers a back order or lets you cancel the remaining
   demand — and cancelling does not make undelivered stock disappear.

4. **Relocate a pallet** — `/pallets`
   *Relocate pallet* lists compatible destinations and states why each one
   qualifies. Creating the transfer claims that position so a second operation
   cannot be routed to it.

5. **Find anything by any handle** — `/stock`
   Search a lot reference, a pallet licence plate, a rack code or a product name.
   Add Filters and Group By, save the result as a favourite, then reopen it later.

6. **Show the audit trail** — `/reporting/inventory-movement-history`
   Every validated movement, with source and destination position and the pallet
   involved. Validated operations cannot be cancelled — they keep their history.

---

## End-to-end journeys

### J1 — Stock Visibility → product → lot → pallet → locate on the map

1. Open Stock Visibility and select a product bar in *Product quantity analysis*.
2. Open the product record and pick a lot from its Lots tab.
3. From the lot, open one of its pallets.
4. From the pallet, open its position, then view it inside the rack elevation.

**Expected outcome:** the same lot and pallet identifiers appear at every step,
and the final screen shows the physical position in the rack.

### J2 — Warehouse Occupancy → warehouse → rack elevation → cell → pallet

1. Open Warehouse Occupancy and choose a warehouse.
2. Select a rack on the floor plan to load its elevation.
3. Select an occupied position to open the preview.
4. Use *Open Pallet* from the preview.

**Expected outcome:** occupancy percentages on the rack match the tiles drawn in
its elevation, and the pallet record matches the preview.

### J2b — 3D warehouse → position → info card, and live recolouring

1. Switch the occupancy panel to **3D** and note the legend counts.
2. Hover a position to read its address and contents.
3. Click it: the camera glides in, every other volume washes out, and a card
   gives the location reference, total capacity, available space and contents.
4. Open a full pallet elsewhere, pick part of it and validate, then return.

**Expected outcome:** the picked position changes from red to green and the
legend counts move by one, because the 3D view reads the same live state as the
dashboards.

*Verified:* Full/Overload 709 → 708 and Free Space Available 200 → 201 after a
200 kg pick, with the total still 1,325.

### J3 — Empty Cell → compatible destination → internal transfer → updated occupancy

1. Open Empty Cells and select a product in the suggestion panel.
2. Note why each suggested position qualifies.
3. Open a pallet and use *Relocate pallet*, choosing a suggested destination.
4. Validate the transfer, then return to the occupancy dashboard.

**Expected outcome:** total stock and the overall occupied-position count are
unchanged. The source and destination rack summaries both change.

*Verified:* occupied stayed at 2,823 of 4,593 (61.5%), available for put-away
stayed at 1,636, and the pallet moved from `RTW2/A2/R004/B08-L0-P2` to
`RTW2/A2/R004/B05-L1-P1`.

### J4 — Partially Filled Pallet → partial pick → updated quantity and fill

1. Open a pallet holding 800 kg.
2. Use *Pick from this pallet* for 200 kg.
3. Validate the pick.

**Expected outcome:** the pallet holds 600 kg, its fill percentage drops against
the same capacity basis, and the cell stays occupied.

*Verified:* 800 kg → 600 kg, status Full → Partially filled, fill 100% → 75%
against the same 800 kg basis, remaining capacity 200 kg, position unchanged,
and stock age unchanged at 59 days.

### J5 — Inventory by Location / Product / Lot → filter and group → supporting records

1. Open Inventory by Location and drill from site to warehouse to aisle to rack.
2. Open the stock lines for that scope.
3. Group by product, then by lot, and check the subtotals.
4. Export the filtered scope to CSV.

**Expected outcome:** group counts and subtotals reconcile with the dashboard,
and the CSV contains exactly the filtered scope.

*Verified:* a 180-record filtered scope produced 14 groups summing to exactly
180, unchanged footer totals, and a CSV with exactly 180 data rows.

### J6 — Save a favourite → navigate away → restore → open a record → return with context

1. Filter a list, add a Group By, then Favorites → *Save current search*.
2. Navigate to another screen, then reopen the favourite.
3. Open a record from the restored list and use the browser Back button.

**Expected outcome:** filters, grouping, sort order and page are all restored, and
returning from the record keeps them.

---

## Presenting honestly

- All stock, lots, pallets, operators and partners are illustrative demonstration
  data, **not Ispahani records**.
- Warehouse capacities come from the MinMax drawings and reconcile with them
  exactly. Floor-plan geometry is schematic.
- The maps, occupancy colouring and consolidation suggestions are **proposed
  extensions**, not stock Odoo configuration.
- Do not quote accuracy percentages, savings or ROI from this prototype. It has
  no basis for any of them.
- Use **Reset Demo** between sessions to restore the seeded state.
