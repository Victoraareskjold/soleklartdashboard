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

export type MarkupGroup = "solcellemateriell" | "frakt" | "stillase" | "ballastein" | "elektro" | "montering";

export interface CalcInstaller {
  id: string;
  name: string;
  teamId: string;
}

export interface CalcCategory {
  id: string;
  parentId: string | null;
  name: string;
  productKind: string;
  markupGroup: MarkupGroup;
  sortOrder: number;
}

export interface CalcProduct {
  id: string;
  name: string;
  unit: string;
  priceOre: number;
  priceUpdatedAt: string;
  attachmentUrl: string | null;
  specs: Record<string, unknown>;
  categoryId: string;
  supplierId: string;
  supplierName: string;
}

export interface CalcWorkType {
  id: string;
  group: "søknad" | "solcelleanlegg" | "batteri" | "tillegg";
  name: string;
  unit: string;
  unitConfirmed: boolean;
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
}

export interface CalcCatalog {
  installer: { id: string; name: string };
  teamId: string;
  /** Om brukeren er admin og kan endre priser. */
  canEdit: boolean;
  suppliers: CalcSupplier[];
  categories: CalcCategory[];
  products: CalcProduct[];
  markups: Partial<Record<MarkupGroup, number>>;
  workTypes: CalcWorkType[];
  mountRates: CalcMountRate[];
  volumeTiers: CalcTier[];
  commissionTiers: CalcTier[];
  settings: { noPanelCommissionPercent: number; vatPercent: number };
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

export const setCommissionSettings = (body: {
  commissionTiers: CalcTier[];
  noPanelCommissionPercent: number;
  vatPercent: number;
}) => put("/api/settings", body);

export const updateProduct = (
  id: string,
  changes: Partial<{ name: string; unit: string; price: Kroner; attachmentUrl: string | null; supplierId: string; categoryId: string; active: boolean }>,
) => patch(`/api/products/${encodeURIComponent(id)}`, changes);

export const createProduct = (product: {
  name: string;
  supplierId: string;
  categoryId: string;
  unit: string;
  price: Kroner;
  attachmentUrl?: string | null;
}) => calcRequest<{ id: string }>("/api/products", "POST", product);

export const createWorkType = (workType: { group: CalcWorkType["group"]; name: string; unit: string }) =>
  calcRequest<{ id: string }>("/api/work-types", "POST", workType);

export const updateWorkType = (id: string, changes: Partial<{ name: string; unit: string; unitConfirmed: boolean; active: boolean }>) =>
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
export type AdjustmentMode = "auto" | "percent" | "amount";

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
  warnings: { code: string; message: string; blocking: boolean }[];
  ready: boolean;
}

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

export const getCalculation = (id: string) => calcRequest<CalcCalculation>(`/api/calculations/${encodeURIComponent(id)}`);

export const saveQuoteVersion = (calculationId: string, body: { lockVersion: number; draft: unknown }, idempotencyKey: string) =>
  calcRequest<{ quoteVersionId: string; version: number; lockVersion: number; estimateId: string | null; priceData: unknown }>(
    `/api/calculations/${encodeURIComponent(calculationId)}/versions`,
    "POST",
    body,
    { "Idempotency-Key": idempotencyKey },
  );

/** Kobler et nyopprettet estimat til kalkylen og versjonen (skriver price_data + quote_version_id). */
export const linkEstimate = (calculationId: string, estimateId: string, quoteVersionId: string) =>
  calcRequest<{ ok: true }>(`/api/calculations/${encodeURIComponent(calculationId)}/link-estimate`, "POST", { estimateId, quoteVersionId });
