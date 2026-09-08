/**
 * Application menu.
 *
 * Mirrors how an Odoo app is organised: a small number of top-level menus, each
 * opening a grouped list of actions. Every dashboard is separately addressable,
 * which is a requirement of the brief, not a convenience.
 */

export interface MenuEntry {
  label: string;
  to: string;
  hint?: string;
}

export interface MenuSection {
  title?: string;
  entries: MenuEntry[];
}

export interface TopMenu {
  id: string;
  label: string;
  sections: MenuSection[];
}

export const DASHBOARD_ROUTES = {
  stockVisibility: "/dashboards/stock-visibility",
  warehouseOccupancy: "/dashboards/warehouse-occupancy",
  emptyCells: "/dashboards/empty-cells",
  partialPallets: "/dashboards/partial-pallets",
  inventoryByLocation: "/dashboards/inventory-by-location",
  inventoryByProduct: "/dashboards/inventory-by-product",
  inventoryByLot: "/dashboards/inventory-by-lot",
} as const;

export const REPORT_ROUTES = {
  stockOnHandByLocation: "/reporting/stock-on-hand-by-location",
  inventoryByPallet: "/reporting/inventory-by-pallet",
  movementHistory: "/reporting/inventory-movement-history",
  emptyPallets: "/reporting/empty-pallets",
  partiallyFilledPallets: "/reporting/partially-filled-pallets",
  warehouseOccupancy: "/reporting/warehouse-occupancy",
  fifoPicking: "/reporting/fifo-picking",
  lifoPicking: "/reporting/lifo-picking",
  blendOperation: "/reporting/blend-operation",
  stockAging: "/reporting/stock-aging",
} as const;

