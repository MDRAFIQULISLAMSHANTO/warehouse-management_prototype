# Odoo Flow Mapping

How each retained warehouse activity maps onto Odoo Inventory concepts, which
rules are enforced, and which routing decisions are assumptions awaiting
confirmation. Also available in the application at `/about/odoo-mapping`.

References used:

- <https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/shipping_receiving/daily_operations/receipts_delivery_two_steps.html>
- <https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/product_management/configure/package.html>
- <https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/shipping_receiving/daily_operations/putaway.html>
- <https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/inventory/shipping_receiving/daily_operations/storage_category.html>
- <https://www.odoo.com/documentation/19.0/applications/essentials/search.html>

## Terminology

| This prototype | Odoo Inventory | Note |
|---|---|---|
| Cell (pallet position) | `stock.location`, usage `internal` | One position per location, capacity one pallet |
| Aisle / Rack | reference records | Referenced by the cell; kept out of the location tree to keep aggregates fast |
| Pallet | `stock.quant.package` | Unique licence plate; keeps its identity when emptied |
| Package type | `stock.package.type` | 1200 × 1000, 800 kg, from the drawings |
| Stock line | `stock.quant` | Product, variant, lot, package, location, quantity, reserved quantity |
| Operation | `stock.picking` | Receipt, put-away, internal transfer, pick, delivery |
| Operation line | `stock.move` | Product-level demand |
| Detailed operation | `stock.move.line` | Lot, source/destination package and location |
| Operation type | `stock.picking.type` | One set per warehouse |
| Storage category | `stock.storage.category` | Max weight, accepted material groups, allow-new-product rule |
| Removal strategy | product / category removal strategy | FIFO, LIFO, closest location, least packages |
| Rack profile | *(none)* | A drawing concept, not an Odoo model. Modelled as a reference record |

## Business activity to prototype flow

| Business activity | Prototype flow |
|---|---|
| Receiving | Receipt document → product, lot and quantity entry → pallet assignment → Validate into the receiving/input area |
| Put-away | Input → suggested compatible cell → internal transfer → Validate. Creating the transfer claims the destination so no other pending operation can take it |
| Picking | Demand → Check Availability → FIFO/LIFO or permitted manual lot selection → quantities reserved → record picked quantity |
| Dispatch | Pick from the cell to output/staging, then delivery validation to the customer location |
| Internal relocation | Source cell/pallet → destination cell → Validate |
| Partial picking | Record the actual quantity → Validate → choose a back order or cancel the remaining demand |
| Empty pallet handling | When contents reach zero the pallet keeps its identity and stays in its position until it is removed or relocated explicitly |

## Operation states

`Draft → Waiting → Ready → Done`, plus `Cancelled`.

Actions: **Check Availability**, **Validate**, **Cancel**, **Set to Draft**, and
back-order handling on partial validation.

## Rules enforced

- Draft and suggested operations do not change physical stock.
- Reservations affect **available** stock, never **on-hand** quantity.
- Validation changes the appropriate stock and location balances.
- Cancelling an uncompleted operation releases its reservations.
- Partial validation offers an explicit choice for the remaining demand.
- Cancelling the remaining demand closes the paperwork only — stock that was
  never moved stays exactly where it is.
- Completed operations retain their movement history and cannot be cancelled.
- Repeated clicks and page refreshes cannot apply an operation twice. State is
  the seed plus an ordered action log; validating an operation that is already
  Done is a no-op.
- Dependent operations wait for their upstream operation; validating the upstream
  operation releases them.
- Quantity, lot, source package and destination package are all represented when
  moving partial contents or whole pallets.
- No two pending operations may claim the same exclusive destination.
- Picking beyond the available quantity is refused.

## Put-away and compatibility

Compatibility follows the Odoo model: a position carries a **storage category**
with a maximum weight and an allow-new-product rule, and a suggestion is only
offered when

1. the position is empty, unblocked and not already claimed by a pending
   operation;
2. the storage category accepts the product's material group;
3. the resulting load is within both the storage category's maximum weight and
   the position's own rating.

Ranking among the qualifying positions is a documented heuristic — same
warehouse, then same aisle, then same rack, then accessibility, with ground
positions preferred. It is **not** a measured shortest forklift route, and the
interface says so wherever suggestions appear.

## Consolidation rule

Deliberately conservative and shown to the user: **same product, same variant,
same lot, and enough remaining capacity to absorb the whole quantity.** Anything
looser needs a business decision about mixing lots on one pallet.

## Assumptions awaiting confirmation

- **Two-step inbound** (receipt into an input area, then put-away) and
  **two-step outbound** (pick to output, then delivery) are used throughout.
  Whether the client wants one-step or two-step routing is a configuration
  decision.
- Purchase, Sales, Accounting and Manufacturing are outside this prototype's
  scope. Operations therefore start from warehouse documents carrying a
  reference to a notional source document rather than from a real purchase or
  sales order.
- Input, output, staging and quality-hold areas exist per warehouse and are
  excluded from installed-position totals.
