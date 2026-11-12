// Klient for næringsanalysen i kalkulatortjenesten (soleklart-kalkulator, /api/business).
import { calcFetch, calcRequest } from "./calcApi";
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
  /** Målepunktet flaten er koblet til (null = hovedmåleren) */
  meteringPointId?: string | null;
  /** Skyggetap (%) i tillegg til terrenget PVGIS regner med */
  shadingPct?: number;
}

export type Hours = [number, number] | null;

/** Hvordan tariffen er valgt, tilknytning og avtaler for et målepunkt */
export type TariffSource = "foreslått" | "valgt" | "faktura" | "egen";
export interface TariffChoice {
  tariffSource: TariffSource;
  tariffReason: string | null;
  connection: { level: "lavspent" | "hoeyspent" | null; mainFuseA: number | null; voltageV: 230 | 400 | null };
  contractedKw: number | null;
  feedIn: boolean;
}
export type ExportLimitMode = "ukjent" | "ingen_grense" | "grense" | "ingen_eksport";
export interface ConsumptionSettings {
  level: 1 | 2 | 3;
  annualKwh: number | null;
  annualKwhStatus: DataStatus;
  monthlyKwh: number[] | null;
  source?: "anslag" | "kunde" | "faktura" | "målefil" | null;
}
export interface OtherMeter extends TariffChoice {
  id: string;
  label: string;
  meterId: string;
  tariffId: string | null;
  tariffConfirmed: boolean;
  tariffScenario: boolean;
  exportLimitMode: ExportLimitMode;
  exportLimitKw: number | null;
  importLimitKw: number | null;
  consumption: ConsumptionSettings;
}
export interface Charger {
  label: string;
  count: number;
  kw: number;
  kwhPerDay: number;
  window: [number, number];
  days: "hverdager" | "alle";
}
export interface BatterySettings {
  include: "auto" | "ja" | "nei";
  capacityKwh: number | null;
  usablePct: number | null;
  powerKw: number | null;
  dischargeKw: number | null;
  roundTripPct: number | null;
  reservePct: number | null;
  auxKw: number;
  gridCharge: boolean;
  gridExport: boolean;
  degradationPct: number;
  lifeYears: number;
  investmentNok: number | null;
  smartFeeNokPerYear: number | null;
  smartFeeOnceNok: number;
  wearOrePerKwh: number;
}

export type SourceType = "måledata" | "markedspriser" | "tariffregister" | "simulert" | "oppgitt" | "antatt" | "beregnet";
export interface AnalysisIssue {
  level: "feil" | "advarsel" | "antakelse";
  field: string;
  message: string;
}

/** Salg av lading til kjøretøy (DC-lader) */
export interface ChargeSale {
  enabled: boolean;
  label: string;
  powerKw: number;
  outlets: number;
  volumeMode: "kwh" | "prosent" | "profil";
  volumeKwh: number | null;
  volumePct: number | null;
  weekdays: number[];
  window: [number, number];
  skipHolidays: boolean;
  utilizationPct: number;
  priceNokPerKwh: number;
  priceGrowthPct: number;
  existingKwh: number;
  existingPriceNokPerKwh: number | null;
  investmentNok: number | null;
  opexNokPerYear: number;
}

export interface BusinessSettings {
  businessType: BusinessType;
  openHours: [number, number] | null;
  schedule: { weekdays: Hours; saturday: Hours; sunday: Hours; closedMonths?: number[] } | null;
  goals: string[];
  period:
    | { kind: "år"; year: number }
    | { kind: "hittil"; year: number; toMonth: number; toDay: number }
    | { kind: "egendefinert"; year: number; from: string; to: string };
  location: { address: string; lat: number | null; lon: number | null; priceArea: PriceArea | null; priceAreaSource: "foreslått" | "valgt" };
  consumption: ConsumptionSettings;
  production: {
    source: "pvgis" | "fil";
    pvgisVersion: "auto" | "v5_3" | "v6";
    weatherYear: number | null;
    lossPct: number;
    surfaces: Surface[];
    annual?: { source: "pvgis" | "tilbud" | "manuell"; kwh: number | null; offerKwh: number | null; offerManual: boolean };
  };
  meteringPoint: TariffChoice & {
    id: string;
    label: string;
    meterId: string;
    tariffId: string | null;
    tariffConfirmed: boolean;
    tariffScenario: boolean;
    exportLimitMode: ExportLimitMode;
    exportLimitKw: number | null;
    importLimitKw: number | null;
    buy: { type: "spot" | "fastpris"; fixedOrePerKwh: number | null; markupOrePerKwh: number; monthlyFeeNok: number; status: DataStatus };
    sell: { type: "spot" | "fastpris"; fixedOrePerKwh: number | null; deductionOrePerKwh: number; floorOrePerKwh: number | null; status: DataStatus };
    settlement: "time" | "kvarter";
    elavgift: { orePerKwh: number | null; taxStatus: "ordinær" | "redusert" | "fritak" | "ukjent"; status: DataStatus };
  };
  economy: {
    years: number;
    discountRatePct: number;
    growth: { kraftPct: number; nettleiePct: number; avgiftPct: number; driftPct: number };
    degradationPct: number;
    opex: { name: string; nokPerYear: number }[];
    replacementSource: "kalkyle" | "manuell" | "ingen";
    vatDeductible: "ja" | "nei" | "ukjent";
    replacements: { name: string; year: number; nok: number }[];
    investment: { source: "kalkyle" | "manuell" | "uavklart"; nok: number | null };
    support?: { source: "tilbud" | "manuell" | "ingen"; nok: number | null };
  };
  otherMeters: OtherMeter[];
  charging: { enabled: boolean; inConsumption: boolean; meteringPointId: string | null; chargers: Charger[]; sale?: ChargeSale };
  battery: BatterySettings;
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
  definition: TariffDefinition | GridDefinition;
  sourceUrl: string | null;
  lastChecked: string;
  isManual: boolean;
  owner: "felles" | "egen" | "annen";
  archived: boolean;
  parentId: string | null;
  usage: { analyses: number; locked: number } | null;
}

