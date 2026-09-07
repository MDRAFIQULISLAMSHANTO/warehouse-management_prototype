import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { EmptyCellDashboard } from "@/dashboards/EmptyCells";
import { InventoryByLocationDashboard } from "@/dashboards/InventoryByLocation";
import { InventoryByLotDashboard } from "@/dashboards/InventoryByLot";
import { InventoryByProductDashboard } from "@/dashboards/InventoryByProduct";
import { PartialPalletDashboard } from "@/dashboards/PartialPallets";
import { StockVisibilityDashboard } from "@/dashboards/StockVisibility";
import { WarehouseOccupancyDashboard } from "@/dashboards/WarehouseOccupancy";
import { OperationDetail } from "@/pages/OperationDetail";
// Documentation and configuration screens are reference material rather than
// part of the demonstration flow, so they load on demand and stay out of the
// main bundle.
const AssumptionsPage = lazy(() =>
  import("@/pages/about").then((m) => ({ default: m.AssumptionsPage })),
);
const FilterApplicabilityPage = lazy(() =>
  import("@/pages/about").then((m) => ({ default: m.FilterApplicabilityPage })),
);
const IntegrityPage = lazy(() =>
  import("@/pages/about").then((m) => ({ default: m.IntegrityPage })),
);
const OdooMappingPage = lazy(() =>
  import("@/pages/about").then((m) => ({ default: m.OdooMappingPage })),
);
const RequirementsCoveragePage = lazy(() =>
  import("@/pages/about").then((m) => ({ default: m.RequirementsCoveragePage })),
);
const OperationTypesPage = lazy(() =>
  import("@/pages/configuration").then((m) => ({ default: m.OperationTypesPage })),
);
const OperatorsPage = lazy(() =>
  import("@/pages/configuration").then((m) => ({ default: m.OperatorsPage })),
);
const PackageTypesPage = lazy(() =>
  import("@/pages/configuration").then((m) => ({ default: m.PackageTypesPage })),
);
const RackProfilesPage = lazy(() =>
  import("@/pages/configuration").then((m) => ({ default: m.RackProfilesPage })),
);
const StorageCategoriesPage = lazy(() =>
  import("@/pages/configuration").then((m) => ({ default: m.StorageCategoriesPage })),
);
import { LotDetail, ProductDetail } from "@/pages/detailsCatalog";
import {
  CellDetail,
  PalletDetail,
  RackDetail,
  WarehouseDetail,
} from "@/pages/detailsPhysical";
import {
  BlendOperationReport,
  CellsList,
  EmptyPalletReport,
  FifoPickingReport,
  InventoryByPalletReport,
  LifoPickingReport,
  LotsList,
  MovementHistoryReport,
  MovementsList,
  OperationsList,
  PalletsList,
  PartiallyFilledPalletReport,
  ProductsList,
  RacksList,
  StockAgingReport,
  StockList,
  StockOnHandByLocationReport,
  WarehouseOccupancyReport,
  WarehousesList,
} from "@/pages/lists";
import { WalkthroughsPage } from "@/pages/walkthroughs";
import { EmptyState } from "@/odoo/primitives";
import { AppShell } from "./AppShell";
import { DASHBOARD_ROUTES } from "./menu";

export default function App() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="p-6 text-[var(--o-fs-sm)] text-[var(--o-text-muted)]">
            Loading…
          </div>
        }
      >
      <Routes>
        <Route
          path="/"
          element={<Navigate to={DASHBOARD_ROUTES.stockVisibility} replace />}
        />

        {/* Dashboards */}
        <Route path={DASHBOARD_ROUTES.stockVisibility} element={<StockVisibilityDashboard />} />
        <Route path={DASHBOARD_ROUTES.warehouseOccupancy} element={<WarehouseOccupancyDashboard />} />
        <Route path={DASHBOARD_ROUTES.emptyCells} element={<EmptyCellDashboard />} />
        <Route path={DASHBOARD_ROUTES.partialPallets} element={<PartialPalletDashboard />} />
        <Route path={DASHBOARD_ROUTES.inventoryByLocation} element={<InventoryByLocationDashboard />} />
        <Route path={DASHBOARD_ROUTES.inventoryByProduct} element={<InventoryByProductDashboard />} />
        <Route path={DASHBOARD_ROUTES.inventoryByLot} element={<InventoryByLotDashboard />} />

        {/* Operations */}
        <Route path="/operations" element={<OperationsList />} />
        <Route path="/operations/:id" element={<OperationDetail />} />
        <Route path="/movements" element={<MovementsList />} />

        {/* Products and stock */}
        <Route path="/stock" element={<StockList />} />
        <Route path="/products" element={<ProductsList />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/lots" element={<LotsList />} />
        <Route path="/lots/:id" element={<LotDetail />} />

        {/* Pallets */}
        <Route path="/pallets" element={<PalletsList />} />
        <Route path="/pallets/:id" element={<PalletDetail />} />

        {/* Locations */}
        <Route path="/locations/warehouses" element={<WarehousesList />} />
        <Route path="/locations/warehouses/:id" element={<WarehouseDetail />} />
        <Route path="/locations/racks" element={<RacksList />} />
        <Route path="/locations/racks/:id" element={<RackDetail />} />
        <Route path="/locations/cells" element={<CellsList />} />
        <Route path="/locations/cells/:id" element={<CellDetail />} />

        {/* Reporting */}
        <Route path="/reporting/stock-on-hand-by-location" element={<StockOnHandByLocationReport />} />
        <Route path="/reporting/inventory-by-pallet" element={<InventoryByPalletReport />} />
        <Route path="/reporting/inventory-movement-history" element={<MovementHistoryReport />} />
        <Route path="/reporting/empty-pallets" element={<EmptyPalletReport />} />
        <Route path="/reporting/partially-filled-pallets" element={<PartiallyFilledPalletReport />} />
        <Route path="/reporting/warehouse-occupancy" element={<WarehouseOccupancyReport />} />
        <Route path="/reporting/fifo-picking" element={<FifoPickingReport />} />
        <Route path="/reporting/lifo-picking" element={<LifoPickingReport />} />
        <Route path="/reporting/blend-operation" element={<BlendOperationReport />} />
        <Route path="/reporting/stock-aging" element={<StockAgingReport />} />

        {/* Configuration */}
        <Route path="/configuration/storage-categories" element={<StorageCategoriesPage />} />
        <Route path="/configuration/package-types" element={<PackageTypesPage />} />
        <Route path="/configuration/operation-types" element={<OperationTypesPage />} />
        <Route path="/configuration/operators" element={<OperatorsPage />} />
        <Route path="/configuration/rack-profiles" element={<RackProfilesPage />} />

        {/* Documentation */}
        <Route path="/about/requirements" element={<RequirementsCoveragePage />} />
        <Route path="/about/assumptions" element={<AssumptionsPage />} />
        <Route path="/about/odoo-mapping" element={<OdooMappingPage />} />
        <Route path="/about/filters" element={<FilterApplicabilityPage />} />
        <Route path="/about/walkthroughs" element={<WalkthroughsPage />} />
        <Route path="/about/integrity" element={<IntegrityPage />} />

        <Route
          path="*"
          element={
            <EmptyState
              title="Page not found"
              hint="Use the menu above to reach a dashboard, a record list or a report."
            />
          }
        />
      </Routes>
      </Suspense>
    </AppShell>
  );
}
