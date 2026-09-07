# Ispahani Warehouse Management — Presales Prototype

A fully interactive frontend prototype of a **Warehouse Location and Pallet
Management System**, presented by **Invento Software Limited** to **Ispahani Tea
Limited**. The proposed production platform is **Odoo 19 Enterprise**; this
prototype reproduces that interface and drives it with a deterministic dataset
built from Ispahani's own MinMax rack drawings.

> **This is a demonstration, not a system of record.** All stock, lots, pallets,
> operators, suppliers and customers are generated illustrative data. Warehouse
> capacities come from the supplied drawings and reconcile with them exactly;
> floor-plan geometry is schematic. See
> [docs/drawing-assumptions.md](docs/drawing-assumptions.md).

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Production build and local preview:

```bash
npm run build        # tsc -b && vite build  ->  dist/
npm run preview      # serves dist/ on http://localhost:4173
```

Type checking only:

```bash
npm run typecheck
```

Requires Node 20 or newer (developed on Node 24.14.1, npm 11.11.0).

There is **no backend, database, Odoo connection or ERP integration**. Nothing in
this project reads or writes a local Odoo or PostgreSQL installation.

---

## What is in the box

### Seven dashboards, each separately addressable

| Dashboard | Route |
|---|---|
| Stock Visibility | `/dashboards/stock-visibility` |
| Warehouse Occupancy | `/dashboards/warehouse-occupancy` |
| Empty Cells | `/dashboards/empty-cells` |
| Partially Filled Pallets | `/dashboards/partial-pallets` |
| Inventory by Location | `/dashboards/inventory-by-location` |
| Inventory by Product | `/dashboards/inventory-by-product` |
| Inventory by Lot | `/dashboards/inventory-by-lot` |

### Records, operations and reports

- Operations with a working Odoo transfer lifecycle: Draft → Waiting → Ready →
  Done, plus Cancelled, Check Availability, Validate, back orders.
- Pallets, cells, racks, warehouses, products, lots, stock lines and movements,
  each with an Odoo-style form: status bar, smart buttons, tabs, related records.
- All ten SRS reports, implemented as preconfigured filtered views so they
  inherit searching, grouping, pivoting and CSV export.
- Interactive SVG floor plans and rack elevations with position-level detail.
- An interactive **3D warehouse** (`?view=3d` on the occupancy dashboard, or
  Locations -> 3D Warehouse), modelled on Odoo's own stock 3D view: translucent
  colour-coded position volumes with wireframe edges, labels that appear as you
  zoom in, orbit/zoom/pan, and a click that glides the camera onto the position,
  washes out everything else and opens a card giving its capacity, remaining
  space and contents.

### Documentation, in the app and in this repo

| Topic | In the app | In this repo |
|---|---|---|
| Requirements coverage | `/about/requirements` | [docs/requirements-coverage.md](docs/requirements-coverage.md) |
| Source drawing assumptions | `/about/assumptions` | [docs/drawing-assumptions.md](docs/drawing-assumptions.md) |
| Odoo flow mapping | `/about/odoo-mapping` | [docs/odoo-flow-mapping.md](docs/odoo-flow-mapping.md) |
| Filter applicability | `/about/filters` | [docs/filter-applicability.md](docs/filter-applicability.md) |
| Walkthroughs | `/about/walkthroughs` | [docs/walkthroughs.md](docs/walkthroughs.md) |
| Data integrity checks | `/about/integrity` | — (runs live) |
| Deployment | — | [docs/deployment-vercel.md](docs/deployment-vercel.md) |

---

## Running a demonstration

1. Open **Warehouse Occupancy** — capacity and physical control first.
2. Use the **Guided demo** panel (bottom left) or
   [docs/walkthroughs.md](docs/walkthroughs.md) for a scripted route.
3. Click figures rather than describing them. Every KPI, chart segment, map cell
   and table reference opens the exact records behind it, with the filter carried
   across as a visible, removable facet.
4. Use **Reset Demo** in the navbar between sessions to restore the seeded state.

The demonstration works with no barcode or RFID hardware. Location validation
scanning is never required (SRS REQ-INB-005).

---

## Architecture

```
src/
  data/        deterministic dataset: types, drawing-derived layout, catalogue,
               seed generator, derived rows, integrity checks, demo clock
  query/       structured query engine: domain AST, operators, evaluator,
               grouping and aggregation, model/field registry, search state,
               URL codec, date periods
  store/       Zustand store, demo action log, operation reducer, suggestions
  odoo/        Odoo UI kit: control panel, search with facets, filters,
               group by, favourites, list, graph, pivot, form, charts, tokens
  map/         SVG floor plan, rack elevation, cell preview, 3D warehouse
  dashboards/  the seven dashboards plus the filter-applicability layer
  pages/       record lists, reports, detail forms, configuration, documentation
  app/         shell, navigation, routing, drill-down link builders, guided demo
```

Three design decisions carry most of the weight:

**One dataset.** `src/data/seed.ts` builds every record from a single seed with a
deterministic PRNG. Nothing anywhere calls `Math.random()`. `src/data/derive.ts`
flattens it into the rows every dashboard, list, chart, map and export reads, so
a KPI and the list behind it cannot disagree.

**One query engine.** Filters are data, never code:
`{field, operator, value}` conditions combined with AND/OR groups
(`src/query/domain.ts`). Nothing a user types is evaluated as JavaScript. The
search bar, Filters menu, Group By, custom filter builder, list columns, graph,
pivot and CSV export are all generated from one field registry
(`src/query/models.ts`), so a field behaves identically everywhere.