export const MENUS: TopMenu[] = [
  {
    id: "dashboards",
    label: "Dashboards",
    sections: [
      {
        title: "Stock",
        entries: [
          {
            label: "Stock Visibility",
            to: DASHBOARD_ROUTES.stockVisibility,
            hint: "Products, lots, pallets, on-hand, reserved and available",
          },
          {
            label: "Inventory by Product",
            to: DASHBOARD_ROUTES.inventoryByProduct,
          },
          { label: "Inventory by Lot", to: DASHBOARD_ROUTES.inventoryByLot },
          {
            label: "Inventory by Location",
            to: DASHBOARD_ROUTES.inventoryByLocation,
          },
        ],
      },
      {
        title: "Physical storage",
        entries: [
          {
            label: "Warehouse Occupancy",
            to: DASHBOARD_ROUTES.warehouseOccupancy,
            hint: "Floor plans, rack elevations and physical occupancy",
          },
          { label: "Empty Cells", to: DASHBOARD_ROUTES.emptyCells },
          {
            label: "Partially Filled Pallets",
            to: DASHBOARD_ROUTES.partialPallets,
          },
        ],
      },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    sections: [
      {
        entries: [
          { label: "All Operations", to: "/operations" },
          {
            label: "To Process",
            to: "/operations?preset=todo",
            hint: "Everything not yet completed: draft, waiting and ready.",
          },
        ],
      },
      {
        title: "Inbound",
        entries: [
          {
            label: "Receipts",
            to: "/operations?preset=receipts",
            hint: "Goods arriving from a supplier into the input area.",
          },
          {
            label: "Put-Away",
            to: "/operations?preset=putaway",
            hint: "Moving received pallets from the input area into a rack position.",
          },
        ],
      },
      {
        title: "Outbound",
        entries: [
          {
            label: "Picks",
            to: "/operations?preset=pick",
            hint: "Taking stock out of a rack position to the dispatch staging area.",
          },
          {
            label: "Deliveries",
            to: "/operations?preset=delivery",
            hint: "Dispatching staged goods to the customer.",
          },
        ],
      },
      {
        title: "Production",
        entries: [
          {
            label: "Issue to Production",
            to: "/operations?preset=prod_issue",
            hint: "Raw material and packing material leaving the Raw section for production.",
          },
          {
            label: "Receive from Production",
            to: "/operations?preset=prod_receipt",
            hint: "Finished goods coming back from production into the FG section.",
          },
        ],
      },
      {
        title: "Internal and history",
        entries: [
          {
            label: "Internal Transfers",
            to: "/operations?preset=internal",
            hint: "Moving a pallet between positions inside the building.",
          },
          { label: "Inventory Movements", to: "/movements" },
        ],
      },
    ],
  },
  {
    id: "products",
    label: "Products",
    sections: [
      {
        entries: [
          { label: "Products", to: "/products" },
          { label: "Lots / Serial Numbers", to: "/lots" },
          { label: "Stock Lines", to: "/stock" },
        ],
      },
    ],
  },
  {
    id: "pallets",
    label: "Pallets",
    sections: [
      {
        entries: [
          { label: "All Pallets", to: "/pallets" },
          { label: "Partially Filled", to: "/pallets?preset=partial" },
          { label: "Empty Pallets", to: "/pallets?preset=empty" },
          { label: "Free Pallets", to: "/pallets?preset=free" },
        ],
      },
    ],
  },
  {
    id: "locations",
    label: "Locations",
    sections: [
      {
        entries: [
          { label: "Warehouses", to: "/locations/warehouses" },
          { label: "Racks", to: "/locations/racks" },
          { label: "Cells", to: "/locations/cells" },
        ],
      },
      {
        title: "Visualisation",
        entries: [
          {
            label: "3D Warehouse",
            to: "/dashboards/warehouse-occupancy?view=3d",
            hint: "Every pallet position in three dimensions, coloured by what is in it and updated live as operations are validated.",
          },
          {
            label: "2D Floor Plan",
            to: "/dashboards/warehouse-occupancy",
            hint: "Schematic plan view of the rack runs.",
          },
        ],
      },
    ],
  },
  {
    id: "reporting",
    label: "Reporting",
    sections: [
      {
        title: "Stock",
        entries: [
          { label: "Stock on Hand by Location", to: REPORT_ROUTES.stockOnHandByLocation },
          { label: "Inventory by Pallet", to: REPORT_ROUTES.inventoryByPallet },
          { label: "Stock Aging", to: REPORT_ROUTES.stockAging },
          { label: "Inventory Movement History", to: REPORT_ROUTES.movementHistory },
        ],
      },
      {
        title: "Pallets and capacity",
        entries: [
          { label: "Empty Pallet Report", to: REPORT_ROUTES.emptyPallets },
          {
            label: "Partially Filled Pallet Report",
            to: REPORT_ROUTES.partiallyFilledPallets,
          },
          { label: "Warehouse Occupancy Report", to: REPORT_ROUTES.warehouseOccupancy },
        ],
      },
      {
        title: "Picking",
        entries: [
          { label: "FIFO Picking Report", to: REPORT_ROUTES.fifoPicking },
          { label: "LIFO Picking Report", to: REPORT_ROUTES.lifoPicking },
          {
            label: "Blend Operation Report",
            to: REPORT_ROUTES.blendOperation,
            hint: "Manual lot selection records only - no blend sheet is generated",
          },
        ],
      },
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    sections: [
      {
        entries: [
          { label: "Storage Categories", to: "/configuration/storage-categories" },
          { label: "Package Types", to: "/configuration/package-types" },
          { label: "Operation Types", to: "/configuration/operation-types" },
          { label: "Operators", to: "/configuration/operators" },
          { label: "Rack Profiles", to: "/configuration/rack-profiles" },
        ],
      },
      {
        title: "About this prototype",
        entries: [
          { label: "Requirements Coverage", to: "/about/requirements" },
          { label: "Source Drawing Assumptions", to: "/about/assumptions" },
          { label: "Odoo Flow Mapping", to: "/about/odoo-mapping" },
          { label: "Filter Applicability", to: "/about/filters" },
          { label: "Walkthroughs", to: "/about/walkthroughs" },
          { label: "Data Integrity Checks", to: "/about/integrity" },
        ],
      },
    ],
  },
];
