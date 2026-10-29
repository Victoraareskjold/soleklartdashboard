// Klient for næringsanalysen i kalkulatortjenesten (soleklart-kalkulator, /api/business).
import { CALC_API_URL, calcRequest } from "./calcApi";
import { getToken } from "./api";

export type DataStatus = "målt" | "beregnet" | "antatt";
export type BusinessType = "kontor" | "butikk" | "lager" | "verksted" | "landbruk" | "døgnkontinuerlig";
export type PriceArea = "NO1" | "NO2" | "NO3" | "NO4" | "NO5";

export const BUSINESS_TYPES: { value: BusinessType; label: string; hours: [number, number] }[] = [
  { value: "kontor", label: "Kontor", hours: [7, 17] },
  { value: "butikk", label: "Butikk", hours: [9, 21] },
  { value: "lager", label: "Lager", hours: [6, 16] },
  { value: "verksted", label: "Verksted / industri", hours: [6, 15] },
  { value: "landbruk", label: "Landbruk", hours: [5, 20] },
  { value: "døgnkontinuerlig", label: "Døgnkontinuerlig drift", hours: [0, 24] },
];

export const GOALS = [
  { value: "lavere_regning", label: "Lavere strømregning" },
  { value: "egenbruk", label: "Bruke mer av egen solstrøm" },
  { value: "effekt", label: "Lavere effekttopper" },
  { value: "lading", label: "Lading" },
  { value: "nødstrøm", label: "Nødstrøm" },
] as const;

export interface Surface {
  id: string;
  label: string;
  panels: number | null;
  kwp: number | null;
  tiltDeg: number;
  azimuthDeg: number;
  /** Eksempelrad (ikke fra tilbudet) – vises som antatt */
  assumed?: boolean;
}

export type SourceType = "måledata" | "markedspriser" | "tariffregister" | "simulert" | "oppgitt" | "antatt" | "beregnet";
export interface AnalysisIssue {
  level: "feil" | "advarsel" | "antakelse";
  field: string;
  message: string;
}

export interface BusinessSettings {
  businessType: BusinessType;
  openHours: [number, number] | null;
  goals: string[];
  period: { kind: "år"; year: number } | { kind: "hittil"; year: number; toMonth: number; toDay: number };
  location: { address: string; lat: number | null; lon: number | null; priceArea: PriceArea | null; priceAreaSource: "foreslått" | "valgt" };
  consumption: { level: 1 | 2 | 3; annualKwh: number | null; annualKwhStatus: DataStatus; monthlyKwh: number[] | null };
  production: { source: "pvgis" | "fil"; pvgisVersion: "auto" | "v5_3" | "v6"; weatherYear: number | null; lossPct: number; surfaces: Surface[] };
  meteringPoint: {
    id: string;
    label: string;
    meterId: string;
    tariffId: string | null;
    tariffConfirmed: boolean;
    tariffScenario: boolean;
    exportLimitKw: number | null;
    buy: { markupOrePerKwh: number; monthlyFeeNok: number; status: DataStatus };
    sell: { deductionOrePerKwh: number; status: DataStatus };
    elavgift: { orePerKwh: number | null; taxStatus: "ordinær" | "redusert" | "fritak" | "ukjent"; status: DataStatus };
  };
  economy: {
    years: number;
    discountRatePct: number;
    growth: { kraftPct: number; nettleiePct: number; avgiftPct: number; driftPct: number };
    degradationPct: number;
    opex: { name: string; nokPerYear: number }[];
    replacementSource: "kalkyle" | "manuell" | "ingen";
    replacements: { name: string; year: number; nok: number }[];
    investment: { source: "kalkyle" | "manuell" | "uavklart"; nok: number | null };
  };
  scenarios: { name: string; kraftGrowthPct: number }[];
}

export interface BusinessAnalysis {
  id: string;
  leadId: string;
  installerGroupId: string;
  settings: BusinessSettings;
  lockVersion: number;
  updatedAt: string;
}

export interface QualityIssue {
  level: "info" | "advarsel" | "feil";
  code: string;
  message: string;
  count?: number;
  examples?: string[];
}
export interface QualityReport {
  intervals: number;
  expectedIntervals: number;
  resolutionMin: number;
  firstLocal: string;
  lastLocal: string;
  sumKwh: number;
  missing: number;
  duplicates: number;
  estimated: number;
  issues: QualityIssue[];
}

export interface BusinessSeries {
  id: string;
  meteringPointId: string;
  kind: "forbruk" | "produksjon";
  origin: string;
  status: DataStatus;
  resolutionMin: number;
  startUtc: string;
  intervals: number;
  sumKwh: number;
  quality: QualityReport | null;
  provenance: { status: DataStatus; source: string; period?: { from: string; to: string }; note?: string };
  sourceFileId: string | null;
  active: boolean;
  createdAt: string;
}

