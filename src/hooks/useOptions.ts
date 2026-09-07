import { useMemo } from "react";
import { useDerived } from "@/store/appStore";
import type { LabelLookup } from "@/query/describe";
import type { ModelDef, OptionsKey } from "@/query/models";

export interface Option {
  value: string;
  label: string;
}

/**
 * Option lists for relation fields, taken from live data so a selector can
 * never offer a warehouse or lot that does not exist.
 */
export function useFieldOptions(key: OptionsKey | undefined): Option[] {
  const derived = useDerived();

  return useMemo(() => {
    if (!key) return [];
    const index = derived.index;

    switch (key) {
      case "warehouse":
        return derived.warehouses.map((w) => ({
          value: w.id,
          label: `${w.code} - ${w.name}`,
        }));
      case "aisle":
        return Array.from(index.aisleById.values())
          .map((a) => ({
            value: a.id,
            label: `${index.warehouseById.get(a.warehouseId)?.code ?? ""} / ${a.code}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
      case "rack":
        return derived.racks
          .map((r) => ({ value: r.id, label: r.code }))
          .sort((a, b) => a.label.localeCompare(b.label));
      case "cell":
        // Cells are far too numerous for a plain dropdown; the selector filters
        // as the user types and only ever renders a slice.
        return derived.cells.map((c) => ({
          value: c.id,
          label: c.completeName,
        }));
      case "product":
        return derived.products
          .map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))
          .sort((a, b) => a.label.localeCompare(b.label));
      case "variant":
        return Array.from(index.variantById.values())
          .map((v) => ({ value: v.id, label: v.name }))
          .sort((a, b) => a.label.localeCompare(b.label));
      case "lot":
        return derived.lots
          .map((l) => ({ value: l.id, label: `${l.name} - ${l.productName}` }))
          .sort((a, b) => a.label.localeCompare(b.label));
      case "pallet":
        return derived.pallets.map((p) => ({ value: p.id, label: p.name }));
      case "category":
        return Array.from(index.categoryById.values())
          .map((c) => ({ value: c.id, label: c.name }))
          .sort((a, b) => a.label.localeCompare(b.label));
      case "operator":
        return Array.from(index.operatorById.values()).map((o) => ({
          value: o.id,
          label: o.name,
        }));
      case "partner":
        return Array.from(index.partnerById.values())
          .map((p) => ({ value: p.id, label: p.name }))
          .sort((a, b) => a.label.localeCompare(b.label));
      case "storageCategory":
      case "packageType":
      case "operationType":
      default:
        return [];
    }
  }, [key, derived]);
}

/** Label lookup for a single option value. */
export function useOptionLabel(
  key: OptionsKey | undefined,
  value: string | undefined,
): string {
  const options = useFieldOptions(key);
  if (!value) return "";
  return options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Resolve relation ids to readable names when describing a domain, so a facet
 * reads "Warehouse = RTW2 - Raw Tea Warehouse-2" rather than "wh_rtw2".
 */
export function useDomainLookup(model: ModelDef): LabelLookup {
  const derived = useDerived();

  return useMemo(() => {
    const index = derived.index;
    const byId = new Map<string, string>();

    const put = (id: string, label: string) => {
      if (!byId.has(id)) byId.set(id, label);
    };

    for (const w of derived.warehouses) put(w.id, `${w.code} - ${w.name}`);
    for (const r of derived.racks) put(r.id, r.code);
    for (const p of derived.products) put(p.id, `${p.code} - ${p.name}`);
    for (const l of derived.lots) put(l.id, l.name);
    for (const a of index.aisleById.values()) {
      put(a.id, `${index.warehouseById.get(a.warehouseId)?.code ?? ""} / ${a.code}`);
    }
    for (const v of index.variantById.values()) put(v.id, v.name);
    for (const c of index.categoryById.values()) put(c.id, c.name);
    for (const o of index.operatorById.values()) put(o.id, o.name);
    for (const p of index.partnerById.values()) put(p.id, p.name);
    for (const p of index.palletById.values()) put(p.id, p.name);
    for (const l of index.locationById.values()) put(l.id, l.completeName);

    return (fieldName: string, value: string) => {
      const field = model.fields.find((f) => f.name === fieldName);
      if (field?.options) {
        const match = field.options.find((o) => o.value === value);
        if (match) return match.label;
      }
      return byId.get(value) ?? value;
    };
  }, [derived, model]);
}
