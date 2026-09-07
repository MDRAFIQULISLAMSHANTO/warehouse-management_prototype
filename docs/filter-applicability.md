# Filter and Widget Applicability

Which global filters affect which parts of a dashboard, and — just as important —
which ones deliberately do not. Also available in the application at
`/about/filters`.

The map is not documentation of intent; it is executable. `src/dashboards/scope.ts`
translates the dashboard's search state into one domain per target dataset and
drops what cannot be expressed, and the dashboard tells the user on screen when
a filter is being applied differently from how they might expect.

## The map

| Filter group | Stock figures | Installed capacity | Pallet figures | Movement charts |
|---|---|---|---|---|
| Warehouse, aisle, rack, bay, level, material group | Applies | **Applies** | Applies | Applies |
| Product, variant, category, lot, pallet | Applies | **Highlights only** | Applies | Applies |
| Occupancy status (occupied, empty, blocked, reserved for incoming) | — | Applies | — | — |
| Pallet status (full, partial, empty) | — | Applies to the positions holding them | Applies | — |
| Quantity, availability, fill %, stock age | Applies | Highlights only | Applies | — |
| Movement date period, operation type, operation status, operator | — | — | — | **Applies** |

## Why capacity is treated differently

Installed capacity is a physical fact about the building. Filtering a dashboard
to one product must not make the warehouse appear to have fewer positions than
it has, so product-type filters never enter the occupancy **denominator**. They
highlight matching positions on the maps instead.

Concretely: filtering Warehouse Occupancy to "Black Tea BOP" leaves *Installed
positions* at its true value and highlights the racks holding that product. It
does not silently redefine the warehouse as being only as large as that
product's footprint.

## Why movement periods do not touch stock balances

A date filter such as "Last 30 Days" is about **activity**, not about what is on
hand. Applying it to current balances would silently hide older inventory that is
still physically in the racks. Movement charts honour the period; stock figures
always show today's position.

## Units of measure

Quantities are summed only within one unit. A scope mixing kilograms and cartons
reports each unit separately rather than producing a meaningless total — in list
footers, in group subtotals, and in pivot cells.

Percentages are never summed. Occupancy and fill are recomputed from their own
numerator and denominator at every group level.

Charts that plot a quantity carry an explicit unit selector, because plotting
"quantity" across four units of measure would be meaningless. Charts that must
compare across material groups count **pallets** instead of quantity, and say so.

## Filter logic

Predefined filters follow Odoo's grouping:

- alternatives **inside one group** combine with **OR**
- **separate groups** combine with **AND**

Selecting *Full Pallets* and *Partially Filled Pallets* together with *Finished
Goods* produces:

```
(status = full OR status = partial) AND materialGroup = FG
```

which is exactly the domain the URL carries.

## Custom filters

**Add Custom Filter** builds conditions from available record fields with
type-appropriate operators:

| Field type | Operators |
|---|---|
| Text / reference | contains, does not contain, =, !=, is set, is not set |
| Number | =, !=, >, >=, <, <=, is between |
| Date / datetime | is on, is before, is after, is on or before, is on or after, is between, is set, is not set |
| Selection / status | =, !=, is in, is not in |
| Related record | =, !=, is in, is not in, is set, is not set |
| Boolean | Yes / No |
| Location hierarchy | **is under** (selected location and all descendants), =, !=, is in, is not in |

Match **all** / Match **any**, with nested branches for advanced combinations.
Conditions are stored as structured data and evaluated by the application's own
query engine — nothing entered by a user is evaluated as code. A condition left
without a value is dropped on apply rather than silently matching everything.

## Date periods

Today · Yesterday · This Week · Last Week · This Month · Last Month · This
Quarter · This Year · Last 7 Days · Last 30 Days · Last 90 Days · Custom Range.

All are computed against a fixed demonstration instant in **Asia/Dhaka
(UTC+06:00)**, not the machine clock, so a screenshot means the same thing on
every machine and on any day. The menu names the field it filters — receipt
date, movement date or scheduled date — so there is no ambiguity about what is
being narrowed.

## Group By

Warehouse, material group, aisle, rack, column/bay, row/level, cell, product
category, product, variant, lot, pallet, status, operation type, operator and
date, with day / week / month / quarter / year granularity where relevant.
Multiple levels, expand and collapse, group counts and valid subtotals. **Add
Custom Group** exposes any groupable field.

## Favourites

Save Current Search, name it, **Use by Default**, restore, rename, delete, and
copy a link to the current filtered view. Favourites are stored in the browser
only. In Odoo they are user records and can be shared; nothing here is shared
between users, and the menu says so.

A saved default applies **only** when a screen is opened without a search of its
own, so arriving from a dashboard drill-down never has its filters silently
overwritten by someone's saved default.
