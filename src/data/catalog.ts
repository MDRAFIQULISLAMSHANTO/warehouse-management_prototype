/**
 * Master-data catalogue for the demonstration.
 *
 * ILLUSTRATIVE DEMO DATA. Product codes, pallet quantities, garden marks,
 * suppliers, customers and operator names below are plausible stand-ins built
 * for the presentation. They are NOT Ispahani master data and must not be
 * presented as such. In the real project this master data arrives in Odoo from
 * the client, loaded by the partner handling product setup and opening
 * balances (SRS 1.2).
 *
 * Pallet capacities are set per product on purpose: fill percentage must use an
 * explicit product/package capacity, never the 800 kg structural rating of the
 * rack position.
 */

import type {
  Operator,
  PackageType,
  Partner,
  Product,
  ProductCategory,
  StorageCategory,
  Variant,
} from "./types";
import { DRAWING_JOB_2304 } from "./layout";

export const PACKAGE_TYPES: PackageType[] = [
  {
    id: "pkg_euro",
    name: "Pallet 1200 x 1000",
    lengthMm: 1200,
    widthMm: 1000,
    heightMm: 150,
    maxWeightKg: 800,
    drawingRef: `${DRAWING_JOB_2304}, pallet size detail sheet 5`,
  },
  {
    id: "pkg_half",
    name: "Half Pallet 600 x 1000",
    lengthMm: 600,
    widthMm: 1000,
    heightMm: 150,
    maxWeightKg: 400,
    drawingRef: "Prototype assumption - not on the supplied drawings",
  },
];

export const STORAGE_CATEGORIES: StorageCategory[] = [
  {
    id: "sc_rm",
    name: "Raw Material - Tea Chests",
    maxWeightKg: 800,
    allowNewProduct: "same",
    accepts: ["RM"],
    palletCapacity: 1,
  },
  {
    id: "sc_fg",
    name: "Finished Goods - Cartons",
    maxWeightKg: 800,
    allowNewProduct: "same",
    accepts: ["FG"],
    palletCapacity: 1,
  },
  {
    id: "sc_pm",
    name: "Packing Material",
    maxWeightKg: 800,
    allowNewProduct: "mixed",
    accepts: ["PM"],
    palletCapacity: 1,
  },
  {
    id: "sc_mixed",
    name: "General Storage",
    maxWeightKg: 800,
    allowNewProduct: "mixed",
    accepts: ["RM", "FG", "PM"],
    palletCapacity: 1,
  },
];

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    id: "cat_rm_leaf",
    name: "Raw Material / Black Tea - Leaf",
    materialGroup: "RM",
    removalStrategy: "fifo",
  },
  {
    id: "cat_rm_dust",
    name: "Raw Material / Black Tea - Dust",
    materialGroup: "RM",
    removalStrategy: "fifo",
  },
  {
    id: "cat_rm_green",
    name: "Raw Material / Green Tea",
    materialGroup: "RM",
    removalStrategy: "fifo",
  },
  {
    id: "cat_fg_pack",
    name: "Finished Goods / Packet Tea",
    materialGroup: "FG",
    removalStrategy: "fifo",
  },
  {
    id: "cat_fg_bag",
    name: "Finished Goods / Tea Bags",
    materialGroup: "FG",
    removalStrategy: "fifo",
  },
  {
    id: "cat_fg_bulk",
    name: "Finished Goods / Bulk & Trade Pack",
    materialGroup: "FG",
    removalStrategy: "lifo",
  },
  {
    id: "cat_pm_film",
    name: "Packing Material / Films & Laminates",
    materialGroup: "PM",
    removalStrategy: "lifo",
  },
  {
    id: "cat_pm_carton",
    name: "Packing Material / Cartons",
    materialGroup: "PM",
    removalStrategy: "lifo",
  },
  {
    id: "cat_pm_misc",
    name: "Packing Material / Consumables",
    materialGroup: "PM",
    removalStrategy: "least_packages",
  },
];

interface ProductSeed {
  code: string;
  name: string;
  categoryId: string;
  uom: Product["uom"];
  palletCapacityQty: number;
  unitWeightKg: number;
  blendGrade?: string;
  removalStrategy?: Product["removalStrategy"];
  variants?: { code: string; name: string; attrs: Record<string, string>; cap?: number }[];
}

/**
 * Grade abbreviations follow ordinary black-tea trade usage:
 * BOP Broken Orange Pekoe, BOPF BOP Fannings, PD Pekoe Dust, OF Orange
 * Fannings, GBOP Golden BOP, RD Red Dust, CD Churamani Dust.
 */
