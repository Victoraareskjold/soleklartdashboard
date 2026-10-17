// Utkast-modell for kalkulatoren, og reglene som gjelder inne i kalkulatoren:
// kWp fra panellinjene, mengder som følger panelantallet, invertervalg (nett, størrelse; stringinverter i grunnpakken).
// Prisregning skjer i kalkulator-API-et; her bygges bare utkastet.
import type {
  AdjustmentMode,
  CalcCatalog,
  CalcMountRate,
  CalcProduct,
  CalcWorkType,
  LineKind,
  ProductKind,
  ProductSpecs,
  BatteryOfferConfig,
} from "@/lib/calcApi";

export interface QuoteLine {
  id: string;
  kind: LineKind;
  name: string;
  /** Leverandør, taktype eller "Avtalt arbeidspris" */
  detail: string;
  productKind?: ProductKind;
  quantity: string;
  unit: string;
  /** Kroner per enhet eks. mva. (innkjøp / avtalt sats), som tekst */
  baseUnit: string;
  markupPercent: string;
  priceMode: "auto" | "fixed";
  fixedSale: string;
  reductionEligible: boolean;
  /** Med i grunnlaget for solcellestøtte. undefined = katalogens standard */
  supportEligible?: boolean;
  sourceId?: string;
  edited?: boolean;
}

export interface Adjustment {
  mode: AdjustmentMode;
  value: string;
}

export type Grid = "230" | "400";

export interface SupportChoice {
  /** auto = etter sentrale regler (privat), off = ingen, manual = eget anslag */
  mode: "auto" | "off" | "manual";
  amount: string;
  provider: string;
}

export interface QuoteDraft {
  projectName: string;
  customerType: "private" | "business";
  roofTypeId: string;
  grid: Grid;
  /** auto = kalkulatoren velger inverter, manual = brukeren har valgt selv */
  inverterMode: "auto" | "manual";
  /** Batteri og hybrid som tillegg i tilbudet (bare på estimat). Regnes i kalkulatortjenesten. */
  batteryOffer?: BatteryOfferConfig;
  lines: QuoteLine[];
  commission: Adjustment;
  reduction: Adjustment;
  vatPercent: string;
  support: SupportChoice;
}

export type Scenario = "solar" | "battery" | "other";

const newId = () => crypto.randomUUID();
const kr = (ore: number | null | undefined) => (ore == null ? "" : String(ore / 100));
const pct = (n: number | null | undefined) => (n == null ? "" : String(n));
const num = (text: string) => Number(String(text).replace(",", "."));

// --- Katalogoppslag ---

export const categoryOf = (catalog: CalcCatalog, product: CalcProduct) => catalog.categories.find((c) => c.id === product.categoryId);

/** Hovedkategorien (regler og bytte av produkt skjer innen hovedkategorien) */
export function topCategoryOf(catalog: CalcCatalog, product: CalcProduct) {
  const c = categoryOf(catalog, product);
  return c?.parentId ? catalog.categories.find((x) => x.id === c.parentId) : c;
}

export const productById = (catalog: CalcCatalog, id?: string) => (id ? catalog.products.find((p) => p.id === id) : undefined);
export const specsOf = (catalog: CalcCatalog, line: QuoteLine): ProductSpecs =>
  (line.kind === "product" && productById(catalog, line.sourceId)?.specs) || {};

/** Aktive produkter i samme hovedkategori, til «Bytt produkt». */
export function alternativesFor(catalog: CalcCatalog, line: QuoteLine) {
  const current = productById(catalog, line.sourceId);
  if (!current) return [];
  const top = topCategoryOf(catalog, current)?.id;
  return catalog.products.filter((p) => (p.active || p.id === current.id) && topCategoryOf(catalog, p)?.id === top);
}

// --- Linjer ---

