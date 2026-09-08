/**
 * Presentation walkthroughs.
 *
 * Two scripted routes through the prototype - one for management, one for
 * warehouse operations - plus the six end-to-end journeys the brief calls for.
 * Every step is a real link, so the presenter can run the session from here.
 */

import { Link } from "react-router-dom";
import { ControlPanel } from "@/odoo/ControlPanel";
import { Badge } from "@/odoo/primitives";

interface Step {
  title: string;
  detail: string;
  to?: string;
  linkLabel?: string;
}

const MANAGEMENT: Step[] = [
  {
    title: "Open with the building",
    detail:
      "Warehouse Occupancy shows the whole warehouse: 1,895 installed pallet positions taken straight from the MinMax capacity table, how many hold a pallet, and how many are genuinely available for put-away rather than merely empty. The comparison chart splits it into the two sections - Raw Material and Packed Tea / FG.",
    to: "/dashboards/warehouse-occupancy",
    linkLabel: "Warehouse Occupancy",
  },
  {
    title: "Make the distinction that matters",
    detail:
      "Empty Cells separates physically empty, available for put-away, reserved for incoming stock, and empty but blocked. The gap between the first and the second is the number an operator can actually use today.",
    to: "/dashboards/empty-cells",
    linkLabel: "Empty Cells",
  },
  {
    title: "Show where capacity is being lost",
    detail:
      "Partially Filled Pallets quantifies part loads and lists conservative consolidation candidates. Every fill percentage states its basis - the product's own pallet capacity, not the 800 kg structural rating of the position.",
    to: "/dashboards/partial-pallets",
    linkLabel: "Partially Filled Pallets",
  },
  {
    title: "Show the building in three dimensions",
    detail:
      "Switch the occupancy panel to 3D. Every installed position is drawn and coloured by what is in it. Use the legend to filter - show only the positions with room, or only the blocked ones - then click a position to glide the camera in and read its capacity, remaining space and contents.",
    to: "/dashboards/warehouse-occupancy?view=3d",
    linkLabel: "3D warehouse",
  },
  {
    title: "Follow the material through the building",
    detail:
      "Operations is grouped the way the warehouse runs: Inbound receives and puts away into the Raw section, Production issues raw material out and receives finished goods back into the FG section, and Outbound picks and dispatches. Raw to production to finished goods, end to end.",
    to: "/operations?preset=prod_issue",
    linkLabel: "Issues to Production",
  },
  {
    title: "Move to stock value and availability",
    detail:
      "Stock Visibility separates on hand, reserved and available to pick, and keeps every quantity inside its own unit of measure. Reservations reduce what can be picked without touching on-hand quantity.",
    to: "/dashboards/stock-visibility",
    linkLabel: "Stock Visibility",
  },
  {
    title: "Prove the numbers connect",
    detail:
      "Click any figure or any chart segment. A card that counts distinct pallets opens exactly that many pallet records, with the condition carried across as a visible facet that can be removed.",
    to: "/dashboards/stock-visibility",
    linkLabel: "Stock Visibility",
  },
  {
    title: "Close on traceability and honesty",
    detail:
      "Inventory by Lot walks one lot from receipt to its current pallets and positions. Then show the assumptions page: what came from the drawing, what is provisional, and what still needs Ispahani's confirmation - starting with how the 219 bays split between the two sections.",
    to: "/about/assumptions",
    linkLabel: "Source Drawing Assumptions",
  },
];

const OPERATIONS: Step[] = [
  {
    title: "Start at the outstanding work",
    detail:
      "Operations filtered to what is not yet processed: draft receipts, put-aways waiting to be done, and picks that are Ready because stock is reserved for them.",
    to: "/operations?preset=todo",
    linkLabel: "Operations to process",
  },
  {
    title: "Complete a put-away",
    detail:
      "Open a Ready put-away. Its destination position was suggested because it is empty, unblocked, compatible with the goods and not already claimed by another operation. Validate it and watch the position change state on the map.",
    to: "/operations?preset=putaway",
    linkLabel: "Put-away operations",
  },
  {
    title: "Bring a waiting pick to Ready",
    detail:
      "Open a Waiting pick: it has demand but nothing reserved, so there is no lot or pallet on the line yet. Check Availability finds stock by the product's removal strategy, reserves it, and fills in the lot and pallet. Only then does Validate appear.",
    to: "/operations?preset=waiting",
    linkLabel: "Waiting operations",
  },
  {
    title: "Pick part of a pallet",
    detail:
      "Open a full pallet, use Pick from this pallet, then Validate with a reduced quantity. The system offers a back order or lets you cancel the remaining demand - and cancelling does not make undelivered stock disappear.",
    to: "/pallets?preset=partial",
    linkLabel: "Partially filled pallets",
  },
  {
    title: "Relocate a pallet",
    detail:
      "Relocate pallet lists compatible destinations and states why each one qualifies. Creating the transfer claims that position so a second operation cannot be routed to it.",
    to: "/pallets",
    linkLabel: "Pallets",
  },
  {
    title: "Find anything by any handle",
    detail:
      "Search a lot reference, a pallet licence plate, a rack code or a product name. Add Filters and Group By - including by section - save the result as a favourite, then reopen it later.",
    to: "/stock",
    linkLabel: "Stock lines",
  },
  {
    title: "Show the audit trail",
    detail:
      "Movement history keeps every validated movement, with the source and destination position and the pallet involved. Validated operations cannot be cancelled - they keep their history.",
    to: "/reporting/inventory-movement-history",
    linkLabel: "Movement History",
  },
];