const PRODUCT_SEEDS: ProductSeed[] = [
  // ---------------------------------------------------------------- RM leaf
  {
    code: "RM-BOP-01",
    name: "Black Tea BOP - Sylhet Selection",
    categoryId: "cat_rm_leaf",
    uom: "kg",
    palletCapacityQty: 800,
    unitWeightKg: 1,
    blendGrade: "BOP",
  },
  {
    code: "RM-BOP-02",
    name: "Black Tea BOP - Moulvibazar Selection",
    categoryId: "cat_rm_leaf",
    uom: "kg",
    palletCapacityQty: 760,
    unitWeightKg: 1,
    blendGrade: "BOP",
  },
  {
    code: "RM-BOPF-01",
    name: "Black Tea BOPF - Standard",
    categoryId: "cat_rm_leaf",
    uom: "kg",
    palletCapacityQty: 720,
    unitWeightKg: 1,
    blendGrade: "BOPF",
  },
  {
    code: "RM-BOPF-02",
    name: "Black Tea BOPF - Premium",
    categoryId: "cat_rm_leaf",
    uom: "kg",
    palletCapacityQty: 720,
    unitWeightKg: 1,
    blendGrade: "BOPF",
  },
  {
    code: "RM-GBOP-01",
    name: "Black Tea GBOP - Estate Mark",
    categoryId: "cat_rm_leaf",
    uom: "kg",
    palletCapacityQty: 680,
    unitWeightKg: 1,
    blendGrade: "GBOP",
  },
  {
    code: "RM-OF-01",
    name: "Black Tea Orange Fannings",
    categoryId: "cat_rm_leaf",
    uom: "kg",
    palletCapacityQty: 750,
    unitWeightKg: 1,
    blendGrade: "OF",
  },
  // ---------------------------------------------------------------- RM dust
  {
    code: "RM-PD-01",
    name: "Black Tea Pekoe Dust - Grade A",
    categoryId: "cat_rm_dust",
    uom: "kg",
    palletCapacityQty: 800,
    unitWeightKg: 1,
    blendGrade: "PD",
  },
  {
    code: "RM-PD-02",
    name: "Black Tea Pekoe Dust - Grade B",
    categoryId: "cat_rm_dust",
    uom: "kg",
    palletCapacityQty: 800,
    unitWeightKg: 1,
    blendGrade: "PD",
  },
  {
    code: "RM-RD-01",
    name: "Black Tea Red Dust",
    categoryId: "cat_rm_dust",
    uom: "kg",
    palletCapacityQty: 780,
    unitWeightKg: 1,
    blendGrade: "RD",
  },
  {
    code: "RM-CD-01",
    name: "Black Tea Churamani Dust",
    categoryId: "cat_rm_dust",
    uom: "kg",
    palletCapacityQty: 780,
    unitWeightKg: 1,
    blendGrade: "CD",
  },
  // --------------------------------------------------------------- RM green
  {
    code: "RM-GT-01",
    name: "Green Tea Leaf - Standard",
    categoryId: "cat_rm_green",
    uom: "kg",
    palletCapacityQty: 600,
    unitWeightKg: 1,
    blendGrade: "GT",
  },
  {
    code: "RM-GT-02",
    name: "Green Tea Fannings",
    categoryId: "cat_rm_green",
    uom: "kg",
    palletCapacityQty: 620,
    unitWeightKg: 1,
    blendGrade: "GT",
  },
  // ------------------------------------------------------------- FG packets
  {
    code: "FG-MIR-BL",
    name: "Mirzapore Best Leaf - Packet Tea",
    categoryId: "cat_fg_pack",
    uom: "cartons",
    palletCapacityQty: 60,
    unitWeightKg: 9.6,
    variants: [
      { code: "100G", name: "100 g x 96", attrs: { "Pack Size": "100 g" }, cap: 64 },
      { code: "200G", name: "200 g x 48", attrs: { "Pack Size": "200 g" }, cap: 60 },
      { code: "400G", name: "400 g x 24", attrs: { "Pack Size": "400 g" }, cap: 56 },
      { code: "500G", name: "500 g x 20", attrs: { "Pack Size": "500 g" }, cap: 52 },
    ],
  },
  {
    code: "FG-BLC",
    name: "Blenders Choice - Packet Tea",
    categoryId: "cat_fg_pack",
    uom: "cartons",
    palletCapacityQty: 60,
    unitWeightKg: 9.6,
    variants: [
      { code: "200G", name: "200 g x 48", attrs: { "Pack Size": "200 g" }, cap: 60 },
      { code: "400G", name: "400 g x 24", attrs: { "Pack Size": "400 g" }, cap: 56 },
    ],
  },
  {
    code: "FG-ZAR",
    name: "Zareen - Packet Tea",
    categoryId: "cat_fg_pack",
    uom: "cartons",
    palletCapacityQty: 64,
    unitWeightKg: 9.0,
    variants: [
      { code: "100G", name: "100 g x 96", attrs: { "Pack Size": "100 g" }, cap: 68 },
      { code: "400G", name: "400 g x 24", attrs: { "Pack Size": "400 g" }, cap: 58 },
    ],
  },
  {
    code: "FG-GT-PK",
    name: "Green Tea - Packet",
    categoryId: "cat_fg_pack",
    uom: "cartons",
    palletCapacityQty: 72,
    unitWeightKg: 6.4,
  },
  // ------------------------------------------------------------ FG tea bags
  {
    code: "FG-TB-MIR",
    name: "Mirzapore Tea Bags",
    categoryId: "cat_fg_bag",
    uom: "cartons",
    palletCapacityQty: 80,
    unitWeightKg: 5.2,
    variants: [
      { code: "25S", name: "25 bags x 48", attrs: { "Bag Count": "25" }, cap: 84 },
      { code: "50S", name: "50 bags x 24", attrs: { "Bag Count": "50" }, cap: 80 },
      { code: "100S", name: "100 bags x 12", attrs: { "Bag Count": "100" }, cap: 76 },
    ],
  },
  {
    code: "FG-TB-GT",
    name: "Green Tea Bags",
    categoryId: "cat_fg_bag",
    uom: "cartons",
    palletCapacityQty: 84,
    unitWeightKg: 4.8,
  },
  // ------------------------------------------------------------- FG bulk
  {
    code: "FG-TRD-05",
    name: "Trade Pack 5 kg",
    categoryId: "cat_fg_bulk",
    uom: "cartons",
    palletCapacityQty: 40,
    unitWeightKg: 15.2,
  },
  {
    code: "FG-TRD-10",
    name: "Trade Pack 10 kg",
    categoryId: "cat_fg_bulk",
    uom: "cartons",
    palletCapacityQty: 32,
    unitWeightKg: 20.4,
  },
  {
    code: "FG-CON-PK",
    name: "Consumer Pack Assortment",
    categoryId: "cat_fg_bulk",
    uom: "cartons",
    palletCapacityQty: 48,
    unitWeightKg: 11.0,
  },
  // ------------------------------------------------------------------- PM
  {
    code: "PM-LAM-01",
    name: "Laminate Film - Printed 100 g",
    categoryId: "cat_pm_film",
    uom: "rolls",
    palletCapacityQty: 24,
    unitWeightKg: 22,
  },
  {
    code: "PM-LAM-02",
    name: "Laminate Film - Printed 400 g",
    categoryId: "cat_pm_film",
    uom: "rolls",
    palletCapacityQty: 20,
    unitWeightKg: 28,
  },
  {
    code: "PM-FIL-PL",
    name: "Plain Poly Film",
    categoryId: "cat_pm_film",
    uom: "rolls",
    palletCapacityQty: 30,
    unitWeightKg: 18,
  },
  {
    code: "PM-CTN-OUT",
    name: "Outer Carton - Standard",
    categoryId: "cat_pm_carton",
    uom: "units",
    palletCapacityQty: 900,
    unitWeightKg: 0.42,
  },
  {
    code: "PM-CTN-DIS",
    name: "Display Carton",
    categoryId: "cat_pm_carton",
    uom: "units",
    palletCapacityQty: 1200,
    unitWeightKg: 0.3,
  },
  {
    code: "PM-TAG-01",
    name: "Tea Bag Tag & String",
    categoryId: "cat_pm_misc",
    uom: "units",
    palletCapacityQty: 2400,
    unitWeightKg: 0.12,
  },
  {
    code: "PM-TAP-01",
    name: "Carton Sealing Tape",
    categoryId: "cat_pm_misc",
    uom: "units",
    palletCapacityQty: 1800,
    unitWeightKg: 0.2,
  },
  {
    code: "PM-FIL-TB",
    name: "Tea Bag Filter Paper",
    categoryId: "cat_pm_misc",
    uom: "rolls",
    palletCapacityQty: 36,
    unitWeightKg: 14,
  },
];

