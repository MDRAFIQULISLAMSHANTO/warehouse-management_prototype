/**
 * Configuration screens.
 *
 * The reference records the warehouse behaviour depends on. They are read-only
 * in this prototype: changing them would change capacity and compatibility
 * rules mid-demonstration, which is a decision for the implementation project,
 * not a presentation.
 */

import type { ReactNode } from "react";
import { ControlPanel } from "@/odoo/ControlPanel";
import { formatInt } from "@/odoo/format";
import { Badge } from "@/odoo/primitives";
import { useAppStore } from "@/store/appStore";

function ConfigPage({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <ControlPanel
        title={title}
        breadcrumbs={[{ label: "Configuration" }]}
        subtitle={description}
      />
      <div className="p-4">
        <div className="o-card p-3 max-w-[1500px] mx-auto">{children}</div>
      </div>
    </>
  );
}

export function StorageCategoriesPage() {
  const categories = useAppStore((s) => s.data.storageCategories);
  return (
    <ConfigPage
      title="Storage Categories"
      description="Odoo uses storage categories with put-away rules to decide which positions may accept which goods. Capacity and compatibility checks in this prototype follow the same model."
    >
      <table className="o-list">
        <thead>
          <tr>
            <th>Storage category</th>
            <th style={{ textAlign: "right" }}>Max weight</th>
            <th>Accepts material groups</th>
            <th>Allow new product</th>
            <th style={{ textAlign: "right" }}>Pallet capacity</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => (
            <tr key={category.id}>
              <td className="font-medium">{category.name}</td>
              <td className="num">{category.maxWeightKg} kg</td>
              <td>
                <div className="flex gap-1">
                  {category.accepts.map((group) => (
                    <Badge key={group} tone="neutral">
                      {group}
                    </Badge>
                  ))}
                </div>
              </td>
              <td>
                {category.allowNewProduct === "empty"
                  ? "If the position is empty"
                  : category.allowNewProduct === "same"
                    ? "If the products are the same"
                    : "Allow mixed products"}
              </td>
              <td className="num">{category.palletCapacity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
        Field names follow Odoo's <code>stock.storage.category</code>: max weight,
        allow new product, and capacity by product or by package type.
      </p>
    </ConfigPage>
  );
}

export function PackageTypesPage() {
  const types = useAppStore((s) => s.data.packageTypes);
  return (
    <ConfigPage
      title="Package Types"
      description="Pallet formats. The 1200 x 1000 pallet and its 800 kg rating come from the MinMax drawings; the half pallet is a prototype assumption for demonstration variety."
    >
      <table className="o-list">
        <thead>
          <tr>
            <th>Package type</th>
            <th style={{ textAlign: "right" }}>Length</th>
            <th style={{ textAlign: "right" }}>Width</th>
            <th style={{ textAlign: "right" }}>Height</th>
            <th style={{ textAlign: "right" }}>Max weight</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {types.map((type) => (
            <tr key={type.id}>
              <td className="font-medium">{type.name}</td>
              <td className="num">{type.lengthMm} mm</td>
              <td className="num">{type.widthMm} mm</td>
              <td className="num">{type.heightMm} mm</td>
              <td className="num">{type.maxWeightKg} kg</td>
              <td className="text-[var(--o-fs-xs)]">{type.drawingRef}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ConfigPage>
  );
}

export function OperationTypesPage() {
  const types = useAppStore((s) => s.data.operationTypes);
  const warehouses = useAppStore((s) => s.data.warehouses);
  const locations = useAppStore((s) => s.data.locations);
  const name = (id?: string) =>
    id ? (locations.find((l) => l.id === id)?.completeName ?? id) : "-";

  return (
    <ConfigPage
      title="Operation Types"
      description="One set per warehouse, mirroring Odoo's picking types. Receipts land in the input area, put-away moves stock into racking, picks stage to output, and delivery orders take it off site."
    >
      <table className="o-list">
        <thead>
          <tr>
            <th>Operation type</th>
            <th>Code</th>
            <th>Warehouse</th>
            <th>Sequence prefix</th>
            <th>Default source</th>
            <th>Default destination</th>
          </tr>
        </thead>
        <tbody>
          {types.map((type) => (
            <tr key={type.id}>
              <td className="font-medium">{type.name}</td>
              <td>{type.code}</td>
              <td>{warehouses.find((w) => w.id === type.warehouseId)?.name}</td>
              <td>{type.sequencePrefix}</td>
              <td>{name(type.defaultSourceId)}</td>
              <td>{name(type.defaultDestId)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ConfigPage>
  );
}

export function OperatorsPage() {
  const operators = useAppStore((s) => s.data.operators);
  return (
    <ConfigPage
      title="Operators"
      description="Warehouse users recorded against operations. Illustrative names for the demonstration - not Ispahani staff records."
    >
      <table className="o-list">
        <thead>
          <tr>
            <th>Name</th>
            <th>Login</th>
            <th>Role</th>
            <th style={{ textAlign: "right" }}>Warehouses</th>
          </tr>
        </thead>
        <tbody>
          {operators.map((operator) => (
            <tr key={operator.id}>
              <td className="font-medium">{operator.name}</td>
              <td>{operator.login}</td>
              <td>
                <Badge tone={operator.role === "manager" ? "brand" : "neutral"}>
                  {operator.role}
                </Badge>
              </td>
              <td className="num">{operator.warehouseIds.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ConfigPage>
  );
}

export function RackProfilesPage() {
  const profiles = useAppStore((s) => s.data.rackProfiles);
  const racks = useAppStore((s) => s.data.racks);
  return (
    <ConfigPage
      title="Rack Profiles"
      description="R1, R2, 4R4 and the rest are rack profiles from the MinMax drawings, not rack names. Every physical rack carries a unique identifier of its own and references one of these profiles."
    >
      <table className="o-list">
        <thead>
          <tr>
            <th>Profile</th>
            <th style={{ textAlign: "right" }}>Bay width</th>
            <th style={{ textAlign: "right" }}>Depth</th>
            <th style={{ textAlign: "right" }}>Height</th>
            <th style={{ textAlign: "right" }}>Load per level</th>
            <th style={{ textAlign: "right" }}>Pallets per bay level</th>
            <th style={{ textAlign: "right" }}>Racks using it</th>
            <th>Drawing</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((profile) => (
            <tr key={profile.code}>
              <td className="font-medium">{profile.code}</td>
              <td className="num">{profile.bayWidthMm} mm</td>
              <td className="num">{profile.depthMm} mm</td>
              <td className="num">{profile.heightMm} mm</td>
              <td className="num">{profile.loadPerLevelKg} kg</td>
              <td className="num">{profile.palletsPerBayLevel}</td>
              <td className="num">
                {formatInt(racks.filter((r) => r.profileCode === profile.code).length)}
              </td>
              <td className="text-[var(--o-fs-xs)]">{profile.drawingRef}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[var(--o-fs-xs)] text-[var(--o-text-muted)]">
        Every pallet position on these drawings is rated 800 kg. A 2300 mm bay
        holds two positions per level; a 1200 mm bay holds one.
      </p>
    </ConfigPage>
  );
}