**The URL is the state.** Every list and dashboard round-trips its whole search
through the query string, so direct links, refreshes, the browser Back button and
"copy link to this view" all work, and drill-downs arrive as labelled facets.

### Demonstration state

State is the seed plus an ordered log of actions. Only that log, saved searches
and a couple of UI preferences are persisted to `localStorage`. This keeps
storage small, makes **Reset Demo** exact, and means a refresh replays to
precisely the same state — a validated operation can never post twice.

---

## Visual identity

The theme targets the **current Odoo backend**, not the plum-navbar generation of
Odoo 16-18: white chrome with dark navbar text, teal (`#017E84`) carrying
actions, selected navigation and section headings, and KPI figures on soft
pastel tiles. Purple (`#714B67`) is kept as the application identity mark.

Everything is a token in `src/styles/tokens.css`; no component hard-codes a hex
value, so the whole palette can be re-pointed from one file.

## The 3D warehouse

`src/map/Warehouse3D.tsx` renders every installed position of the selected
warehouse with react-three-fiber. Placement comes from the same schematic rack
runs the 2D plan uses - bay counts, level counts and positions per level all
from the MinMax drawings - so the two views always agree.

Colour is computed from live store state by `cellVisual()` in
`src/map/warehouse3dGeometry.ts`, using the same semantics as the dashboards: a
blocked position is never "occupied", a reserved-but-empty position is not
"available", and an empty pallet standing in a position reads as no load. When
an operation is validated the affected positions repaint immediately - picking
200 kg off a full pallet moves one box from red to green, and the legend counts
move with it.

Clicking a position glides the camera in on it, washes every other volume out to
pale grey, and opens a card with the location reference, **Total Capacity**,
**Available Space** and the products held - the same information Odoo's own view
shows. The card turns red when available space reaches zero or goes negative.
Capacity is the product's own full-pallet quantity, and the card says so, because
it is not the 800 kg structural rating of the position.

All positions share one `InstancedMesh` with a per-instance colour attribute, and
all their wireframe edges share one merged `LineSegments`: several thousand
individual meshes would stall the frame, two draw calls do not. The edges fade in
as the camera approaches, so the wide shot stays readable instead of turning into
a grey mesh. three.js is lazily loaded and code-split, so it never reaches a
viewer who does not open the 3D view.

One naming note: Odoo's legend calls the red band "Overload". A position sitting
at exactly 100% is not literally overloaded, and most full pallets here are
exactly full, so the band is named **Full / Overload** and defined as available
space ≤ 0 rather than overstating a problem that does not exist.

## Rules the prototype enforces

- Reservations reduce *available* quantity; they never reduce *on-hand* quantity.
- Draft and suggested operations do not change stock. Validation does.
- Cancelling an uncompleted operation releases its reservations.
- Partial validation offers a back order or cancelling the remainder; cancelling
  the remainder does not remove undelivered stock.
- Completed operations keep their movement history and cannot be cancelled.
- A pallet emptied by a pick keeps its identity and stays in its position.
- Stock in-dates survive relocation, so stock age never resets.
- One pallet per rack position; no two pending operations may claim the same
  destination; picking beyond available quantity is refused.
- Physical occupancy = occupied installed positions ÷ installed positions in
  scope. A partial pallet, and an empty pallet still standing in the rack, both
  occupy their position.
- Fill percentage uses the explicit product or variant pallet capacity, never the
  800 kg structural rating of the position.
- Quantities are summed only within one unit of measure. Percentages are never
  summed.

`/about/integrity` asserts these against **live** state, so a bad outcome from a
demonstrated operation would show up as a red row rather than a wrong number.

---

## Scope

### Retained

Warehouse infrastructure, pallets, products, variants, lots, receiving, put-away,
picking, internal transfers, FIFO/LIFO removal, partial pallets, empty pallets,
the seven dashboards and the applicable reporting. Manual blend-based lot and
pallet selection is retained as a **warehouse picking capability** — it
introduces no recipes, manufacturing, production orders or blend sheets.

### Excluded

Blend Sheet Printing and Blend Operation Sheet generation · Manufacturing / MRP ·
Production Orders · Bill of Materials · Automatic Lot Reservation from
Manufacturing · packing-line automation · QAD ERP Integration · RFID Integration
· Location Validation by RFID.

### Unresolved, documented but not implemented

Standalone IoT integration, serialisation, and master carton aggregation. Unique
pallet identification remains required and is implemented.

---

## Open questions for Ispahani

1. **Is "WH-2" (Job 2579) the same building as "Raw Tea Warehouse-2" (Job 2304)?**
   They are modelled as two distinct warehouses. If they are the same building,
   the combined 4,593-position total double-counts.
2. **What is stored in the R5 / R6 / 6R6 area?** Packing material is a working
   assumption only.
3. **What is stored in the Job 2579 building?** Raw material is provisional.
4. **Aisle naming and rack numbering** are a documented schematic.
5. **Receipt and delivery routing** — two-step inbound and outbound are assumed.

---

## Honest limits

- Sample stock is illustrative and must never be presented as Ispahani data.
- Floor plans are schematic, not traced from the drawing geometry.
- No accuracy percentage, saving or ROI can be claimed from this prototype.
- The interactive maps, occupancy colouring, empty-cell categorisation and
  consolidation suggestions are **proposed extensions**, not stock Odoo
  configuration. This prototype is not evidence that every screen shown is
  available through standard Odoo setup.

---

## Deployment

See [docs/deployment-vercel.md](docs/deployment-vercel.md). `vercel.json` already
carries the SPA rewrite, so deep links and refreshes on detail pages work in
production.