function buildCatalog(): { products: Product[]; variants: Variant[] } {
  const products: Product[] = [];
  const variants: Variant[] = [];

  for (const seed of PRODUCT_SEEDS) {
    const category = PRODUCT_CATEGORIES.find((c) => c.id === seed.categoryId);
    if (!category) throw new Error(`Unknown category ${seed.categoryId}`);

    const productId = `prd_${seed.code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    products.push({
      id: productId,
      code: seed.code,
      name: seed.name,
      categoryId: seed.categoryId,
      materialGroup: category.materialGroup,
      uom: seed.uom,
      palletCapacityQty: seed.palletCapacityQty,
      unitWeightKg: seed.unitWeightKg,
      tracking: "lot",
      removalStrategy: seed.removalStrategy,
      blendGrade: seed.blendGrade,
    });

    if (seed.variants?.length) {
      for (const v of seed.variants) {
        variants.push({
          id: `${productId}__${v.code.toLowerCase()}`,
          productId,
          code: `${seed.code}-${v.code}`,
          name: `${seed.name} (${v.name})`,
          attributes: v.attrs,
          palletCapacityQty: v.cap,
        });
      }
    } else {
      variants.push({
        id: `${productId}__std`,
        productId,
        code: seed.code,
        name: seed.name,
        attributes: { Variant: "Standard" },
      });
    }
  }

  return { products, variants };
}

const catalog = buildCatalog();
export const PRODUCTS = catalog.products;
export const VARIANTS = catalog.variants;

/** Garden / estate marks used to make lot references look like tea lots. */
export const GARDEN_MARKS = [
  "Baraoora",
  "Chandpore",
  "Deundi",
  "Fatikchhari",
  "Halda Valley",
  "Jerin",
  "Karimpur",
  "Lackatoorah",
  "Madhabpur",
  "Nandarani",
  "Patrakhola",
  "Rajnagar",
  "Shamshernagar",
  "Teliapara",
] as const;

export const OPERATORS: Operator[] = [
  { id: "op_1", name: "Arif Hossain", login: "arif.h", warehouseIds: [], role: "operator" },
  { id: "op_2", name: "Nusrat Jahan", login: "nusrat.j", warehouseIds: [], role: "operator" },
  { id: "op_3", name: "Rakib Uddin", login: "rakib.u", warehouseIds: [], role: "operator" },
  { id: "op_4", name: "Farhana Akter", login: "farhana.a", warehouseIds: [], role: "supervisor" },
  { id: "op_5", name: "Tanvir Rahman", login: "tanvir.r", warehouseIds: [], role: "operator" },
  { id: "op_6", name: "Shalina Begum", login: "shalina.b", warehouseIds: [], role: "operator" },
  { id: "op_7", name: "Imran Kabir", login: "imran.k", warehouseIds: [], role: "supervisor" },
  { id: "op_8", name: "Mahmudul Hasan", login: "mahmudul.h", warehouseIds: [], role: "manager" },
];

export const PARTNERS: Partner[] = [
  { id: "pt_s1", name: "Chattogram Tea Auction - Broker A", kind: "supplier", ref: "SUP-001" },
  { id: "pt_s2", name: "Chattogram Tea Auction - Broker B", kind: "supplier", ref: "SUP-002" },
  { id: "pt_s3", name: "Sylhet Estate Direct Purchase", kind: "supplier", ref: "SUP-003" },
  { id: "pt_s4", name: "Moulvibazar Estate Direct Purchase", kind: "supplier", ref: "SUP-004" },
  { id: "pt_s5", name: "Packaging Supplier - Films Ltd", kind: "supplier", ref: "SUP-005" },
  { id: "pt_s6", name: "Packaging Supplier - Carton Works", kind: "supplier", ref: "SUP-006" },
  { id: "pt_c1", name: "Dhaka North Distributor", kind: "customer", ref: "CUS-001" },
  { id: "pt_c2", name: "Dhaka South Distributor", kind: "customer", ref: "CUS-002" },
  { id: "pt_c3", name: "Chattogram Distributor", kind: "customer", ref: "CUS-003" },
  { id: "pt_c4", name: "Sylhet Distributor", kind: "customer", ref: "CUS-004" },
  { id: "pt_c5", name: "Khulna Distributor", kind: "customer", ref: "CUS-005" },
  { id: "pt_c6", name: "Rajshahi Distributor", kind: "customer", ref: "CUS-006" },
  { id: "pt_c7", name: "Modern Trade - Chain Account", kind: "customer", ref: "CUS-007" },
  { id: "pt_c8", name: "Export Order - Consolidator", kind: "customer", ref: "CUS-008" },
];

/** Effective full-pallet quantity for a product/variant pair. */
export function palletCapacityFor(
  product: Product,
  variant?: Variant | null,
): number {
  return variant?.palletCapacityQty ?? product.palletCapacityQty;
}
