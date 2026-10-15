// Utkast-modell for kalkulatoren og hvordan den bygges fra katalogen.
import type { AdjustmentMode, CalcCatalog, CalcInput, CalcMountRate, CalcProduct, CalcWorkType, LineKind, MarkupGroup } from "@/lib/calcApi";

export interface QuoteLine {
  id: string;
  kind: LineKind;
  name: string;
  /** Leverandør, taktype eller "Avtalt arbeidspris" */
  detail: string;
  productKind?: string;
  quantity: string;
  unit: string;
  /** Kroner per enhet, som tekst (kan ha komma) */
  baseUnit: string;
  markupPercent: string;
  priceMode: "auto" | "fixed";
  fixedSale: string;
  reductionEligible: boolean;
  sourceId?: string;
  edited?: boolean;
}

export interface Adjustment {
  mode: AdjustmentMode;
  value: string;
}

export interface QuoteDraft {
  projectName: string;
  customerType: "private" | "business";
  roofTypeId: string;
  lines: QuoteLine[];
  commission: Adjustment;
  reduction: Adjustment;
  vatPercent: string;
  supportAmount: string;
}

export type Scenario = "solar" | "battery" | "other";

const newId = () => crypto.randomUUID();
const kr = (ore: number | null | undefined) => (ore == null ? "" : String(ore / 100));
const pct = (n: number | null | undefined) => (n == null ? "" : String(n));

export function markupGroupOf(catalog: CalcCatalog, product: CalcProduct): MarkupGroup | undefined {
  return catalog.categories.find((c) => c.id === product.categoryId)?.markupGroup;
}

export function productKindOf(catalog: CalcCatalog, product: CalcProduct) {
  return catalog.categories.find((c) => c.id === product.categoryId)?.productKind;
}

export function productLine(catalog: CalcCatalog, product: CalcProduct, quantity = 1): QuoteLine {
  const group = markupGroupOf(catalog, product);
  return {
    id: newId(),
    kind: "product",
    name: product.name,
    detail: product.supplierName,
    productKind: productKindOf(catalog, product),
    quantity: String(quantity),
    unit: product.unit,
    baseUnit: kr(product.priceOre),
    markupPercent: pct(group ? catalog.markups[group] : null),
    priceMode: "auto",
    fixedSale: "",
    reductionEligible: false,
    sourceId: product.id,
  };
}

export function mountLine(catalog: CalcCatalog, mount: CalcMountRate, quantity: number): QuoteLine {
  return {
    id: newId(),
    kind: "mount",
    name: `Montering · ${mount.roofTypeName}`,
    detail: mount.roofTypeName,
    quantity: String(quantity),
    unit: "panel",
    baseUnit: kr(mount.priceOre),
    markupPercent: pct(catalog.markups.montering),
    priceMode: "auto",
    fixedSale: "",
    reductionEligible: true,
    sourceId: mount.roofTypeId,
  };
}

export function workLine(catalog: CalcCatalog, work: CalcWorkType, quantity = 1): QuoteLine {
  return {
    id: newId(),
    kind: "work",
    name: work.name,
    detail: "Avtalt arbeidspris",
    quantity: String(quantity),
    unit: work.unit,
    baseUnit: kr(work.priceOre),
    markupPercent: pct(catalog.markups.elektro),
    priceMode: "auto",
    fixedSale: "",
    reductionEligible: false,
    sourceId: work.id,
  };
}

export function customLine(catalog: CalcCatalog, kind: LineKind): QuoteLine {
  const markup = kind === "work" ? catalog.markups.elektro : kind === "mount" ? catalog.markups.montering : catalog.markups.solcellemateriell;
  return {
    id: newId(),
    kind,
    name: "",
    detail: "Egendefinert",
    quantity: "1",
    unit: "stk",
    baseUnit: "0",
    markupPercent: pct(markup),
    priceMode: "auto",
    fixedSale: "",
    reductionEligible: kind === "mount",
    edited: true,
  };
}