export function productLine(catalog: CalcCatalog, product: CalcProduct, quantity = 1): QuoteLine {
  const group = categoryOf(catalog, product)?.markupGroup;
  return {
    id: newId(),
    kind: "product",
    name: product.name,
    detail: product.supplierName,
    productKind: categoryOf(catalog, product)?.productKind,
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

/** Bytter produkt på en linje, men beholder mengden. Pris og påslag hentes fra katalogen. */
export function swapProduct(catalog: CalcCatalog, line: QuoteLine, product: CalcProduct): QuoteLine {
  return { ...productLine(catalog, product, num(line.quantity) || 1), id: line.id, quantity: line.quantity };
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
    supportEligible: false,
    edited: true,
  };
}

/** Oppdaterer pris og påslag fra gjeldende katalog på linjer som ikke er justert for hånd. */
export function refreshPrices(catalog: CalcCatalog, draft: QuoteDraft): { draft: QuoteDraft; changed: number } {
  let changed = 0;
  const lines = draft.lines.map((l) => {
    if (l.edited || !l.sourceId) return l;
    let fresh: QuoteLine | undefined;
    if (l.kind === "product") {
      const p = productById(catalog, l.sourceId);
      if (p) fresh = productLine(catalog, p);
    } else if (l.kind === "mount") {
      const m = catalog.mountRates.find((x) => x.roofTypeId === l.sourceId && x.priceOre != null);
      if (m) fresh = mountLine(catalog, m, 1);
    } else {
      const w = catalog.workTypes.find((x) => x.id === l.sourceId);
      if (w) fresh = workLine(catalog, w);
    }
    if (!fresh || (fresh.baseUnit === l.baseUnit && fresh.markupPercent === l.markupPercent)) return l;
    changed++;
    return { ...l, baseUnit: fresh.baseUnit, markupPercent: fresh.markupPercent };
  });
  return { draft: { ...draft, lines }, changed };
}

// --- Anlegg: paneler og kWp ---

export function panelCountOf(lines: QuoteLine[]) {
  return lines.filter((l) => l.productKind === "panel").reduce((sum, l) => sum + num(l.quantity), 0);
}

/** Anleggseffekt = Σ paneler × Wp / 1000. null hvis et panel mangler effekt i produktdata. */
export function kwpOf(catalog: CalcCatalog, lines: QuoteLine[]): number | null {
  const panels = lines.filter((l) => l.productKind === "panel");
  if (!panels.length) return 0;
  let total = 0;
  for (const l of panels) {
    const wp = specsOf(catalog, l).wp;
    if (!wp) return null;
    total += (num(l.quantity) * wp) / 1000;
  }
  return Math.round(total * 1000) / 1000;
}

/** Linjer som skal følge panelantallet: montering og kategorier med mengderegel «per panel». */
export function followsPanels(catalog: CalcCatalog, line: QuoteLine) {
  if (line.kind === "mount") return true;
  const p = line.kind === "product" ? productById(catalog, line.sourceId) : undefined;
  return !!p && categoryOf(catalog, p)?.quantityRule === "per_panel";
}

export function setPanelCount(catalog: CalcCatalog, draft: QuoteDraft, panels: number): QuoteDraft {
  return {
    ...draft,
    lines: draft.lines.map((l) => (l.productKind === "panel" || followsPanels(catalog, l) ? { ...l, quantity: String(panels) } : l)),
  };
}

// --- Inverter ---
//
// Grunnpakken bruker alltid en vanlig stringinverter. Hybridinverter velges bare manuelt i
// grunnpakken; ellers tilbys den som tillegg i batteriseksjonen (regnes i kalkulatortjenesten).

export interface InverterNeed {
  kwp: number;
  targetKw: number;
  grid: Grid;
}

export function inverterNeed(catalog: CalcCatalog, draft: QuoteDraft): InverterNeed | null {
  const kwp = kwpOf(catalog, draft.lines);
  if (!kwp) return null;
  return {
    kwp,
    targetKw: Math.round((kwp / (catalog.settings.inverterSizingFactor || 1.2)) * 100) / 100,
    grid: draft.grid,
  };
}

/** Passer inverteren nettet og anleggets PV-effekt? (Størrelse mot måleffekt vurderes separat.) */
export function inverterFits(product: CalcProduct, need: Pick<InverterNeed, "grid" | "kwp">) {
  const s = product.specs;
  if (!s.acKw || !s.grid) return false;
  if (s.grid !== "begge" && s.grid !== need.grid) return false;
  if (s.maxPvKwp && need.kwp > s.maxPvKwp) return false;
  return true;
}

export const inverters = (catalog: CalcCatalog) => catalog.products.filter((p) => p.active && categoryOf(catalog, p)?.productKind === "inverter");

/**
 * Forslag til grunnpakken: rimeligste vanlige 3-fase stringinverter for riktig nett med
 * AC-effekt ≥ kWp / dimensjoneringsfaktor (og høyst det doble, så den ikke blir urimelig stor).
 * Teknisk egnethet først, deretter innkjøpspris; lik pris → minst.
 */
export function suggestInverter(catalog: CalcCatalog, need: InverterNeed): CalcProduct | null {
  const candidates = inverters(catalog).filter((p) => {
    const ac = p.specs.acKw ?? 0;
    return inverterFits(p, need) && !p.specs.hybrid && p.specs.phases !== 1 && ac >= need.targetKw && ac <= need.targetKw * 2;
  });
  candidates.sort((a, b) => a.priceOre - b.priceOre || (a.specs.acKw ?? 0) - (b.specs.acKw ?? 0));
  return candidates[0] ?? null;
}

export interface InverterGroup {
  label: string;
  items: { product: CalcProduct; fits: boolean; sized: boolean }[];
}

/**
 * Alle aktive invertere til manuelt valg, gruppert etter leverandør og type (string/hybrid).
 * fits = passer nett og PV-effekt, sized = AC-effekt ≥ måleffekt. Sortert: egnet først, så pris.
 */
export function inverterGroups(catalog: CalcCatalog, need: InverterNeed | null, grid: Grid, query = ""): InverterGroup[] {
  const q = query.trim().toLowerCase();
  const groups = new Map<string, InverterGroup["items"]>();
  for (const p of inverters(catalog)) {
    const s = p.specs;
    const type = s.hybrid ? `Hybrid${s.batteryClass ? ` ${s.batteryClass}` : ""}` : "String";
    const hay = `${p.name} ${p.supplierName} ${type} ${s.acKw ?? ""}`.toLowerCase();
    if (q && !q.split(/\s+/).every((w) => hay.includes(w))) continue;
    const fits = inverterFits(p, { grid, kwp: need?.kwp ?? 0 });
    const sized = !need || (s.acKw ?? 0) >= need.targetKw;
    const label = `${p.supplierName || "Uten leverandør"} · ${type}`;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push({ product: p, fits, sized });
  }
  const rank = (i: InverterGroup["items"][number]) => (i.fits && i.sized ? 0 : i.fits ? 1 : 2);
  return [...groups.entries()]
    .map(([label, items]) => ({
      label,
      items: items.sort((a, b) => rank(a) - rank(b) || (a.product.specs.acKw ?? 0) - (b.product.specs.acKw ?? 0) || a.product.priceOre - b.product.priceOre),
    }))
    .sort((a, b) => Math.min(...a.items.map(rank)) - Math.min(...b.items.map(rank)) || a.label.localeCompare(b.label, "nb"));
}

export interface RuleResult {
  draft: QuoteDraft;
  /** Melding til brukeren om noe kalkulatoren endret eller ikke fant */
  notice: string | null;
}

/**
 * Holder inverteren i grunnpakken i samsvar med anlegget:
 *  - automatisk modus: inverteren følger forslaget (rimeligste egnede stringinverter)
 *  - manuelt valg (også hybrid) beholdes så lenge det passer nett og PV-effekt
 */
export function applyRules(catalog: CalcCatalog, input: QuoteDraft): RuleResult {
  let draft = input;
  const notes: string[] = [];

  const need = inverterNeed(catalog, draft);
  if (!need) return { draft, notice: null };

  const index = draft.lines.findIndex((l) => l.productKind === "inverter");
  const current = index >= 0 ? productById(catalog, draft.lines[index].sourceId) : undefined;
  const suggestion = suggestInverter(catalog, need);
  const currentFits = current ? inverterFits(current, need) : false;

  const replaceWith = (product: CalcProduct, why: string) => {
    const lines = [...draft.lines];
    if (index >= 0) lines[index] = swapProduct(catalog, lines[index], product);
    else lines.splice(Math.max(1, lines.findIndex((l) => l.productKind === "feste") + 1), 0, productLine(catalog, product));
    draft = { ...draft, lines };
    notes.push(why);
  };

  if (draft.inverterMode === "manual" && current && currentFits) {
    // Behold brukerens valg
  } else if (suggestion && suggestion.id !== current?.id) {
    const reason =
      draft.inverterMode === "manual" && current
        ? `${current.name} passer ikke ${need.grid} V-nettet eller anleggets ${need.kwp.toLocaleString("nb-NO")} kWp. Byttet til ${suggestion.name}.`
        : current
          ? `Inverter oppdatert til ${suggestion.name} (${need.kwp.toLocaleString("nb-NO")} kWp ÷ ${catalog.settings.inverterSizingFactor.toLocaleString("nb-NO")} = ${need.targetKw.toLocaleString("nb-NO")} kW, rimeligste egnede).`
          : `Inverter lagt til: ${suggestion.name}.`;
    replaceWith(suggestion, reason);
    if (draft.inverterMode === "manual") draft = { ...draft, inverterMode: "auto" };
  } else if (!suggestion && (!current || !currentFits)) {
    notes.push(
      `Ingen egnet stringinverter for ${need.grid} V på minst ${need.targetKw.toLocaleString("nb-NO")} kW i katalogen. Velg inverter manuelt.`,
    );
  }

  return { draft, notice: notes.join(" ") || null };
}

// --- Nytt utkast ---

const DEFAULT_PANEL = "17d47b70-dd41-4e8d-8c28-4e9d12cc26d6";
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

export function emptyDraft(catalog: CalcCatalog, name: string, roofTypeId = defaultRoofTypeId(catalog), grid: Grid = "230"): QuoteDraft {
  return {
    projectName: name,
    customerType: "private",
    roofTypeId,
    grid,
    inverterMode: "auto",
    lines: [],
    commission: { mode: "auto", value: "" },
    reduction: { mode: "auto", value: "" },
    vatPercent: String(catalog.settings.vatPercent),
    support: { mode: "auto", amount: "0", provider: "" },
  };
}

export function newDraft(
  catalog: CalcCatalog,
  scenario: Scenario,
  panels = 36,
  roofTypeId = defaultRoofTypeId(catalog),
  grid: Grid = "230",
): QuoteDraft {
  const draft = emptyDraft(
    catalog,
    scenario === "solar" ? "Nytt solcelleanlegg" : scenario === "battery" ? "Nytt batteritilbud" : "Ny kalkyle",
    roofTypeId,
    grid,
  );
  if (scenario !== "solar") return draft;

  const active = (id: string) => catalog.products.find((p) => p.id === id && p.active);
  const panel = active(DEFAULT_PANEL) ?? catalog.products.find((p) => p.active && categoryOf(catalog, p)?.productKind === "panel");
  if (panel) draft.lines.push(productLine(catalog, panel, panels));

  const mount = catalog.mountRates.find((m) => m.roofTypeId === roofTypeId && m.priceOre != null);
  const kit = mount?.productId ? catalog.products.find((p) => p.id === mount.productId) : undefined;
  if (kit) draft.lines.push(productLine(catalog, kit, panels));

  for (const id of DEFAULT_EXTRAS) {
    const p = active(id);
    if (p) draft.lines.push(productLine(catalog, p));
  }
  if (mount) draft.lines.push(mountLine(catalog, mount, panels));

  catalog.workTypes
    .filter((w) => w.active && (w.group === "søknad" || w.group === "solcelleanlegg") && w.priceOre != null)
    .forEach((w) => draft.lines.push(workLine(catalog, w)));

  // Inverter etter forslag (nett, størrelse, pris)
  return applyRules(catalog, draft).draft;
}

/** Utkast lagret før denne versjonen mangler nye felt. */
export function normalizeDraft(catalog: CalcCatalog, raw: unknown): QuoteDraft {
  const d = (raw ?? {}) as Partial<QuoteDraft> & { supportAmount?: string };
  const base = emptyDraft(catalog, d.projectName ?? "Kalkyle", d.roofTypeId);
  return {
    ...base,
    ...d,
    lines: d.lines ?? [],
    support: d.support ?? { mode: Number(d.supportAmount ?? 0) > 0 ? "manual" : "auto", amount: d.supportAmount ?? "0", provider: "" },
  } as QuoteDraft;
}
