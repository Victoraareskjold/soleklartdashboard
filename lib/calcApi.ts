// Klient for den nye kalkulatortjenesten (soleklart-kalkulator).
// Bruker samme Supabase-innlogging som resten av dashboardet.
import { getToken } from "./api";

const CALC_API_URL = process.env.NEXT_PUBLIC_CALC_API_URL ?? "http://localhost:4100";

async function calcRequest<T>(path: string, method = "GET", body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${CALC_API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Kalkulator-API svarte ${res.status}`);
  return data as T;
}

/** Kode for påslagsgruppe, f.eks. "solcellemateriell" eller "dc-ladere". Gruppene ligger i catalog.markupGroups. */
export type MarkupGroup = string;

export interface CalcMarkupGroup {
  code: string;
  name: string;
  sortOrder: number;
}

/** Rolle i beregningen. panel teller i kWp/panelantall, inverter velges automatisk, batteri krever hybrid. */
export type ProductKind = "panel" | "feste" | "inverter" | "batteri" | "frakt" | "stillase" | "ballastein" | "annet";

/** Tekniske produktdata. derived = hentet fra produktnavnet ved import og ikke kontrollert ennå. */
export interface ProductSpecs {
  wp?: number;
  acKw?: number;
  maxPvKwp?: number;
  grid?: "230" | "400" | "begge";
  phases?: 1 | 3;
  hybrid?: boolean;
  batteryClass?: "HV" | "LV";
  capacityKwh?: number;
  powerKw?: number;
  /** Batteri: BMS/base-produkt som hører til modulen */
  bmsProductId?: string | null;
  /** Batteri: moduler per BMS/base, og min/maks moduler kunden kan velge */
  modulesPerBase?: number;
  minModules?: number;
  maxModules?: number;
  /** Dette produktet er en BMS/base (ikke et batteri kunden velger) */
  bms?: boolean;
  derived?: boolean;
  [key: string]: unknown;
}

export interface CalcInstaller {
  id: string;
  name: string;
  teamId: string;
}

export interface CalcCategory {
  id: string;
  parentId: string | null;
  name: string;
  productKind: ProductKind;
  markupGroup: MarkupGroup;
  /** per_panel = mengden følger panelantallet */
  quantityRule: "manual" | "per_panel";
  /** Regnes med i grunnlaget for solcellestøtte */
  supportEligible: boolean;
  sortOrder: number;
}

export interface CalcProduct {
  id: string;
  name: string;
  unit: string;
  priceOre: number;
  priceUpdatedAt: string;
  attachmentUrl: string | null;
  specs: ProductSpecs;
  categoryId: string;
  /** false = skjult fra nye kalkyler */
  active: boolean;
  supplierId: string;
  supplierName: string;
}

export interface CalcWorkType {
  id: string;
  group: "søknad" | "solcelleanlegg" | "batteri" | "tillegg";
  name: string;
  unit: string;
  unitConfirmed: boolean;
  active: boolean;
  supportEligible: boolean;
  priceOre: number | null; // null = ingen avtalt sats for installatøren
}

/** Én rad per taktype. priceOre null = ikke avtalt for installatøren. */
export interface CalcMountRate {
  roofTypeId: string;
  roofTypeName: string;
  productId: string | null;
  productName: string | null;
  priceOre: number | null;
}

export interface CalcTier {
  min: number;
  max: number | null;
  percent: number;
}

export interface CalcSupplier {
  id: string;
  name: string;
  active: boolean;
}

export interface CalcSettings {
  /** Standard batteritype på batterisiden av tilbudet */
  defaultBatteryClass: "HV" | "LV";
  /** kWp PV en hybridinverter tåler per kW AC når maks PV ikke er oppgitt */
  hybridDcRatio: number;
  /** Standardverdier for økonomien i nye tilbud */
  economy: {
    private: { elPrice: number; netPrice: number };
    business: { elPrice: number; netPrice: number };
    priceGrowthPercent: number;
  };
  noPanelCommissionPercent: number;
  vatPercent: number;
  /** Måleffekt for inverter = kWp / faktor */
  inverterSizingFactor: number;
  supportName: string;
  supportEnabled: boolean;
  supportPercent: number;
  supportPerKwpOre: number;
  supportMaxKwp: number;
  supportMaxOre: number;
  mountSupportEligible: boolean;
}

export interface CalcCatalog {
  installer: { id: string; name: string };
  teamId: string;
  /** Om brukeren er admin og kan endre priser. */
  canEdit: boolean;
  markupGroups: CalcMarkupGroup[];
  suppliers: CalcSupplier[];
  categories: CalcCategory[];
  products: CalcProduct[];
  markups: Partial<Record<MarkupGroup, number>>;
  workTypes: CalcWorkType[];
  mountRates: CalcMountRate[];
  volumeTiers: CalcTier[];
  commissionTiers: CalcTier[];
  settings: CalcSettings;
}

export const getCalcInstallers = () =>
  calcRequest<{ installers: CalcInstaller[] }>("/api/installers").then((r) => r.installers);

export const getCalcCatalog = (installerGroupId: string) =>
  calcRequest<CalcCatalog>(`/api/catalog?installerGroupId=${encodeURIComponent(installerGroupId)}`);

export const formatOre = (ore: number | null | undefined) =>
  ore == null
    ? "—"
    : `${(ore / 100).toLocaleString("nb-NO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr`;

// --- Endringer (kun admin). Beløp sendes som kroner, f.eks. "1234,50". ---

type Kroner = string | number;
const put = (path: string, body: unknown) => calcRequest<{ ok: true }>(path, "PUT", body);
const patch = (path: string, body: unknown) => calcRequest<{ ok: true }>(path, "PATCH", body);
const inst = (id: string) => `/api/installers/${encodeURIComponent(id)}`;

export const setMarkup = (installerId: string, markupGroup: MarkupGroup, percent: number | null) =>
  put(`${inst(installerId)}/markups`, { markupGroup, percent });

export const setWorkRate = (installerId: string, workTypeId: string, price: Kroner | null) =>
  put(`${inst(installerId)}/work-rates`, { workTypeId, price });

export const setMountRate = (installerId: string, roofTypeId: string, productId: string | null, price: Kroner | null) =>
  put(`${inst(installerId)}/mount-rates`, { roofTypeId, productId, price });

export const setVolumeTiers = (installerId: string, tiers: CalcTier[]) =>
  put(`${inst(installerId)}/volume-tiers`, { tiers });

// --- Panelvalg i solkartet (pvmap, public.solarpanels) ---

export const MAP_PANEL_STEPS = ["0-72", "72-150", "150-300", "300-600", "600-1000", "1000+"] as const;
export type MapPanelStep = (typeof MAP_PANEL_STEPS)[number];

export interface MapPanel {
  id: string;
  name: string;
  watt: number;
  description: string | null;
  /** Kroner per panel etter antall paneler */
  prices: Record<MapPanelStep, number>;
}

export const getMapPanels = () => calcRequest<{ panels: MapPanel[] }>("/api/map-panels").then((r) => r.panels);

export const updateMapPanel = (id: string, body: Partial<{ name: string; watt: number; description: string | null; prices: Partial<Record<MapPanelStep, number>> }>) =>
  calcRequest<MapPanel>(`/api/map-panels/${encodeURIComponent(id)}`, "PATCH", body);

/** Sentrale regler. Bare feltene som sendes, endres. Kroner for beløp. */
export const updateSettings = (body: Partial<{
  commissionTiers: CalcTier[];
  noPanelCommissionPercent: number;
  vatPercent: number;
  inverterSizingFactor: number;
  supportName: string;
  supportEnabled: boolean;
  supportPercent: number;
  supportPerKwp: number;
  supportMaxKwp: number;
  supportMax: number;
  mountSupportEligible: boolean;
  defaultBatteryClass: "HV" | "LV";
  hybridDcRatio: number;
  economyElPricePrivate: number;
  economyNetPricePrivate: number;
  economyElPriceBusiness: number;
  economyNetPriceBusiness: number;
  economyPriceGrowthPercent: number;
}>) => put("/api/settings", body);

export const createSupplier = (name: string) => calcRequest<{ id: string; name: string }>("/api/suppliers", "POST", { name });
export const updateSupplier = (id: string, changes: Partial<{ name: string; active: boolean }>) =>
  patch(`/api/suppliers/${encodeURIComponent(id)}`, changes);

export const createMarkupGroup = (name: string) => calcRequest<{ code: string; name: string }>("/api/markup-groups", "POST", { name });
export const renameMarkupGroup = (code: string, name: string) => put("/api/markup-groups", { code, name });

export interface CategoryInput {
  name: string;
  parentId?: string | null;
  productKind: ProductKind;
  markupGroup: MarkupGroup;
  quantityRule: "manual" | "per_panel";
  supportEligible: boolean;
}
export const createCategory = (category: CategoryInput) => calcRequest<{ id: string }>("/api/categories", "POST", category);
export const updateCategory = (id: string, changes: Partial<Omit<CategoryInput, "parentId">>) =>
  patch(`/api/categories/${encodeURIComponent(id)}`, changes);

export const updateProduct = (
  id: string,
  changes: Partial<{ name: string; unit: string; price: Kroner; attachmentUrl: string | null; supplierId: string; categoryId: string; active: boolean; specs: ProductSpecs }>,
) => patch(`/api/products/${encodeURIComponent(id)}`, changes);

export const createProduct = (product: {
  name: string;
  supplierId: string;
  categoryId: string;
  unit: string;
  price: Kroner;
  attachmentUrl?: string | null;
  specs?: ProductSpecs;
}) => calcRequest<{ id: string }>("/api/products", "POST", product);

export const createWorkType = (workType: { group: CalcWorkType["group"]; name: string; unit: string }) =>
  calcRequest<{ id: string }>("/api/work-types", "POST", workType);

export const updateWorkType = (id: string, changes: Partial<{ name: string; unit: string; unitConfirmed: boolean; active: boolean; supportEligible: boolean }>) =>
  patch(`/api/work-types/${encodeURIComponent(id)}`, changes);

/** "1 234,50" / "1234.5" → tall i kroner, eller null hvis tomt. Kaster ved ugyldig verdi. */
export function parseKroner(text: string): string | null {
  const cleaned = text.replace(/\s/g, "").replace("kr", "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error("Ugyldig beløp");
  return cleaned;
}

export const oreToInput = (ore: number | null | undefined) => (ore == null ? "" : String(ore / 100).replace(".", ","));

// --- Beregning ---

export type LineKind = "product" | "mount" | "work";
/** total = avtalt sluttsum eks. mva. (bare for kommisjon) */
export type AdjustmentMode = "auto" | "percent" | "amount" | "total";

/** Motorens input (se soleklart-kalkulator lib/engine/types.ts). Beløp i kroner. */
export interface CalcInputLine {
  id: string;
  name: string;
  kind: LineKind;
  productKind?: string;
  quantity: string | number;
  unit?: string;
  baseUnit: string | number;
  markupPercent: string | number;
  priceMode?: "auto" | "fixed";
  fixedSale?: string | number;
  reductionEligible?: boolean;
  meta?: Record<string, unknown>;
}

export interface CalcInput {
  currency: "NOK";
  panelCount: number;
  lines: CalcInputLine[];
  commission: { mode: AdjustmentMode; value?: string | number };
  commissionTiers: CalcTier[];
  noPanelCommissionPercent: number;
  reduction: { mode: AdjustmentMode; value?: string | number };
  reductionTiers: CalcTier[];
  vatPercent: string | number;
  supportAmount: string | number;
}

/** Motorens resultat. Alle beløp i øre. */
export interface CalcResult {
  engineVersion: string;
  panelCount: number;
  lines: (CalcInputLine & { base: number; reduction: number; reducedBase: number; sale: number; markupAmount: number })[];
  reduction: { mode: AdjustmentMode; percent: number | null; amount: number; base: number };
  commission: { mode: AdjustmentMode; percent: number | null; amount: number; base: number };
  totals: {
    base: number;
    subtotal: number;
    markup: number;
    totalExVat: number;
    vat: number;
    totalIncVat: number;
    support: number;
    afterSupport: number;
    supplierCost: number;
    installerRemaining: number;
  };
  support: {
    mode: "none" | "manual" | "auto";
    provider: string | null;
    amount: number;
    eligibleBaseIncVat: number | null;
    byPercent: number | null;
    byKwp: number | null;
    cap: number | null;
    kwp: number | null;
  };
  warnings: { code: string; message: string; blocking: boolean }[];
  ready: boolean;
}

/** Forhåndsvisning av et utkast med samme regler som ved lagring. */
export const previewDraft = (installerGroupId: string, draft: unknown) =>
  calcRequest<{ kwp: number; result: CalcResult; batteryOffer: BatteryOfferResult | null; economy: Economy }>("/api/preview", "POST", {
    installerGroupId,
    draft,
  });

export interface Economy {
  elPrice: number;
  netPrice: number;
  priceGrowthPercent: number;
}

// --- Batteri og hybrid som tillegg (regnes i kalkulatortjenesten) ---

/** Det brukeren velger for batteriseksjonen i et tilbud. Beløp i kroner. */
export interface BatteryOfferConfig {
  enabled: boolean;
  batteryClass?: "HV" | "LV";
  /** null = automatisk */
  hybridProductId?: string | null;
  /** null = installatørens sats for solcellemateriell */
  markupPercent?: string | null;
  installWorkTypeId?: string | null;
  installPrice?: string | null;
  recommendedModelId?: string | null;
  recommendedModules?: number | null;
  models?: {
    productId: string;
    enabled?: boolean;
    min?: number;
    max?: number;
    modulePrice?: string | null;
    bmsProductId?: string | null;
    bmsPrice?: string | null;
    modulesPerBms?: number;
  }[];
}

/** Øre: innkjøp → etter installatørens påslag → kundepris eks. mva. inkl. Soleklart */
export interface PriceSteps {
  purchaseOre: number;
  saleOre: number;
  customerOre: number;
}

export interface BatteryOfferResult {
  enabled: boolean;
  batteryClass: "HV" | "LV";
  materialMarkupPercent: number;
  materialMarkupOverridden: boolean;
  elektroMarkupPercent: number;
  commissionRate: number;
  stringInverter: { productId: string | null; name: string; acKw: number | null; saleUnitOre: number; datasheetUrl: string | null } | null;
  hybridIncluded: boolean;
  hybrid: (PriceSteps & { productId: string; name: string; acKw: number | null; batteryClass: string | null; datasheetUrl: string | null; auto: boolean }) | null;
  upgrade: { saleOre: number; customerOre: number };
  hybridCandidates: { productId: string; name: string; acKw: number | null; supplier: string; purchaseOre: number; fits: boolean }[];
  install: (PriceSteps & { workTypeId: string | null; name: string }) | null;
  models: {
    productId: string;
    name: string;
    enabled: boolean;
    structure: "modular" | "unit";
    moduleKwh: number;
    batteryClass: string | null;
    min: number;
    max: number;
    modulesPerBms: number;
    module: PriceSteps;
    modulePriceOverridden: boolean;
    bms: (PriceSteps & { productId: string | null; name: string; overridden: boolean }) | null;
    datasheetUrl: string | null;
  }[];
  recommended: { model: string; modules: number } | null;
  warnings: string[];
  section: Record<string, unknown> | null;
}

export interface SignedBreakdown {
  signedAt: string | null;
  version: number;
  versionCreatedAt: string;
  baseLines: { name: string; kind: string; quantity: number; purchaseOre: number; saleOre: number; markupPercent: number }[];
  batteryOffer: BatteryOfferResult | null;
  selection: { mode: "solar" | "hybrid" | "battery"; model?: string | null; modules?: number };
  capacityKwh: number;
  base: { subtotalOre: number; supplierCostOre: number; commissionOre: number; totalExVatOre: number };
  extras: {
    label: string;
    quantity: number;
    purchaseOre: number | null;
    installerMarkupOre: number | null;
    saleOre: number | null;
    soleklartOre: number | null;
    customerOre: number;
  }[];
  extrasCustomerOre: number;
  extrasSoleklartOre: number;
  commissionOre: number;
  totalExVatOre: number;
  totalIncVatOre: number;
  commissionRate: number;
  materialMarkupPercent: number | null;
}

/** Intern oppstilling for detaljvisningen (endelig kommisjon etter kundens valg ved signering). */
export const getEstimateBreakdown = (estimateId: string) =>
  calcRequest<SignedBreakdown>(`/api/estimates/${encodeURIComponent(estimateId)}/breakdown`);

export const calculatePreview = (input: CalcInput) => calcRequest<CalcResult>("/api/calculate", "POST", input);

// --- Kalkyler og låste tilbudsversjoner ---

export interface CalcVersionSummary {
  id: string;
  version: number;
  estimateId: string | null;
  totalExVatOre: number;
  totalIncVatOre: number;
  createdAt: string;
}

export interface CalcCalculation {
  id: string;
  installerGroupId: string;
  leadId: string | null;
  estimateId: string | null;
  title: string;
  lockVersion: number;
  draft: unknown;
  versions?: CalcVersionSummary[];
}

export const createCalculation = (body: { installerGroupId: string; leadId?: string | null; estimateId?: string | null; draft: unknown }) =>
  calcRequest<CalcCalculation>("/api/calculations", "POST", body);

export interface CalcDraftSummary {
  id: string;
  title: string;
  customerType: "private" | "business";
  leadId: string | null;
  estimateId: string | null;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
  latestVersion: number | null;
}

/** Utkast for en installatør (alle med tilgang til installatøren ser dem). */
export const listCalculations = (installerGroupId: string) =>
  calcRequest<{ calculations: CalcDraftSummary[] }>(`/api/calculations?installerGroupId=${encodeURIComponent(installerGroupId)}`).then((r) => r.calculations);

export const updateCalculation = (id: string, body: { lockVersion: number; draft: unknown }) =>
  calcRequest<CalcCalculation>(`/api/calculations/${encodeURIComponent(id)}`, "PUT", body);

export const getCalculation = (id: string) => calcRequest<CalcCalculation>(`/api/calculations/${encodeURIComponent(id)}`);

export const saveQuoteVersion = (calculationId: string, body: { lockVersion: number; draft: unknown }, idempotencyKey: string) =>
  calcRequest<{ quoteVersionId: string; version: number; lockVersion: number; estimateId: string | null; priceData: unknown; batteryOffer: BatteryOfferResult | null }>(
    `/api/calculations/${encodeURIComponent(calculationId)}/versions`,
    "POST",
    body,
    { "Idempotency-Key": idempotencyKey },
  );

/** Kobler et nyopprettet estimat til kalkylen og versjonen (skriver price_data + quote_version_id). */
export const linkEstimate = (calculationId: string, estimateId: string, quoteVersionId: string) =>
  calcRequest<{ ok: true }>(`/api/calculations/${encodeURIComponent(calculationId)}/link-estimate`, "POST", { estimateId, quoteVersionId });

/** En låst tilbudsversjon med motorens resultat (kostnad, påslag og salg per linje). */
export interface CalcQuoteVersion {
  id: string;
  calculationId: string;
  version: number;
  estimateId: string | null;
  createdAt: string;
  result: CalcResult & {
    lines: (CalcResult["lines"][number] & { baseUnit: number; markupPercent: number; meta?: Record<string, unknown> })[];
  };
}

export const getQuoteVersion = (id: string) => calcRequest<CalcQuoteVersion>(`/api/quote-versions/${encodeURIComponent(id)}`);
