// Batterioppsettet som følger med et estimat til kundens tilbudsside
// (pvwebsites: price_data.batterySection → BatteryOptions).
//
// Batterier er bygget ulikt:
//   * modulære: moduler som stables, med BMS/base per N moduler (f.eks. Enershare 3,2 kWh/modul)
//   * hele enheter: én boks med fast kapasitet uten egen BMS (f.eks. et 10 kWh batteri)
// Modellene utledes fra produktkatalogen (kategori med productKind «batteri»), og kan justeres per estimat.
// Alle beløp er kroner eks. mva., slik kundesiden forventer.
import type { CalcCatalog, CalcProduct } from "@/lib/calcApi";
import { categoryOf } from "../kalkulator/quote";

export type BatteryStructure = "modular" | "unit";

export interface BatteryModelSetup {
  /** Produkt-id for modulen/enheten i katalogen */
  id: string;
  /** Vises som alternativ for kunden */
  enabled: boolean;
  name: string;
  structure: BatteryStructure;
  /** kWh per modul (modulær) eller per enhet */
  moduleKwh: number;
  /** Salgspris per modul/enhet, eks. mva. */
  moduleEx: number;
  /** Navn på BMS/base, tom = ingen */
  bmsName: string;
  /** Salgspris per BMS/base, eks. mva. 0 = ingen BMS */
  baseEx: number;
  /** Maks moduler per BMS/base */
  modulesPerBase: number;
  min: number;
  max: number;
  datasheetUrl: string | null;
}

export type HybridMode = "formula" | "manual";

export interface BatterySetup {
  /** Pris for «Klargjør for batteri» (hybridinverter) */
  hybridMode: HybridMode;
  /** formula: inverterpris × faktor */
  hybridFactor: number;
  hybridManualEx: number;
  /** Installasjon av batteri, eks. mva. */
  installEx: number;
  recommendedModelId: string;
  recommendedModules: number;
  models: BatteryModelSetup[];
}

/**
 * Det som lagres som standard i nettleseren. Gjelder ALLE installatører.
 *
 * Priser lagres ikke: pris per modul/enhet og BMS kommer alltid fra installatørens katalog
 * (innkjøp + installatørens påslag for solcellemateriell), og installasjon fra installatørens
 * avtalte batteriarbeid. Unntak er egne modeller som ikke finnes i katalogen.
 */
type ModelDefaults = Partial<Omit<BatteryModelSetup, "id" | "moduleEx" | "baseEx" | "datasheetUrl">>;
interface SavedDefaults {
  hybridMode: HybridMode;
  hybridFactor: number;
  hybridManualEx: number;
  recommendedModelId: string;
  recommendedModules: number;
  /** Per produkt-id (katalogmodeller) */
  models: Record<string, ModelDefaults>;
  /** Egne modeller lagt til for hånd, med pris */
  customModels?: BatteryModelSetup[];
}

const BMS_PATTERN = /\b(bms|base|kontrollenhet|styringsenhet|control\s*unit|hvc|high\s*voltage\s*control|power\s*module|effektmodul)\b/i;
const STORAGE_KEY = "soleklart.batterySetup";
/** Eldre lagring per installatør (før standarden ble felles) */
const legacyKey = (installerId: string) => `soleklart.batterySetup.${installerId}`;

const round = (n: number) => Math.round(n);
const brandOf = (p: CalcProduct) => p.name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

/** «3,2 kW», «5 kWh», «LUNA2000-10» → kWh. kWp og W ignoreres. */
export function kwhFromName(name: string): number | null {
  const m = name.match(/(\d+(?:[.,]\d+)?)\s*kwh?\b(?!p)/i);
  if (m) return Number(m[1].replace(",", "."));
  return null;
}

/** Installatørens påslag for solcellemateriell, i prosent */
export const batteryMarkupPercent = (catalog: CalcCatalog) => catalog.markups.solcellemateriell ?? 0;

/** Salgspris eks. mva. = innkjøp + installatørens påslag for solcellemateriell */
function saleEx(catalog: CalcCatalog, p: CalcProduct): number {
  return round((p.priceOre / 100) * (1 + batteryMarkupPercent(catalog) / 100));
}

const isBattery = (catalog: CalcCatalog, p: CalcProduct) => p.active && categoryOf(catalog, p)?.productKind === "batteri";
const isBms = (p: CalcProduct) => BMS_PATTERN.test(p.name) || p.specs?.bms === true;

/** Modeller utledet fra katalogen. Hver modul/enhet blir én modell; BMS kobles på samme merke. */
export function modelsFromCatalog(catalog: CalcCatalog): BatteryModelSetup[] {
  const batteries = catalog.products.filter((p) => isBattery(catalog, p));
  const bmsList = batteries.filter(isBms);
  const units = batteries.filter((p) => !isBms(p));

  return units.map((p) => {
    const specs = p.specs ?? {};
    const kwh = Number(specs.capacityKwh) || kwhFromName(p.name) || 0;
    const bms = bmsList.find((b) => brandOf(b) === brandOf(p));
    // Har merket en BMS/base, er batteriet modulært. Ellers er det en hel enhet.
    const structure: BatteryStructure = bms ? "modular" : "unit";
    const perBase = Number(specs.modulesPerBase) || (structure === "modular" ? 8 : 1);
    const min = Number(specs.minModules) || (structure === "modular" ? 2 : 1);
    const max = Number(specs.maxModules) || (structure === "modular" ? perBase * 3 : 4);
    return {
      id: p.id,
      enabled: true,
      name: p.name,
      structure,
      moduleKwh: kwh,
      moduleEx: saleEx(catalog, p),
      bmsName: bms?.name ?? "",
      baseEx: bms ? saleEx(catalog, bms) : 0,
      modulesPerBase: perBase,
      min,
      max: Math.max(min, max),
      datasheetUrl: p.attachmentUrl ?? null,
    };
  });
}

