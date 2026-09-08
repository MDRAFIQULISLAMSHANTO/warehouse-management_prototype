/**
 * Project documentation, rendered inside the application so it is available in
 * the room during a presentation rather than sitting in a separate file.
 *
 * These pages are deliberately blunt about what is real, what is assumed, and
 * what standard Odoo does versus what would be a proposed extension.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { runIntegrityChecks } from "@/data/integrity";
import { TOTAL_DECLARED_POSITIONS, WAREHOUSE } from "@/data/layout";
import { DEMO_NOW_ISO, DEMO_TIMEZONE, formatDateTime } from "@/data/clock";
import { ControlPanel } from "@/odoo/ControlPanel";
import { formatInt } from "@/odoo/format";
import { Badge } from "@/odoo/primitives";
import { useAppStore, useDerived } from "@/store/appStore";

function DocPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <ControlPanel title={title} breadcrumbs={[{ label: "About this prototype" }]} />
      <div className="p-4">
        <div className="o-sheet max-w-[1180px] mx-auto p-5 text-[var(--o-fs-sm)] leading-relaxed">
          <p className="mt-0 text-[var(--o-fs-base)] text-[var(--o-text-muted)]">{lead}</p>
          {children}
        </div>
      </div>
    </>
  );
}

function H({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[var(--o-fs-lg)] font-medium mt-6 mb-2 pb-1 border-b border-[var(--o-border-subtle)]">
      {children}
    </h3>
  );
}

type Status = "implemented" | "partial" | "documented" | "excluded";

const STATUS_TONE: Record<Status, "ok" | "warn" | "info" | "neutral"> = {
  implemented: "ok",
  partial: "warn",
  documented: "info",
  excluded: "neutral",
};

const STATUS_LABEL: Record<Status, string> = {
  implemented: "Implemented",
  partial: "Partially demonstrated",
  documented: "Documented only",
  excluded: "Out of scope",
};

function StatusChip({ status }: { status: Status }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

// ------------------------------------------------- requirements coverage

interface CoverageRow {
  id: string;
  requirement: string;
  status: Status;
  where: ReactNode;
  note?: string;
}

const COVERAGE: { section: string; rows: CoverageRow[] }[] = [
  {
    section: "3.1 Warehouse Infrastructure Management",
    rows: [
      {
        id: "REQ-WHS-001",
        requirement:
          "Support the hierarchy Warehouse → Aisle → Rack → Column → Row → Cell → Pallet",
        status: "implemented",
        where: (
          <>
            <Link to="/dashboards/inventory-by-location">Inventory by Location</Link>,{" "}
            <Link to="/locations/cells">Cells</Link>, cell and rack forms
          </>
        ),
        note: "Stored as the agreed shallow model: locations nest to cell level and carry indexed aisle, rack, bay and level coordinates. The interface exposes the full seven-level hierarchy.",
      },
      {
        id: "REQ-WHS-002",
        requirement: "Display real-time inventory balances at every hierarchy level",
        status: "implemented",
        where: <Link to="/dashboards/inventory-by-location">Inventory by Location</Link>,
      },
      {
        id: "REQ-WHS-003",
        requirement:
          "Locate any item by warehouse, aisle, rack, column, row, cell, pallet, product or lot",
        status: "implemented",
        where: (
          <>
            Search and filters on every list; <Link to="/locations/cells">Cells</Link>
          </>
        ),
        note: "Each of those fields is searchable, filterable and groupable through the shared query engine.",
      },
      {
        id: "REQ-WHS-004",
        requirement: "Maintain full movement history between locations",
        status: "implemented",
        where: <Link to="/reporting/inventory-movement-history">Movement History</Link>,
      },
    ],
  },
  {
    section: "3.2 Inbound Operations",
    rows: [
      {
        id: "REQ-INB-001",
        requirement: "Assign inventory to pallets on receipt",
        status: "implemented",
        where: <Link to="/operations?preset=receipts">Receipts</Link>,
        note: "Receipt lines carry a destination pallet; the put-away that follows moves that pallet into a position.",
      },
      {
        id: "REQ-INB-002",
        requirement:
          "Recommend storage locations from capacity, occupancy, compatibility and proximity",
        status: "implemented",
        where: (
          <>
            <Link to="/dashboards/empty-cells">Empty Cells</Link>, pallet relocation
            dialog
          </>
        ),
        note: "Each suggestion lists why it qualifies. Ranking is a documented proximity and accessibility heuristic, not a measured forklift route.",
      },
      {
        id: "REQ-INB-003",
        requirement: "Identify empty pallets, partially occupied pallets and nearby free cells",
        status: "implemented",
        where: (
          <>
            <Link to="/dashboards/partial-pallets">Partially Filled Pallets</Link>,{" "}
            <Link to="/reporting/empty-pallets">Empty Pallet Report</Link>
          </>
        ),
      },
      {
        id: "REQ-INB-004",
        requirement: "Prioritise partially occupied pallets before new allocations",
        status: "partial",
        where: <Link to="/dashboards/partial-pallets">Partially Filled Pallets</Link>,
        note: "Consolidation candidates are surfaced and explained, and can be opened. Automatic enforcement during receipt is a configuration decision for the implementation, so it is shown rather than forced.",
      },
      {
        id: "REQ-INB-005",
        requirement: "Location validation scanning is not mandatory",
        status: "implemented",
        where: "Every flow in this prototype",
        note: "No screen requires a scan. The demonstration works with no barcode or RFID hardware.",
      },
    ],
  },
  {
    section: "3.3 Outbound Operations",
    rows: [
      {
        id: "REQ-OUT-001",
        requirement: "Suggest inventory for picking by FIFO, LIFO or blend",
        status: "implemented",
        where: (
          <>
            <Link to="/reporting/fifo-picking">FIFO</Link> and{" "}
            <Link to="/reporting/lifo-picking">LIFO Picking Reports</Link>; Check
            Availability on any operation
          </>
        ),
        note: "Check Availability follows the product's configured removal strategy. Manual lot selection is available for blend picking.",
      },
      {
        id: "REQ-OUT-002",
        requirement: "Display the exact pallet location before picking",
        status: "implemented",
        where: "Operation lines, pallet form, cell preview",
      },
      {
        id: "REQ-OUT-003",
        requirement: "Remove full or partial pallet quantities",
        status: "implemented",
        where: "Pick from this pallet, then Validate with a reduced quantity",
      },
      {
        id: "REQ-OUT-004",
        requirement: "Pallet balances update automatically after every transaction",
        status: "implemented",
        where: "Validate on any operation",
      },
    ],
  },
  {
    section: "3.4 Pallet Management",
    rows: [
      {
        id: "REQ-PAL-001",
        requirement: "Full pallet tracking with unique identification",
        status: "implemented",
        where: <Link to="/pallets">Pallets</Link>,
      },
      {
        id: "REQ-PAL-002",
        requirement: "Support partially occupied pallets",
        status: "implemented",
        where: <Link to="/dashboards/partial-pallets">Partially Filled Pallets</Link>,
      },
      {
        id: "REQ-PAL-003",
        requirement: "Maintain current occupancy status for every pallet",
        status: "implemented",
        where: "Pallet status on every pallet, cell and map",
      },
      {
        id: "REQ-PAL-004",
        requirement: "Classify pallets as full, partially occupied or empty",
        status: "implemented",
        where: <Link to="/pallets">Pallets</Link>,
        note: "Classification uses the explicit product or variant pallet capacity, never the structural rating of the position.",
      },
      {
        id: "REQ-PAL-005",
        requirement: "Suggest nearby partially occupied pallets before new storage",
        status: "implemented",
        where: "Consolidation tab on the pallet form",
      },
      {
        id: "REQ-PAL-006",
        requirement: "Support pallet transfers between locations with integrity",
        status: "implemented",
        where: "Relocate pallet on the pallet form",
        note: "Relocation preserves total stock, the occupied-position count and the original receipt date.",
      },
    ],
  },
  {
    section: "3.5 Blend Operations",
    rows: [
      {
        id: "REQ-BLD-001",
        requirement: "Support blend-based inventory selection for raw materials",
        status: "implemented",
        where: <Link to="/reporting/blend-operation">Blend Operation Report</Link>,
        note: "Retained as a warehouse picking capability only. No recipes, production orders or manufacturing are introduced.",
      },
      {
        id: "REQ-BLD-002",
        requirement:
          "Authorised users select lots and pallet quantities against approved blend requirements",
        status: "implemented",
        where: "Pick from this pallet → record as manual lot selection",
      },
      {
        id: "REQ-BLD-003",
        requirement: "Generate and print Blend Operation Sheets",
        status: "excluded",
        where: "-",
        note: "Explicitly removed from scope for this prototype.",
      },
      {
        id: "REQ-BLD-004",
        requirement: "Blend Operation Sheet contents",
        status: "excluded",
        where: "-",
        note: "Follows from REQ-BLD-003 being out of scope.",
      },
    ],
  },
  {
    section: "3.6 Inventory Accuracy",
    rows: [
      {
        id: "REQ-INV-001",
        requirement: "Every movement updates stock balances",
        status: "implemented",
        where: "Validate on any operation",
      },
      {
        id: "REQ-INV-002",
        requirement:
          "Accuracy at product, lot, pallet, cell, rack and warehouse level",
        status: "implemented",
        where: (
          <>
            All dashboards; <Link to="/about/integrity">Data Integrity Checks</Link>
          </>
        ),
        note: "Reconciliation between levels is asserted at runtime, not assumed.",
      },
      {
        id: "REQ-INV-003",
        requirement: "Real-time stock visibility for RM, FG and PM",
        status: "implemented",
        where: <Link to="/dashboards/stock-visibility">Stock Visibility</Link>,
        note: "Material group for two of the four modelled areas is still unconfirmed - see Source Drawing Assumptions.",
      },
    ],
  },
  {
    section: "3.7 Dashboards",
    rows: [
      {
        id: "DASH-1",
        requirement: "Stock Visibility Dashboard",
        status: "implemented",
        where: <Link to="/dashboards/stock-visibility">Open</Link>,
      },
      {
        id: "DASH-2",
        requirement: "Warehouse Occupancy Dashboard",
        status: "implemented",
        where: <Link to="/dashboards/warehouse-occupancy">Open</Link>,
      },
      {
        id: "DASH-3",
        requirement: "Empty Cell Dashboard",
        status: "implemented",
        where: <Link to="/dashboards/empty-cells">Open</Link>,
      },
      {
        id: "DASH-4",
        requirement: "Partially Filled Pallet Dashboard",
        status: "implemented",
        where: <Link to="/dashboards/partial-pallets">Open</Link>,
      },
      {
        id: "DASH-5",
        requirement: "Inventory by Location Dashboard",
        status: "implemented",
        where: <Link to="/dashboards/inventory-by-location">Open</Link>,
      },
      {
        id: "DASH-6",
        requirement: "Inventory by Product Dashboard",
        status: "implemented",
        where: <Link to="/dashboards/inventory-by-product">Open</Link>,
      },
      {
        id: "DASH-7",
        requirement: "Inventory by Lot Dashboard",
        status: "implemented",
        where: <Link to="/dashboards/inventory-by-lot">Open</Link>,
      },
    ],
  },
  {
    section: "3.7 Reports",
    rows: [
      { id: "RPT-1", requirement: "Stock on Hand by Location", status: "implemented", where: <Link to="/reporting/stock-on-hand-by-location">Open</Link> },
      { id: "RPT-2", requirement: "Inventory by Pallet", status: "implemented", where: <Link to="/reporting/inventory-by-pallet">Open</Link> },
      { id: "RPT-3", requirement: "Inventory Movement History", status: "implemented", where: <Link to="/reporting/inventory-movement-history">Open</Link> },
      { id: "RPT-4", requirement: "Empty Pallet Report", status: "implemented", where: <Link to="/reporting/empty-pallets">Open</Link> },
      { id: "RPT-5", requirement: "Partially Filled Pallet Report", status: "implemented", where: <Link to="/reporting/partially-filled-pallets">Open</Link> },
      { id: "RPT-6", requirement: "Warehouse Occupancy Report", status: "implemented", where: <Link to="/reporting/warehouse-occupancy">Open</Link> },
      { id: "RPT-7", requirement: "FIFO Picking Report", status: "implemented", where: <Link to="/reporting/fifo-picking">Open</Link> },
      { id: "RPT-8", requirement: "LIFO Picking Report", status: "implemented", where: <Link to="/reporting/lifo-picking">Open</Link> },
      {
        id: "RPT-9",
        requirement: "Blend Operation Report",
        status: "partial",
        where: <Link to="/reporting/blend-operation">Open</Link>,
        note: "Lists manual lot-selection picks. Blend sheet generation and printing remain out of scope.",
      },
      { id: "RPT-10", requirement: "Stock Aging Report", status: "implemented", where: <Link to="/reporting/stock-aging">Open</Link> },
    ],
  },
  {
    section: "4. Non-functional requirements",
    rows: [
      {
        id: "NFR-001",
        requirement: "Inventory accuracy of at least 99.9%",
        status: "documented",
        where: <Link to="/about/integrity">Data Integrity Checks</Link>,
        note: "A frontend prototype cannot evidence operational accuracy. What it does show is a dataset whose levels reconcile exactly, and runtime assertions that would catch a discrepancy. Actual accuracy is measured during UAT.",
      },
      {
        id: "NFR-002",
        requirement: "Identify the exact physical location of any item within 5 seconds",
        status: "partial",
        where: "Search, maps and drill-downs",
        note: "The journeys are short enough to demonstrate, but a timing claim needs the real system on real hardware.",
      },
      {
        id: "NFR-003",
        requirement: "Support future barcode scanning without redesign",
        status: "documented",
        where: "Location and pallet identifiers",
        note: "Every position and pallet already carries a unique, scannable identifier. No screen depends on scanning.",
      },
      {
        id: "NFR-004",
        requirement: "Support future RFID integration without redesign",
        status: "documented",
        where: "-",
        note: "RFID integration and RFID location validation are excluded from this phase. The identifier model does not preclude it.",
      },
      {
        id: "NFR-005",
        requirement: "Real-time inventory visibility across all warehouses",
        status: "implemented",
        where: <Link to="/dashboards/stock-visibility">Stock Visibility</Link>,
      },
    ],
  },
  {
    section: "Excluded by instruction",
    rows: [
      { id: "EX-1", requirement: "Blend Sheet Printing / Blend Operation Sheet generation", status: "excluded", where: "-" },
      { id: "EX-2", requirement: "Manufacturing / MRP, Production Orders, Bill of Materials", status: "excluded", where: "-" },
      { id: "EX-3", requirement: "Automatic Lot Reservation from Manufacturing", status: "excluded", where: "-" },
      { id: "EX-4", requirement: "Packing-line automation", status: "excluded", where: "-" },
      { id: "EX-5", requirement: "QAD ERP Integration", status: "excluded", where: "-" },
      { id: "EX-6", requirement: "RFID Integration and Location Validation by RFID", status: "excluded", where: "-" },
      {
        id: "EX-7",
        requirement: "IoT device integration, serialisation, master carton aggregation",
        status: "documented",
        where: "-",
        note: "Unresolved scope items. Documented, not implemented, and not integrated. Unique pallet identification is required and is implemented.",
      },
    ],
  },
];

export function RequirementsCoveragePage() {
  const counts = COVERAGE.flatMap((s) => s.rows).reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<Status, number>,
  );

  return (
    <DocPage
      title="Requirements Coverage"
      lead="Every retained requirement from the SRS, mapped to the screen that demonstrates it. Confirmed requirements are distinguished from demonstration assumptions, and excluded scope is listed rather than quietly dropped."
    >
      <div className="flex gap-2 flex-wrap mb-4">
        {(Object.keys(STATUS_LABEL) as Status[]).map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <StatusChip status={status} />
            <span className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
              {counts[status] ?? 0}
            </span>
          </span>
        ))}
      </div>

      {COVERAGE.map((section) => (
        <div key={section.section}>
          <H>{section.section}</H>
          <table className="o-list">
            <thead>
              <tr>
                <th style={{ width: 110 }}>Reference</th>
                <th>Requirement</th>
                <th style={{ width: 170 }}>Status</th>
                <th style={{ width: 230 }}>Where it is demonstrated</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.id}</td>
                  <td>
                    {row.requirement}
                    {row.note && (
                      <div className="text-[var(--o-fs-xs)] text-[var(--o-text-muted)] mt-0.5">
                        {row.note}
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusChip status={row.status} />
                  </td>
                  <td>{row.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <H>Standard Odoo versus proposed extension</H>
      <p>
        Searching, filtering, grouping, favourites, list and pivot views, transfer
        states, reservations, back orders, packages, lots, removal strategies,
        storage categories and put-away rules are all standard Odoo Inventory
        behaviour, reproduced here.
      </p>
      <p className="mb-0">
        The interactive floor plans, the rack elevations, the{" "}
        <strong>3D warehouse view</strong>, the position-level occupancy
        colouring, the empty-cell categorisation and the consolidation suggestions
        are <strong>proposed extensions</strong>. They are not available from stock
        Odoo configuration and would be built as a custom module - third-party 3D
        warehouse modules do exist on the Odoo Apps Store, so that capability is
        buyable rather than bespoke, but it is not standard configuration. This
        prototype is not evidence that every screen shown here exists in Odoo
        today.
      </p>
    </DocPage>
  );
}

// -------------------------------------------------------------- assumptions

export function AssumptionsPage() {
  return (
    <DocPage
      title="Source Drawing Assumptions"
      lead="What the MinMax drawings actually say, how their capacity tables were decoded, and every place where this prototype had to assume something."
    >
      <H>Documents used</H>
      <ul className="list-disc pl-5">
        <li>
          <strong>the supplied Warehouse Pallet Management SRS</strong> - 6 pages,
          the requirement source.
        </li>
        <li>
          <strong>Job 2304 241225-Revise 10-Up3.pdf</strong> - MinMax Rack Industry
          Job 2304-24122024, Revise 10 dated 29.09.25. Six sheets covering the site
          plan, Raw Tea Warehouse-2, the FG warehouse, an R5/R6/6R6 area and
          baseplate details.
        </li>
        <li>
          <strong>WH-2Job 2579-180825-Revise 2-OP 2.pdf</strong> - MinMax Job
          2579-180825, Revise 2 dated 10.02.26, for a building drawn as 203' x
          79'-8".
        </li>
      </ul>

      <H>How the capacity tables were decoded</H>
      <p>
        Each drawing prints a STORAGE CAPACITY table with columns for start rack,
        extension rack, rack quantity, total level, pallets per rack and total
        pallets. Reading pallets-per-rack against total-level gives one rule that
        reconciles every row of all four tables without exception:
      </p>
      <p className="font-medium bg-[var(--o-gray-100)] border border-[var(--o-border)] rounded-[var(--o-radius)] px-3 py-2">
        pallets per bay = (total level + 1) × positions per level
      </p>
      <p>
        In other words the table's level count is the number of <em>beam</em>{" "}
        levels, and the ground position is additional. Positions per level is two
        on the 2300 mm profiles and one on the 1200 mm "H" profiles, which matches
        the elevation details on those sheets. Worked check on Job 2579 R1: 160
        bays × (4+1) levels × 2 = 1,600 pallets, and 160 × 4 × 1,600 kg = 1,024 t.
        The drawing prints exactly 1,600 and a 1,213 t total against 1,895 pallets.
      </p>
      <p>
        The application asserts this at startup. If a decoded total ever stopped
        matching a printed total, the app would refuse to load rather than show a
        number that disagrees with the client's own drawing.
      </p>

      <H>Provisional capacities used</H>
      <table className="o-list">
        <thead>
          <tr>
            <th>Area</th>
            <th style={{ textAlign: "right" }}>Bays</th>
            <th style={{ textAlign: "right" }}>Pallet positions</th>
            <th>Material group</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {WAREHOUSE.sections.map((section) => {
            const bays = section.groups.reduce((sum, g) => sum + g.bays, 0);
            const positions = section.groups.reduce(
              (sum, g) => sum + g.declaredPositions,
              0,
            );
            return (
              <tr key={section.id}>
                <td className="font-medium">{section.name}</td>
                <td className="num">{formatInt(bays)}</td>
                <td className="num">{formatInt(positions)}</td>
                <td>
                  <Badge tone="ok">{section.materialGroups.join(", ")}</Badge>
                </td>
                <td className="text-[var(--o-fs-xs)]">
                  Split of {WAREHOUSE.sheet} - proportion assumed
                </td>
              </tr>
            );
          })}
          <tr>
            <td className="font-medium">Conditional combined total</td>
            <td className="num" />
            <td className="num font-medium">{formatInt(TOTAL_DECLARED_POSITIONS)}</td>
            <td colSpan={2} className="text-[var(--o-fs-xs)]">
              Only valid if the four areas are genuinely distinct - see below.
            </td>
          </tr>
        </tbody>
      </table>

      <H>Open questions requiring client confirmation</H>
      <ol className="list-decimal pl-5">
        <li className="mb-2">
          <strong>Is "WH-2" (Job 2579) the same building as "Raw Tea Warehouse-2" (Job 2304)?</strong>{" "}
          The supplied filename begins "WH-2" and the Job 2304 sheet is titled "RAW
          TEA WAREHOUSE -2", but they are different jobs with different rack
          schedules and different building dimensions. This prototype models them as
          two separate warehouses and does <em>not</em> assume they are the same
          building. If they are the same, the combined total of{" "}
          {formatInt(TOTAL_DECLARED_POSITIONS)} positions double-counts and must be
          reduced.
        </li>
        <li className="mb-2">
          <strong>What is stored in the R5 / R6 / 6R6 area?</strong> Sheet 5 of Job
          2304 carries the capacity table but the extracted text has no area title.
          Packing material is a working assumption for demonstration only.
        </li>
        <li className="mb-2">
          <strong>What is stored in the Job 2579 building?</strong> Raw material is
          provisional.
        </li>
        <li className="mb-2">
          <strong>Aisle naming and rack numbering.</strong> The drawings show rack
          lines, but the extracted text carries no aisle labelling. Aisle names and
          rack run identifiers here are a documented schematic.
        </li>
        <li>
          <strong>Receipt and delivery routing.</strong> A two-step inbound
          (receipt into an input area, then put-away) and two-step outbound (pick to
          output, then delivery) are used. Whether the client wants one-step or
          two-step routing is a configuration decision awaiting confirmation.
        </li>
      </ol>

      <H>Geometry</H>
      <p>
        PDF page rendering was not available in the environment used to build this
        prototype, so no drawing geometry could be traced. Floor plans are{" "}
        <strong>schematic</strong>: rack runs are laid out to the drawn building
        proportions and the declared bay counts, not to surveyed coordinates. Rack
        elevations are exact in structure - bays, levels and positions per level all
        come from the drawings - but not in millimetre placement.
      </p>

      <H>Demonstration data</H>
      <p className="mb-0">
        Products, variants, lots, garden marks, suppliers, customers, operators,
        quantities and movements are generated for the demonstration. They are
        plausible for a tea business but they are <strong>not</strong> real
        master data or stock, and must never be presented as such. In the real
        project this master data and the opening balances arrive in Odoo from the
        client, loaded by the partner handling product setup (SRS 1.2).
      </p>
    </DocPage>
  );
}

// ------------------------------------------------------------ odoo mapping

export function OdooMappingPage() {
  return (
    <DocPage
      title="Odoo Flow Mapping"
      lead="How each retained warehouse activity maps onto Odoo Inventory concepts, and which parts are assumptions awaiting confirmation."
    >
      <H>Terminology</H>
      <table className="o-list">
        <thead>
          <tr>
            <th>This prototype</th>
            <th>Odoo Inventory</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Cell (pallet position)", "stock.location (internal)", "One position per location, capacity one pallet."],
            ["Pallet", "stock.quant.package", "Unique licence plate; keeps its identity when emptied."],
            ["Stock line", "stock.quant", "Product, variant, lot, package and location with quantity and reserved quantity."],
            ["Operation", "stock.picking", "Receipt, put-away, internal transfer, pick, delivery."],
            ["Operation line", "stock.move", "Product-level demand."],
            ["Detailed operation", "stock.move.line", "Lot, source and destination package and location."],
            ["Storage category", "stock.storage.category", "Max weight, allowed material groups, allow-new-product rule."],
            ["Removal strategy", "product removal strategy", "FIFO, LIFO, closest location, least packages."],
            ["Rack profile", "(none)", "Drawing concept, not an Odoo model. Modelled as a reference record."],
          ].map(([a, b, c]) => (
            <tr key={a}>
              <td className="font-medium">{a}</td>
              <td>{b}</td>
              <td className="text-[var(--o-fs-xs)]">{c}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H>Business activity to prototype flow</H>
      <table className="o-list">
        <thead>
          <tr>
            <th style={{ width: 180 }}>Business activity</th>
            <th>Prototype flow</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Receiving", "Receipt document → product, lot and quantity entry → pallet assignment → Validate into the receiving/input area."],
            ["Put-away", "Input → suggested compatible cell → internal transfer → Validate. Creating the transfer claims the destination so no other pending operation can take it."],
            ["Picking", "Demand → Check Availability → FIFO/LIFO or permitted manual lot selection → quantities reserved → record picked quantity."],
            ["Dispatch", "Pick from the cell to output/staging, then delivery validation to the customer location."],
            ["Internal relocation", "Source cell/pallet → destination cell → Validate."],
            ["Partial picking", "Record the actual quantity → Validate → choose a back order or cancel the remaining demand."],
            ["Empty pallet handling", "When contents reach zero the pallet keeps its identity and stays in its position until it is removed or relocated explicitly."],
          ].map(([a, b]) => (
            <tr key={a}>
              <td className="font-medium">{a}</td>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H>State rules enforced</H>
      <ul className="list-disc pl-5">
        <li>Draft and suggested operations do not change physical stock.</li>
        <li>Reservations reduce available quantity; they never reduce on-hand quantity.</li>
        <li>Validation changes stock and location balances.</li>
        <li>Cancelling an uncompleted operation releases its reservations.</li>
        <li>Partial validation offers an explicit choice for the remaining demand.</li>
        <li>Cancelling the remaining demand does not remove undelivered stock.</li>
        <li>Completed operations keep their movement history permanently.</li>
        <li>
          Repeated clicks and page refreshes cannot apply an operation twice: state
          is the seed plus an ordered action log, and validating an operation that
          is already Done is a no-op.
        </li>
        <li>Dependent operations wait for their upstream operation.</li>
      </ul>

      <H>Assumptions awaiting confirmation</H>
      <p className="mb-0">
        Two-step inbound and two-step outbound routing is used throughout. Purchase,
        Sales, Accounting and Manufacturing are outside this prototype's scope, so
        operations start from warehouse documents with a reference to a notional
        source document rather than from a real purchase or sales order.
      </p>
    </DocPage>
  );
}

// -------------------------------------------------------- filter mapping

export function FilterApplicabilityPage() {
  return (
    <DocPage
      title="Filter and Widget Applicability"
      lead="Which global filters affect which parts of a dashboard, and - just as important - which ones deliberately do not."
    >
      <H>The rules</H>
      <table className="o-list">
        <thead>
          <tr>
            <th style={{ width: 210 }}>Filter group</th>
            <th>Stock figures</th>
            <th>Installed capacity</th>
            <th>Pallet figures</th>
            <th>Movement charts</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["Warehouse, aisle, rack, bay, level, material group", "Applies", "Applies", "Applies", "Applies"],
            ["Product, variant, category, lot, pallet", "Applies", "Highlights only", "Applies", "Applies"],
            ["Occupancy status (occupied, empty, blocked, reserved)", "-", "Applies", "-", "-"],
            ["Pallet status (full, partial, empty)", "-", "Applies to the positions holding them", "Applies", "-"],
            ["Quantity, availability, fill percentage, stock age", "Applies", "Highlights only", "Applies", "-"],
            ["Movement date period, operation type, status, operator", "-", "-", "-", "Applies"],
          ].map((row) => (
            <tr key={row[0]}>
              <td className="font-medium">{row[0]}</td>
              <td>{row[1]}</td>
              <td>{row[2]}</td>
              <td>{row[3]}</td>
              <td>{row[4]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H>Why capacity is treated differently</H>
      <p>
        Installed capacity is a physical fact about the building. Filtering a
        dashboard to one product must not make the warehouse appear to have fewer
        positions than it has, so product-type filters never enter the occupancy
        denominator. They highlight matching positions on the maps instead, and the
        dashboard says so on screen whenever a filter is being applied that way.
      </p>

      <H>Why movement periods do not touch stock balances</H>
      <p>
        A date filter such as "Last 30 Days" is about activity, not about what is on
        hand. Applying it to current balances would silently hide older inventory
        that is still physically in the racks. Movement charts honour the period;
        stock figures always show today's position.
      </p>

      <H>Units of measure</H>
      <p>
        Quantities are only summed within one unit. A scope mixing kilograms and
        cartons reports each unit separately rather than producing a meaningless
        total. Percentages are never summed: occupancy and fill are recomputed from
        their own numerator and denominator at every level.
      </p>

      <H>Filter logic</H>
      <p className="mb-0">
        Predefined filters follow Odoo's grouping: alternatives inside one group
        combine with OR, and separate groups combine with AND. Selecting Full
        Pallets and Partially Filled Pallets together with a warehouse produces{" "}
        <code>(Full OR Partial) AND Warehouse = selected</code>. Custom filters add
        Match All / Match Any with nested branches, and are evaluated as structured
        data - never as code entered by a user.
      </p>
    </DocPage>
  );
}

// -------------------------------------------------------------- integrity

export function IntegrityPage() {
  const data = useAppStore((s) => s.data);
  const derived = useDerived();
  const checks = runIntegrityChecks(data, derived);
  const failing = checks.filter((c) => !c.ok);

  return (
    <DocPage
      title="Data Integrity Checks"
      lead="These assertions run against live state, not just the seed, so they also catch a bad outcome from an operation demonstrated during the session. If a row here is red, do not trust the numbers on screen."
    >
      <div className="mb-3">
        {failing.length === 0 ? (
          <Badge tone="ok">All {checks.length} checks passing</Badge>
        ) : (
          <Badge tone="bad">
            {failing.length} of {checks.length} checks failing
          </Badge>
        )}
      </div>

      <table className="o-list">
        <thead>
          <tr>
            <th style={{ width: 90 }}>Result</th>
            <th>Check</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <td>
                <Badge tone={check.ok ? "ok" : "bad"}>{check.ok ? "Pass" : "Fail"}</Badge>
              </td>
              <td className="font-medium">{check.label}</td>
              <td className="text-[var(--o-fs-xs)]">{check.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H>Dataset size</H>
      <table className="o-list">
        <tbody>
          {[
            ["Installed pallet positions", derived.cells.length],
            ["Racks", derived.racks.length],
            ["Pallets", derived.pallets.length],
            ["Stock lines", derived.stock.length],
            ["Products", derived.products.length],
            ["Lots", derived.lots.length],
            ["Operations", derived.operations.length],
            ["Movement lines", derived.movements.length],
          ].map(([label, value]) => (
            <tr key={String(label)}>
              <td>{label}</td>
              <td className="num font-medium">{formatInt(Number(value))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H>Demonstration clock</H>
      <p className="mb-0">
        All dates derive from a fixed instant: {formatDateTime(DEMO_NOW_ISO)} in{" "}
        {DEMO_TIMEZONE}. That keeps aging buckets, period filters and movement
        charts identical on every machine and in every screenshot.
      </p>
    </DocPage>
  );
}
