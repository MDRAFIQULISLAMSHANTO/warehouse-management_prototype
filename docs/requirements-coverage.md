# Requirements Coverage Matrix

Every retained requirement from `SRS_Ispahani_Warehouse_Pallet_Management.pdf`,
mapped to the screen that demonstrates it. Also available live in the application
at `/about/requirements`.

**Status key**

| Status | Meaning |
|---|---|
| Implemented | Working in the prototype against live demonstration state |
| Partially demonstrated | Shown, but with a stated limitation |
| Documented only | Recorded and reasoned about, not built |
| Out of scope | Explicitly excluded by the client's instruction |

---

## 3.1 Warehouse Infrastructure Management

| Ref | Requirement | Status | Where |
|---|---|---|---|
| REQ-WHS-001 | Hierarchy Warehouse → Aisle → Rack → Column → Row → Cell → Pallet | Implemented | Inventory by Location, Cells, cell/rack forms |
| REQ-WHS-002 | Real-time balances at every hierarchy level | Implemented | Inventory by Location; 3D warehouse |
| REQ-WHS-003 | Locate any item by warehouse, aisle, rack, column, row, cell, pallet, product, lot | Implemented | Search and filters on every list |
| REQ-WHS-004 | Full movement history between locations | Implemented | Inventory Movement History |

Stored as the agreed **shallow model**: locations nest to cell level and carry
indexed aisle, rack, bay and level coordinates. The interface exposes the full
seven-level hierarchy. Column/bay is horizontal, row/level is vertical, level 0
is the ground position, and a cell is one pallet position.

## 3.2 Inbound Operations

| Ref | Requirement | Status | Where |
|---|---|---|---|
| REQ-INB-001 | Assign inventory to pallets on receipt | Implemented | Receipts → put-away |
| REQ-INB-002 | Recommend locations from capacity, occupancy, compatibility, proximity | Implemented | Empty Cells; Relocate pallet dialog |
| REQ-INB-003 | Identify empty pallets, partial pallets, nearby free cells | Implemented | Partially Filled Pallets; Empty Pallet Report |
| REQ-INB-004 | Prioritise partially occupied pallets before new allocations | Partially demonstrated | Partially Filled Pallets |
| REQ-INB-005 | Location validation scanning not mandatory | Implemented | Every flow |

REQ-INB-002: every suggestion states **why** it qualifies — storage-category
compatibility, position weight rating, same warehouse/aisle/rack, ground
position. The ranking is a documented proximity and accessibility heuristic, not
a measured forklift route; a route model would need the aisle graph and truck
data, which are not part of this prototype.

REQ-INB-004: consolidation candidates are surfaced and explained and can be
opened. Automatically enforcing them during receipt is a configuration decision
for the implementation, so the prototype shows the opportunity rather than
forcing it.

## 3.3 Outbound Operations

| Ref | Requirement | Status | Where |
|---|---|---|---|
| REQ-OUT-001 | Suggest picking by FIFO, LIFO or blend | Implemented | FIFO/LIFO Picking Reports; Check Availability |
| REQ-OUT-002 | Display exact pallet location before picking | Implemented | Operation lines, pallet form, cell preview |
| REQ-OUT-003 | Remove full or partial pallet quantities | Implemented | Pick from this pallet → Validate |
| REQ-OUT-004 | Pallet balances update after every transaction | Implemented | Validate |

Check Availability follows the product's configured removal strategy (FIFO,
LIFO, closest location, least packages).

## 3.4 Pallet Management

| Ref | Requirement | Status | Where |
|---|---|---|---|
| REQ-PAL-001 | Full pallet tracking, unique identification | Implemented | Pallets |
| REQ-PAL-002 | Support partially occupied pallets | Implemented | Partially Filled Pallets |
| REQ-PAL-003 | Current occupancy status for every pallet | Implemented | Pallet, cell and map views |
| REQ-PAL-004 | Classify pallets full / partially occupied / empty | Implemented | Pallets |
| REQ-PAL-005 | Suggest nearby partial pallets before new storage | Implemented | Consolidation tab |
| REQ-PAL-006 | Pallet transfers between locations with integrity | Implemented | Relocate pallet |

REQ-PAL-006 is verified: relocating a full pallet leaves total stock and the
overall occupied-position count unchanged, changes the location and the
individual rack summaries, and does not reset the original receipt date.

## 3.5 Blend Operations

| Ref | Requirement | Status | Where |
|---|---|---|---|
| REQ-BLD-001 | Blend-based inventory selection for raw materials | Implemented | Blend Operation Report |
| REQ-BLD-002 | Authorised users select lots and pallet quantities against approved blend requirements | Implemented | Pick → record as manual lot selection |
| REQ-BLD-003 | Generate and print Blend Operation Sheets | **Out of scope** | — |
| REQ-BLD-004 | Blend Operation Sheet contents | **Out of scope** | — |

Retained as a warehouse **picking** capability only. No recipes, manufacturing,
production orders or blend-sheet printing are introduced.

## 3.6 Inventory Accuracy

| Ref | Requirement | Status | Where |
|---|---|---|---|
| REQ-INV-001 | Every movement updates stock balances | Implemented | Validate |
| REQ-INV-002 | Accuracy at product, lot, pallet, cell, rack, warehouse level | Implemented | All dashboards; `/about/integrity` |
| REQ-INV-003 | Real-time visibility for RM, FG, PM | Implemented | Stock Visibility |