// Standard solcelleoppsett fra prototypen (LYN-referansen). Hoppes over hvis produktene er borte.
const DEFAULT_PANEL = "17d47b70-dd41-4e8d-8c28-4e9d12cc26d6";
const DEFAULT_INVERTER = "157158c5-6142-4846-ac81-2dfe6cf4463d";
const DEFAULT_EXTRAS = [
  "1557c4ef-2e78-41ef-904c-8113d8ba76cd", // stillas
  "9527d041-bf67-4e6c-afc3-4662f88f9441", // frakt standardpall
  "f2ef8635-112e-4e32-bb7a-1151a0ccda45", // frakt europall
];
const DEFAULT_ROOF_NAME = "Takstein (Dobbelkrummet)";

export function defaultRoofTypeId(catalog: CalcCatalog) {
  const priced = catalog.mountRates.filter((m) => m.priceOre != null);
  return (priced.find((m) => m.roofTypeName === DEFAULT_ROOF_NAME) ?? priced[0])?.roofTypeId ?? "";
}

export function newDraft(catalog: CalcCatalog, scenario: Scenario, panels = 36, roofTypeId = defaultRoofTypeId(catalog)): QuoteDraft {
  const draft: QuoteDraft = {
    projectName: scenario === "solar" ? "Nytt solcelleanlegg" : scenario === "battery" ? "Nytt batteritilbud" : "Ny kalkyle",
    customerType: "private",
    roofTypeId,
    lines: [],
    commission: { mode: "auto", value: "" },
    reduction: { mode: "auto", value: "" },
    vatPercent: String(catalog.settings.vatPercent),
    supportAmount: "0",
  };
  if (scenario !== "solar") return draft;

  const byId = (id: string) => catalog.products.find((p) => p.id === id);
  const panel = byId(DEFAULT_PANEL) ?? catalog.products.find((p) => productKindOf(catalog, p) === "panel");
  if (panel) draft.lines.push(productLine(catalog, panel, panels));

  const mount = catalog.mountRates.find((m) => m.roofTypeId === roofTypeId && m.priceOre != null);
  const kit = mount?.productId ? byId(mount.productId) : undefined;
  if (kit) draft.lines.push(productLine(catalog, kit, panels));

  const inverter = byId(DEFAULT_INVERTER);
  if (inverter) draft.lines.push(productLine(catalog, inverter));
  for (const id of DEFAULT_EXTRAS) {
    const p = byId(id);
    if (p) draft.lines.push(productLine(catalog, p));
  }
  if (mount) draft.lines.push(mountLine(catalog, mount, panels));

  catalog.workTypes
    .filter((w) => (w.group === "søknad" || w.group === "solcelleanlegg") && w.priceOre != null)
    .forEach((w) => draft.lines.push(workLine(catalog, w)));
  return draft;
}

export function panelCountOf(lines: QuoteLine[]) {
  return lines.filter((l) => l.productKind === "panel").reduce((sum, l) => sum + Number(l.quantity.replace(",", ".")), 0);
}

export function toEngineInput(catalog: CalcCatalog, draft: QuoteDraft): CalcInput {
  const adj = (a: Adjustment) => (a.mode === "auto" ? { mode: a.mode } : { mode: a.mode, value: a.value });
  return {
    currency: "NOK",
    panelCount: panelCountOf(draft.lines),
    lines: draft.lines.map((l) => ({
      id: l.id,
      name: l.name,
      kind: l.kind,
      productKind: l.productKind,
      quantity: l.quantity,
      unit: l.unit,
      baseUnit: l.baseUnit,
      markupPercent: l.markupPercent,
      priceMode: l.priceMode,
      fixedSale: l.priceMode === "fixed" ? l.fixedSale : undefined,
      reductionEligible: l.reductionEligible,
      meta: l.sourceId ? { sourceId: l.sourceId } : undefined,
    })),
    commission: adj(draft.commission),
    commissionTiers: catalog.commissionTiers,
    noPanelCommissionPercent: catalog.settings.noPanelCommissionPercent,
    reduction: adj(draft.reduction),
    reductionTiers: catalog.volumeTiers,
    vatPercent: draft.vatPercent,
    supportAmount: draft.supportAmount || "0",
  };
}