/** Nettariff med datoversjoner fra tariffregisteret (format «nettariff-v1»). Feltene er kildens. */
export interface GridVersion {
  id: string;
  dekket_fra: string;
  dekket_til_eksklusiv: string | null;
  kilder: string[];
  status: string;
  fastledd: { kr_per_mnd?: number; kr_per_aar?: number };
  energiledd_uttak: {
    modell: "lik_hele_doegnet" | "sesong" | "dag_natt";
    ore_per_kwh?: number | { sommermaaneder: number[] | null; sommer: number; resten_av_aaret?: number; vinter?: number };
    dag_fra?: string;
    dag_til_eksklusiv?: string;
    dag_gjelder?: string;
    dag_ore_per_kwh?: number;
    ellers_ore_per_kwh?: number;
  };
  kapasitet_eller_effekt: {
    modell: string;
    grunnlag?: string | null;
    grenser?: string | null;
    trinn?: { til_kw: number | null; kr_per_mnd: number }[];
    kr_per_kw_mnd?: number | { sommermaaneder: number[] | null; sommer: number | { dag: number; natt: number }; resten_av_aaret?: number | { dag: number; natt: number }; vinter?: number };
    blokker?: { til_kw: number | null; kr_per_kw_mnd: number }[];
    maanedsfaktorer_jan_des?: number[];
    [k: string]: unknown;
  };
  enova_800_per_aar: string;
  sperre?: string | null;
  merknad?: string | null;
}
export interface GridDefinition {
  format: "nettariff-v1";
  dataVersion: string;
  checked: string;
  coveredYear: number;
  coveredUntil: string;
  product: { id: string; nettselskap: string; navn_i_valg: string; vilkaar: string; valgtype: string; forslagsvilkaar: Record<string, unknown> };
  area: string;
  areaLabel: string;
  versions: GridVersion[];
  sources: Record<string, { tittel: string; url: string; kontrollert?: string }>;
  feedIn: { nettselskap: string; pluss_energiledd_ore_per_kwh?: number; bruk?: string; [k: string]: unknown }[];
  enovaNokPerYear: number;
}
export const isGridDefinition = (d: unknown): d is GridDefinition => (d as { format?: string } | null)?.format === "nettariff-v1";

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
    resolution?: "time" | "kvarter";
  } | null;
  rateChanges?: { from: string; energyOrePerKwh?: number; summerNokPerKwMonth?: number; winterNokPerKwMonth?: number; source: string; status?: DataStatus }[];
  minAnnualKwh?: number | null;
  maxAnnualKwh?: number | null;
  includedNote?: string;
  notes?: string[];
}

type Cost = { kraft: number; kraftGebyr: number; fastledd: number; energiledd: number; effektledd: number; elavgift: number; innmating?: number; salg: number; netto: number };

export interface GridSide {
  fastledd: number;
  energiledd: number;
  effektledd: number;
  innmating: number;
  nettleie: number;
  elavgift: number;
  salg: number;
  billedKw: number | null;
  billedLabel: string;
  shiftedFrom: string | null;
  powerMissing: string | null;
}
export interface GridSummary {
  estimated: boolean;
  shiftedFrom: string[];
  missing: string[];
  notes: string[];
  basis: string;
  alternatives: { key: string; name: string; months: { month: string; before: GridSide; after: GridSide }[]; total: { before: number; after: number } }[];
}
export interface ChargerSummary {
  label: string;
  base: "sol" | "grunn" | "smart";
  soldKwh: number;
  priceNokPerKwh: number;
  revenueNok: number;
  existingRevenueNok: number;
  costIncreaseNok: number;
  savings: Record<string, number>;
  exportKwh: number;
  exportNok: number;
  loadKwh: number;
  sources: { solarKwh: number; batteryKwh: number; gridKwh: number; gridCostNok: number };
  opex: number;
  net: number;
  investmentNok: number | null;
  economy: Economy[] | null;
}
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
  savings: { kraft: number; nettleieEnergi: number; effektledd: number; elavgift: number; fastOgGebyr: number; innmating?: number; salg: number; total: number };
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
  offerLabel?: string;
  vat?: "eks" | "inkl";
  meters?: { id: string; label: string; tariff: string; before: MeterTotals; after: MeterTotals; saving: number }[];
  charging?: { kwh: number; solarKwh: number; effektleddIncrease: number } | null;
  battery?: BatterySummary | null;
  /** Tilbudssum før støtte, støtte og netto investering som brukes (nyere analyser) */
  investment?: { grossNok: number | null; supportNok: number; netNok: number | null; supportSource: string; vat: "eks" | "inkl" } | null;
  /** Estimert årsproduksjon brukt i analysen og kilden (nyere analyser) */
  production?: { annualKwh: number; source: string; pvgisKwh: number | null; scaled: boolean } | null;
  grid?: GridSummary;
  charger?: ChargerSummary | null;
}