interface Journey {
  id: string;
  title: string;
  steps: string[];
  outcome: string;
  to: string;
}

const JOURNEYS: Journey[] = [
  {
    id: "J1",
    title: "Stock Visibility → product → lot → pallet → locate on the map",
    steps: [
      "Open Stock Visibility and select a product bar in Product quantity analysis.",
      "Open the product record and pick a lot from its Lots tab.",
      "From the lot, open one of its pallets.",
      "From the pallet, open its position, then view it inside the rack elevation.",
    ],
    outcome:
      "The same lot and pallet identifiers appear at every step, and the final screen shows the physical position in the rack.",
    to: "/dashboards/stock-visibility",
  },
  {
    id: "J2",
    title: "Warehouse Occupancy → section → rack elevation → cell → pallet",
    steps: [
      "Open Warehouse Occupancy. The comparison chart shows the Raw and FG sections.",
      "Select a rack on the floor plan to load its elevation.",
      "Select an occupied position to open the preview.",
      "Use Open Pallet from the preview.",
    ],
    outcome:
      "Occupancy percentages on the rack match the tiles drawn in its elevation, and the pallet record matches the preview.",
    to: "/dashboards/warehouse-occupancy",
  },
  {
    id: "J2b",
    title: "3D warehouse → filter → position → info card, and live recolouring",
    steps: [
      "Switch the occupancy panel to 3D and note the legend counts.",
      "Select a legend row to filter - Free Space Available on its own, say. Filtered-out positions stay as faint shells.",
      "Show all again, then click a red position: the camera glides in and a card gives the location, total capacity, available space and contents.",
      "Pick part of that pallet elsewhere in the app, validate, and return to the 3D view.",
    ],
    outcome:
      "The picked position changes from red to green and the legend counts move by one, because the 3D view reads the same live state as the dashboards. The six legend counts always sum to the 1,895 installed positions.",
    to: "/dashboards/warehouse-occupancy?view=3d",
  },
  {
    id: "J3",
    title: "Empty Cell → compatible destination → internal transfer → updated occupancy",
    steps: [
      "Open Empty Cells and select a product in the suggestion panel.",
      "Note why each suggested position qualifies.",
      "Open a pallet and use Relocate pallet, choosing a suggested destination.",
      "Validate the transfer, then return to the occupancy dashboard.",
    ],
    outcome:
      "Total stock and the overall occupied-position count are unchanged - a relocation moves a pallet, it does not create or destroy one. The source and destination rack summaries both change.",
    to: "/dashboards/empty-cells",
  },
  {
    id: "J4",
    title: "Full pallet → partial pick → updated quantity and fill",
    steps: [
      "Open a full 800 kg pallet - PAL-000024 in RAW/A2/R004/B09-L0-P1 is one of 97 that qualify.",
      "Use Pick from this pallet for 200 kg, which creates a Ready pick and reserves the quantity.",
      "Validate the pick.",
    ],
    outcome:
      "The pallet holds 600 kg, its fill drops to 75% against the same 800 kg capacity basis, the position stays occupied, and the stock age is unchanged - picking from a pallet does not reset its receipt date.",
    to: "/pallets/pal_000024",
  },
  {
    id: "J4b",
    title: "Waiting pick → Check Availability → Ready → Validate",
    steps: [
      "Open a Waiting pick. Demand is set but Reserved is zero and the line carries no lot or pallet.",
      "Press Check Availability.",
      "Press Validate.",
    ],
    outcome:
      "Check Availability reserves the demand and fills in the lot and pallet, the state moves to Ready, and only then is Validate offered. A Ready operation always has its demand reserved - the integrity page asserts it.",
    to: "/operations?preset=waiting",
  },
  {
    id: "J5",
    title: "Raw → production → finished goods",
    steps: [
      "Open Operations → Production → Issues to Production. Each one moves raw or packing material out of a Raw section position to Virtual/Production.",
      "Open Receipts from Production. Each one brings finished goods back from Virtual/Production into an FG section position.",
      "Open one of each and compare the source document reference.",
    ],
    outcome:
      "The two halves of production share a batch reference, and stock is only ever consumed from the Raw section and produced into the FG section. Manufacturing itself is out of scope: there is no order and no bill of materials, only the two ends the warehouse sees.",
    to: "/operations?preset=prod_issue",
  },
  {
    id: "J6",
    title: "Inventory by Location / Product / Lot → filter and group → supporting records",
    steps: [
      "Open Inventory by Location and drill from the warehouse down through aisle to rack.",
      "Open the stock lines for that scope.",
      "Group by section, then by product, and check the subtotals.",
      "Export the filtered scope to CSV.",
    ],
    outcome:
      "Group counts and subtotals reconcile with the figures on the dashboard, and the CSV contains exactly the filtered scope - no more rows and no fewer.",
    to: "/dashboards/inventory-by-location",
  },
  {
    id: "J7",
    title: "Save a favourite → navigate away → restore → open a record → return with context",
    steps: [
      "Filter a list, add a Group By, then Favorites → Save current search.",
      "Navigate to another screen, then reopen the favourite.",
      "Open a record from the restored list and use the browser Back button.",
    ],
    outcome:
      "Filters, grouping, sort order and page are all restored, and returning from the record keeps them.",
    to: "/pallets",
  },
];