export interface FileCandidate {
  id: string;
  sheet: string;
  header: string;
  meterId: string | null;
  priceArea: string | null;
  gridOwner: string | null;
  roleGuess: "forbruk" | "produksjon" | "import" | "eksport" | "pris" | "ukjent";
  roleReason: string;
  unitGuess: string;
  unitReason: string;
  aggregateOf: string[] | null;
  rows: number;
  emptyRows: number;
  first: string | null;
  last: string | null;
  sum: number;
}

export interface UploadResult {
  file: { id: string; fileName: string; sizeBytes: number; sha256: string; createdAt: string };
  fileName: string;
  notes: string[];
  candidates: FileCandidate[];
}

export interface Tariff {
  id: string;
  gridOwner: string;
  name: string;
  customerGroup: string;
  validFrom: string;
  validTo: string | null;
  definition: TariffDefinition;
  sourceUrl: string | null;
  lastChecked: string;
  isManual: boolean;
  owner: "felles" | "egen" | "annen";
  archived: boolean;
  parentId: string | null;
  usage: { analyses: number; locked: number } | null;
}

export interface TariffDefinition {
  fixedNokPerYear: number;
  fixedAllocation?: "per_dag" | "per_måned";
  energyOrePerKwh: number;
  power?: {
    method: "maks_time_i_vindu";
    summerNokPerKwMonth: number;
    winterNokPerKwMonth: number;
    window: { weekdays: number[]; fromHour: number; toHour: number; excludeHolidays: boolean };
    summerMonths: number[];
  } | null;
  rateChanges?: { from: string; energyOrePerKwh?: number; summerNokPerKwMonth?: number; winterNokPerKwMonth?: number; source: string; status?: DataStatus }[];
  minAnnualKwh?: number | null;
  maxAnnualKwh?: number | null;
  includedNote?: string;
  notes?: string[];
}

type Cost = { kraft: number; kraftGebyr: number; fastledd: number; energiledd: number; effektledd: number; elavgift: number; salg: number; netto: number };
type Totals = { loadKwh: number; pvKwh: number; selfKwh: number; importKwh: number; exportKwh: number; curtailedKwh: number; clippedKwh?: number; cost: Cost };

/** Samme form som price_data.businessAnalysis på et lagret tilbud */
export interface BusinessSummary {
  status: "beregnet";
  runId: string | null;
  engineVersion: string;
  inputHash: string;
  calculatedAt: string;
  period: { label: string; coverage: number; complete: boolean };
  dataLevel: { consumption: 1 | 2 | 3; label: string };
  customerSentence: string;
  system: { kwp: number; surfaces: { label: string; kwp: number; tiltDeg: number; azimuthDeg: number }[] };
  investmentNok: number | null;
  investmentSource: string;
  kpi: { selfConsumptionShare: number; selfSufficiencyShare: number };
  years?: { price: number; weather: number | null };
  historical?: { energySaving: number; opex: number; net: number; opexItems: { name: string; nok: number }[] };
  scope?: { solar: boolean; battery: boolean; batteryOffered: boolean; inverterAcKw: number | null; clippedKwh: number };
  issues?: AnalysisIssue[];
  valid?: boolean;
  before: Totals;
  after: Totals;
  savings: { kraft: number; nettleieEnergi: number; effektledd: number; elavgift: number; fastOgGebyr: number; salg: number; total: number };
  months: {
    month: string;
    loadKwh: number;
    pvKwh: number;
    selfKwh: number;
    importBeforeKwh: number;
    importAfterKwh: number;
    exportKwh: number;
    peakBeforeKw: number;
    peakAfterKw: number;
    costBefore: number;
    costAfter: number;
  }[];
  economy:
    | {
        name: string;
        kraftGrowth: number;
        npv: number | null;
        pvOfOperations: number;
        paybackYears: number | null;
        discountedPaybackYears: number | null;
        irr: number | null;
        irrNote: string | null;
        firstYearNet: number;
        rows: { year: number; netto: number; akkumulert: number | null; savedKraft: number; savedNettleie: number; savedAvgift: number; salg: number; drift: number; utskifting: number }[];
      }[]
    | null;
  economyNote: string | null;
  assumptions: {
    years: number;
    discountRatePct: number;
    growth: BusinessSettings["economy"]["growth"];
    degradationPct: number;
    replacements?: { name: string; year: number; nok: number }[];
    opexUsed?: { name: string; nokPerYear: number }[];
    vat: string;
    beforeTax: string;
  };
  basis: { what: string; value: string; status: DataStatus; sourceType?: SourceType; confirmed?: boolean; source: string; period?: string }[];
  warnings: string[];
  checks: { label: string; ok: boolean }[];
}