/** Installasjonspris for batteri fra avtalte arbeidspriser (gruppe «batteri»), med elektro-påslag. */
function defaultInstallEx(catalog: CalcCatalog): number {
  const work = catalog.workTypes.find((w) => w.active && w.group === "batteri" && w.priceOre != null);
  if (!work?.priceOre) return 8000;
  return round((work.priceOre / 100) * (1 + (catalog.markups.elektro ?? 0) / 100));
}

/** Fornuftig startstørrelse: minst min, rundt 10 kWh. */
export function suggestedModules(model: BatteryModelSetup | undefined): number {
  if (!model || model.moduleKwh <= 0) return model?.min ?? 1;
  const target = Math.round(10 / model.moduleKwh);
  return Math.max(model.min, Math.min(model.max, target || model.min));
}

function readDefaults(installerId: string): SavedDefaults | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(legacyKey(installerId));
    return raw ? (JSON.parse(raw) as SavedDefaults) : null;
  } catch {
    return null;
  }
}

/** Bare ikke-pris-feltene fra lagret standard (eldre lagring kan inneholde priser). */
function modelDefaults(saved: SavedDefaults | null, id: string): ModelDefaults {
  const raw = (saved?.models?.[id] ?? {}) as Partial<BatteryModelSetup>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { moduleEx, baseEx, datasheetUrl, id: _id, ...rest } = raw;
  return rest;
}

/** Oppsett for et nytt estimat: katalogen (priser for installatøren) + felles lagret standard. */
export function initialSetup(catalog: CalcCatalog): BatterySetup {
  const saved = readDefaults(catalog.installer.id);
  const fromCatalog = modelsFromCatalog(catalog).map((m) => ({ ...m, ...modelDefaults(saved, m.id) }));
  const models = [...fromCatalog, ...(saved?.customModels ?? [])];
  const firstEnabled = models.find((m) => m.enabled) ?? models[0];
  const recommended = models.find((m) => m.id === saved?.recommendedModelId && m.enabled) ?? firstEnabled;
  return {
    hybridMode: saved?.hybridMode ?? "formula",
    hybridFactor: saved?.hybridFactor ?? 2,
    hybridManualEx: saved?.hybridManualEx ?? 12000,
    installEx: defaultInstallEx(catalog),
    recommendedModelId: recommended?.id ?? "",
    recommendedModules:
      recommended && saved?.recommendedModelId === recommended.id && saved.recommendedModules
        ? saved.recommendedModules
        : suggestedModules(recommended),
    models,
  };
}

export function saveDefaults(setup: BatterySetup) {
  const isCustom = (m: BatteryModelSetup) => m.id.startsWith("egen-");
  const data: SavedDefaults = {
    hybridMode: setup.hybridMode,
    hybridFactor: setup.hybridFactor,
    hybridManualEx: setup.hybridManualEx,
    recommendedModelId: setup.recommendedModelId,
    recommendedModules: setup.recommendedModules,
    models: Object.fromEntries(
      setup.models
        .filter((m) => !isCustom(m))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ id, moduleEx, baseEx, datasheetUrl, ...rest }) => [id, rest]),
    ),
    customModels: setup.models.filter(isCustom),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearDefaults(installerId: string) {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(legacyKey(installerId));
  } catch {
    /* ignorer */
  }
}

/** Pris for klargjøring (hybridinverter), eks. mva. inverterSaleEx = inverterlinjens sum eks. mva. */
export function hybridPriceEx(setup: BatterySetup, inverterSaleEx: number | null): number {
  if (setup.hybridMode === "manual") return round(setup.hybridManualEx);
  return round((inverterSaleEx ?? 0) * setup.hybridFactor);
}

/** Blokken kundesiden leser (price_data.batterySection). Bare avkryssede modeller tas med. */
export function toBatterySection(setup: BatterySetup, inverterSaleEx: number | null) {
  const enabled = setup.models.filter((m) => m.enabled && m.moduleKwh > 0);
  const recommended = enabled.find((m) => m.id === setup.recommendedModelId) ?? enabled[0];
  return {
    hybridQty: 1,
    hybridUnitEx: hybridPriceEx(setup, inverterSaleEx),
    hybridPricing: setup.hybridMode === "manual" ? "manual" : `inverter×${setup.hybridFactor}`,
    batteryInstallEx: round(setup.installEx),
    recommended: recommended
      ? { model: recommended.id, modules: Math.max(recommended.min, Math.min(recommended.max, setup.recommendedModules)) }
      : null,
    catalogue: Object.fromEntries(
      enabled.map((m) => [
        m.id,
        {
          id: m.id,
          brand: m.name,
          structure: m.structure,
          moduleKwh: m.moduleKwh,
          min: m.min,
          max: m.max,
          modulesPerBase: m.structure === "modular" ? Math.max(1, m.modulesPerBase) : null,
          baseEx: m.structure === "modular" ? round(m.baseEx) : 0,
          bmsName: m.structure === "modular" ? m.bmsName || "BMS / base" : null,
          moduleEx: round(m.moduleEx),
          discountEnabled: false,
          tiers: [],
          supplierFromKwh: 50,
          datasheetUrl: m.datasheetUrl,
        },
      ]),
    ),
  };
}