type MeterTotals = { loadKwh: number; pvKwh: number; selfKwh: number; importKwh: number; exportKwh: number; netto: number };
export type Economy = {
  name: string;
  kraftGrowth: number;
  npv: number | null;
  pvOfOperations: number;
  paybackYears: number | null;
  discountedPaybackYears: number | null;
  irr: number | null;
  irrNote: string | null;
  firstYearNet: number;
  rows: { year: number; netto: number; akkumulert: number | null; utskifting: number; drift: number; ladeinntekt?: number }[];
};
export interface BatteryStats {
  chargeKwh: number;
  solarChargeKwh: number;
  gridChargeKwh: number;
  dischargeKwh: number;
  toLoadKwh: number;
  toGridKwh: number;
  lossKwh: number;
  auxKwh: number;
  cycles: number;
  avgChargePrice: number | null;
  avgSellPrice: number | null;
}
export interface BatterySummary {
  label: string;
  investmentNok: number | null;
  config: { usableKwh: number; powerKw: number; dischargeKw?: number; sharedAcKw?: number | null; roundTrip: number; reserveShare: number; gridCharge: boolean; gridExport: boolean; lifeYears: number };
  alternatives: {
    key: "sol" | "grunn" | "smart";
    name: string;
    energySaving: number;
    savings: Record<string, number>;
    opex: number;
    net: number;
    importKwh: number;
    exportKwh: number;
    selfKwh: number;
    costAfter: number;
    investmentNok: number | null;
    economy: Economy[] | null;
    battery: BatteryStats | null;
  }[];
  value: { grunn: number; smart: number; smartFee: number };
  perfectForesightNet: number;
  months: { month: string; gain: number; chargeKwh: number; gridChargeKwh: number; dischargeKwh: number; toGridKwh: number; lossKwh: number; cycles: number; peakBeforeKw: number; peakAfterKw: number }[];
  day: { date: string; hours: { hour: number; price: number; soc: number; battery: number; load: number; pv: number }[] } | null;
}

export interface QuoteContext {
  kwp: number | null;
  investmentNok: number | null;
  investmentNote?: string;
  supportNok?: number;
  supportProvider?: string | null;
  inverterAcKw: number | null;
  inverterNok: number | null;
  inverterNames: string[];
  batteryOffered: boolean;
  battery: {
    source: "kalkyle" | "tillegg";
    label: string;
    capacityKwh: number | null;
    powerKw: number | null;
    powerNote: string;
    usablePct: number | null;
    roundTripPct: number | null;
    lifeYears: number | null;
    investmentNok: number | null;
    investmentNote: string;
    sharedAcKw?: number | null;
  } | null;
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
  const res = await calcFetch(`${base}/${enc(id)}/files`, {
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
  body: { candidateId: string; kind: "forbruk" | "produksjon"; unit?: string; convention?: "start" | "slutt" | "auto"; confirm: boolean; meteringPointId?: string },
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

export interface TariffCandidate {
  productId: string;
  area: string;
  name: string;
  fit: "foreslått" | "mulig" | "avtale";
  reasons: string[];
  blocked: string | null;
  company: string;
  tariffId: string | null;
  areaNote: string | null;
}
export interface TariffSuggestion {
  address: string | null;
  municipality: string | null;
  gridArea: { companies: { code: string; name: string; area: string | null }[]; rawNames: string[]; source: "nve" | "kommune" | "ingen" | "valgt"; note: string };
  candidates: TariffCandidate[];
  suggested: { tariffId: string | null; name: string; reason: string } | null;
}
/** Forslag til tariff for et målepunkt fra adressen (nettselskap) og årsforbruk/tilknytning (produkt). */
export const suggestTariff = (body: {
  installerGroupId: string;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  annualKwh: number | null;
  level: "lavspent" | "hoeyspent" | null;
  mainFuseA: number | null;
  voltageV: 230 | 400 | null;
  companyCode?: string | null;
  area?: string | null;
  date?: string | null;
}) => calcRequest<TariffSuggestion>(`${base}/tariff-suggestion`, "POST", body);