export interface QuoteContext {
  kwp: number | null;
  investmentNok: number | null;
  investmentNote?: string;
  inverterAcKw: number | null;
  inverterNok: number | null;
  inverterNames: string[];
  batteryOffered: boolean;
  replacementYear: number;
  replacementFactor: number;
  maintenancePerYear: number;
}

export interface RunResult {
  summary: BusinessSummary;
  quote: QuoteContext;
  meta: { pvgis: { version: string; weatherYear: number; fallback?: string } | null; spot: { area: string; days: number; fetched: number }; tariff: { id: string; name: string } };
  quality: QualityReport | null;
}

const base = "/api/business";
const enc = encodeURIComponent;

export const getBusinessAnalysis = (leadId: string) =>
  calcRequest<{ analysis: BusinessAnalysis | null; series: BusinessSeries[]; files: { id: string; fileName: string; sizeBytes: number; createdAt: string }[] }>(
    `${base}?leadId=${enc(leadId)}`,
  );
export const createBusinessAnalysis = (leadId: string) => calcRequest<BusinessAnalysis>(base, "POST", { leadId });
export const saveBusinessAnalysis = (id: string, lockVersion: number, settings: BusinessSettings) =>
  calcRequest<BusinessAnalysis>(`${base}/${enc(id)}`, "PUT", { lockVersion, settings });

/** Laster opp filen som rå bytes (ikke JSON), så store eksporter ikke blir 33 % større. */
export async function uploadBusinessFile(id: string, file: File): Promise<UploadResult> {
  const token = await getToken();
  const res = await fetch(`${CALC_API_URL}${base}/${enc(id)}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream", "X-File-Name": enc(file.name) },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Opplasting feilet (${res.status})`);
  return data as UploadResult;
}

export const importBusinessSeries = (
  id: string,
  fileId: string,
  body: { candidateId: string; kind: "forbruk" | "produksjon"; unit?: string; convention?: "start" | "slutt" | "auto"; confirm: boolean },
) => calcRequest<{ report: QualityReport; preview?: true; series?: BusinessSeries }>(`${base}/${enc(id)}/files/${enc(fileId)}/import`, "POST", body);

export const setSeriesActive = (id: string, seriesId: string, active: boolean) =>
  calcRequest<{ id: string; active: boolean }>(`${base}/${enc(id)}/series/${enc(seriesId)}`, "PATCH", { active });

/** Beregner med tilbudets utkast (regnes på serveren: kWp, investering, inverter). refresh = hent kildedata på nytt. */
export const runBusinessAnalysis = (id: string, body: { draft: unknown; refresh: boolean }) => calcRequest<RunResult>(`${base}/${enc(id)}/run`, "POST", body);

export const getTariffs = (installerGroupId: string, opts: { includeArchived?: boolean; selected?: string | null } = {}) =>
  calcRequest<{ tariffs: Tariff[] }>(
    `${base}/tariffs?installerGroupId=${enc(installerGroupId)}${opts.includeArchived ? "&includeArchived=1" : ""}${opts.selected ? `&selected=${enc(opts.selected)}` : ""}`,
  ).then((r) => r.tariffs);

export interface TariffInput {
  gridOwner: string;
  name: string;
  customerGroup?: string;
  validFrom: string;
  validTo: string | null;
  sourceUrl: string | null;
  definition: TariffDefinition;
}
export const createTariff = (body: TariffInput & { installerGroupId: string; parentId?: string | null }) => calcRequest<Tariff>(`${base}/tariffs`, "POST", body);
export const updateTariff = (id: string, body: Partial<TariffInput> & { installerGroupId: string; archived?: boolean }) =>
  calcRequest<Tariff>(`${base}/tariffs/${enc(id)}`, "PATCH", body);
export const deleteTariff = (id: string, installerGroupId: string) =>
  calcRequest<{ archived: boolean; deleted: boolean; usage: { analyses: number; locked: number } }>(`${base}/tariffs/${enc(id)}?installerGroupId=${enc(installerGroupId)}`, "DELETE");
export const duplicateTariff = (id: string, installerGroupId: string, name?: string) =>
  calcRequest<Tariff>(`${base}/tariffs/${enc(id)}/duplicate`, "POST", { installerGroupId, name });

export const geocodeAddress = (address: string) =>
  calcRequest<{ address: string; lat: number; lon: number; municipality: string; priceArea: PriceArea | null }>(`${base}/geocode`, "POST", { address });