export function WalkthroughsPage() {
  return (
    <>
      <ControlPanel
        title="Walkthroughs"
        breadcrumbs={[{ label: "About this prototype" }]}
        subtitle="Scripted routes for a client session, plus the end-to-end journeys used to verify the prototype."
      />
      <div className="p-4">
        <div className="o-sheet max-w-[1180px] mx-auto p-5 text-[var(--o-fs-sm)] leading-relaxed">
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
            <StepList
              title="Management walkthrough"
              subtitle="About 10 minutes. Capacity and control first, detail second."
              steps={MANAGEMENT}
            />
            <StepList
              title="Operations walkthrough"
              subtitle="About 10 minutes. Daily work, in the order an operator meets it."
              steps={OPERATIONS}
            />
          </div>

          <h3 className="text-[var(--o-fs-lg)] font-medium mt-7 mb-2 pb-1 border-b border-[var(--o-border-subtle)]">
            End-to-end journeys
          </h3>
          <div className="flex flex-col gap-3">
            {JOURNEYS.map((journey) => (
              <div key={journey.id} className="o-card p-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <Badge tone="brand">{journey.id}</Badge>
                  <h4 className="m-0 text-[var(--o-fs-base)] font-medium">
                    {journey.title}
                  </h4>
                  <Link className="o-btn o-btn-secondary o-btn-sm ml-auto" to={journey.to}>
                    Start
                  </Link>
                </div>
                <ol className="list-decimal pl-5 mt-2 mb-2">
                  {journey.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="m-0 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
                  <strong>Expected outcome:</strong> {journey.outcome}
                </p>
              </div>
            ))}
          </div>

          <h3 className="text-[var(--o-fs-lg)] font-medium mt-7 mb-2 pb-1 border-b border-[var(--o-border-subtle)]">
            Presenting honestly
          </h3>
          <ul className="list-disc pl-5 mb-0">
            <li>
              All stock, lots, pallets, operators and partners are illustrative
              demonstration data, not Ispahani records.
            </li>
            <li>
              Warehouse capacities come from the MinMax drawings and reconcile with
              them exactly. Floor plan geometry is schematic.
            </li>
            <li>
              The maps, occupancy colouring and consolidation suggestions are
              proposed extensions, not stock Odoo configuration.
            </li>
            <li>
              Do not quote accuracy percentages, savings or ROI from this prototype.
              It has no basis for any of them.
            </li>
            <li>
              Use <strong>Reset Demo</strong> between sessions to restore the seeded
              state.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

function StepList({
  title,
  subtitle,
  steps,
}: {
  title: string;
  subtitle: string;
  steps: Step[];
}) {
  return (
    <section>
      <h3 className="text-[var(--o-fs-lg)] font-medium mt-0 mb-1">{title}</h3>
      <p className="mt-0 mb-3 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
        {subtitle}
      </p>
      <ol className="list-none p-0 m-0 flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span
              className="flex items-center justify-center rounded-full shrink-0 text-[var(--o-fs-xs)] font-medium"
              style={{
                width: 22,
                height: 22,
                background: "var(--o-brand-primary-tint)",
                color: "var(--o-brand-primary)",
              }}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="font-medium">{step.title}</div>
              <div className="text-[var(--o-text-muted)]">{step.detail}</div>
              {step.to && (
                <Link className="text-[var(--o-fs-xs)]" to={step.to}>
                  {step.linkLabel ?? "Open"} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export { JOURNEYS };