REQ-INV-003 carries a caveat: the material group of two of the four modelled
areas is still unconfirmed. See [drawing-assumptions.md](drawing-assumptions.md).

## 3.7 Dashboards

All seven are implemented and separately addressable.

| Dashboard | Route |
|---|---|
| Stock Visibility | `/dashboards/stock-visibility` |
| Warehouse Occupancy | `/dashboards/warehouse-occupancy` |
| Empty Cell | `/dashboards/empty-cells` |
| Partially Filled Pallet | `/dashboards/partial-pallets` |
| Inventory by Location | `/dashboards/inventory-by-location` |
| Inventory by Product | `/dashboards/inventory-by-product` |
| Inventory by Lot | `/dashboards/inventory-by-lot` |

## 3.7 Reports

| Report | Status | Route |
|---|---|---|
| Stock on Hand by Location | Implemented | `/reporting/stock-on-hand-by-location` |
| Inventory by Pallet | Implemented | `/reporting/inventory-by-pallet` |
| Inventory Movement History | Implemented | `/reporting/inventory-movement-history` |
| Empty Pallet Report | Implemented | `/reporting/empty-pallets` |
| Partially Filled Pallet Report | Implemented | `/reporting/partially-filled-pallets` |
| Warehouse Occupancy Report | Implemented | `/reporting/warehouse-occupancy` |
| FIFO Picking Report | Implemented | `/reporting/fifo-picking` |
| LIFO Picking Report | Implemented | `/reporting/lifo-picking` |
| Blend Operation Report | Partially demonstrated | `/reporting/blend-operation` |
| Stock Aging Report | Implemented | `/reporting/stock-aging` |

The Blend Operation Report lists manual lot-selection picks. Blend sheet
generation and printing remain out of scope.

Reports are not a separate mechanism: each is the shared list view opened on a
model with a documented base scope, default grouping and columns. They therefore
inherit search, filters, grouping, pivot and CSV export, and reconcile with the
dashboards by construction.

## 4. Non-functional requirements

| Ref | Requirement | Status | Note |
|---|---|---|---|
| NFR-001 | Inventory accuracy ≥ 99.9% | Documented only | A frontend prototype cannot evidence operational accuracy. What it shows is a dataset whose levels reconcile exactly and runtime assertions that would catch a discrepancy. Actual accuracy is measured during UAT. |
| NFR-002 | Locate any item within 5 seconds | Partially demonstrated | The journeys are short enough to demonstrate; a timing claim needs the real system on real hardware. |
| NFR-003 | Support future barcode scanning without redesign | Documented only | Every position and pallet carries a unique, scannable identifier; no screen depends on scanning. |
| NFR-004 | Support future RFID integration without redesign | Documented only | RFID is excluded from this phase; the identifier model does not preclude it. |
| NFR-005 | Real-time visibility across all warehouses | Implemented | Stock Visibility |

## 5. Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Track by warehouse, aisle, rack, column, row, cell, pallet | Implemented |
| 2 | FIFO, LIFO and blend strategies function | Implemented (blend = manual selection) |
| 3 | Partial pallet management operational | Implemented |
| 4 | Empty pallet identification operational | Implemented |
| 5 | Nearby cell recommendation operational | Implemented, ranking basis stated |
| 6 | Nearby partially occupied pallet recommendation operational | Implemented |
| 7 | Blend Operation Sheet generated and printed | **Out of scope** |
| 8 | Movements automatically update balances | Implemented |
| 9 | Occupancy dashboards and reports available | Implemented |
| 10 | Location-level visibility for RM, FG, PM | Implemented; two areas' material group unconfirmed |
| 11 | No dependency on QAD, Manufacturing, Serialization, RFID or IoT | Implemented — none are present |
| 12 | 99.9% accuracy demonstrated during UAT | Documented only — belongs to UAT, not a prototype |

## Excluded by instruction

Blend Sheet Printing and Blend Operation Sheet generation · Manufacturing / MRP ·
Production Orders · Bill of Materials · Automatic Lot Reservation from
Manufacturing · packing-line automation · QAD ERP Integration · RFID Integration ·
Location Validation by RFID.

## Unresolved scope, documented not implemented

Standalone IoT device integration, serialisation, and master carton aggregation.
Unique pallet identification remains required and **is** implemented.

---

## Standard Odoo versus proposed extension

**Standard Odoo Inventory behaviour, reproduced here:** searching, filtering,
grouping, favourites, list and pivot views, transfer states, reservations, back
orders, packages, lots, removal strategies, storage categories, put-away rules.

**Proposed extensions — these are not available from stock Odoo configuration
and would be built as a custom module:** the interactive floor plans, the rack
elevations, the 3D warehouse view, position-level occupancy colouring, the
empty-cell categorisation (physically empty vs available vs reserved vs
blocked), and the consolidation suggestions.

Odoo does not ship a 3D warehouse view. Third-party modules on the Odoo Apps
Store provide something comparable, so the capability is buyable rather than
bespoke, but it is not standard configuration and should not be presented as
such.

This prototype is **not** evidence that every screen shown here exists in Odoo
today.
