"use client";

// «Batteri på tilbudssiden» – settes når estimatet opprettes.
// Bestemmer prisen på «Klargjør for batteri», hvilke batterimodeller kunden kan velge mellom,
// og prisene per modul og BMS. Standardvalgene lagres i nettleseren per installatør.
import { BatteryCharging, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import {
  clearDefaults,
  hybridPriceEx,
  modelsFromCatalog,
  saveDefaults,
  suggestedModules,
  type BatteryModelSetup,
  type BatterySetup,
} from "./batterySetup";
import type { CalcCatalog } from "@/lib/calcApi";

interface Props {
  catalog: CalcCatalog;
  setup: BatterySetup;
  onChange: (setup: BatterySetup) => void;
  /** Inverterlinjens sum eks. mva. fra kalkylen (null = ingen inverter i kalkylen) */
  inverterSaleEx: number | null;
  /** Næringskunde: kunden ser priser eks. mva. */
  business: boolean;
}

const nok = (n: number) => Math.round(n || 0).toLocaleString("nb-NO");
const toNum = (raw: string) => {
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const cell = "h-8 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-sm text-ink hover:border-gray-300";
const numCell = `${cell} text-right tabular-nums`;

function capacityRange(m: BatteryModelSetup) {
  const fmt = (n: number) => n.toLocaleString("nb-NO", { maximumFractionDigits: 1 });
  return `${fmt(m.min * m.moduleKwh)}–${fmt(m.max * m.moduleKwh)} kWh`;
}

export default function BatteryOfferSetup({ catalog, setup, onChange, inverterSaleEx, business }: Props) {
  const set = (patch: Partial<BatterySetup>) => onChange({ ...setup, ...patch });
  const setModel = (id: string, patch: Partial<BatteryModelSetup>) =>
    set({ models: setup.models.map((m) => (m.id === id ? { ...m, ...patch } : m)) });

  const hybridEx = hybridPriceEx(setup, inverterSaleEx);
  const vat = business ? 1 : 1.25;
  const taxLabel = business ? "eks. mva" : "inkl. mva";
  const recommended = setup.models.find((m) => m.id === setup.recommendedModelId);
  const enabledCount = setup.models.filter((m) => m.enabled).length;

  const addCustom = () => {
    const model: BatteryModelSetup = {
      id: `egen-${Date.now()}`,
      enabled: true,
      name: "Nytt batteri",
      structure: "unit",
      moduleKwh: 10,
      moduleEx: 0,
      bmsName: "",
      baseEx: 0,
      modulesPerBase: 1,
      min: 1,
      max: 2,
      datasheetUrl: null,
    };
    set({ models: [...setup.models, model] });
  };

  const resetToCatalog = () => {
    clearDefaults(catalog.installer.id);
    const models = modelsFromCatalog(catalog);
    onChange({
      ...setup,
      hybridMode: "formula",
      hybridFactor: 2,
      models,
      recommendedModelId: models[0]?.id ?? "",
      recommendedModules: suggestedModules(models[0]),
    });
    toast.info("Batterioppsettet er tilbakestilt til produktkatalogen.");
  };

  return (
    <section className="sk-card overflow-hidden">
      <div className="sk-card-header flex-wrap gap-2 py-3">
        <div className="flex items-center gap-2">
          <BatteryCharging size={16} className="text-brand" />
          <h3 className="sk-section-title text-sm">Batteri på tilbudssiden</h3>
          <span className="text-xs text-muted">
            Kunden kan velge «Klargjør for batteri» eller «Solceller + batteri» på tilbudet. Priser eks. mva.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="sk-btn sk-btn-ghost sk-btn-sm" onClick={resetToCatalog} title="Hent modeller og priser på nytt fra produktkatalogen">
            <RotateCcw size={14} /> Fra katalog
          </button>
          <button
            type="button"
            className="sk-btn sk-btn-secondary sk-btn-sm"
            onClick={() =>
              saveDefaults(catalog.installer.id, setup)
                ? toast.success(`Lagret som standard for ${catalog.installer.name} i denne nettleseren.`)
                : toast.error("Kunne ikke lagre i nettleseren.")
            }
          >
            <Save size={14} /> Lagre som standard
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Klargjøring */}
        <div className="rounded-xl border border-line p-3">
          <p className="sk-label mb-2">Klargjør for batteri (hybridinverter)</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Prisgrunnlag
              <select className={`${cell} w-56`} value={setup.hybridMode} onChange={(e) => set({ hybridMode: e.target.value as BatterySetup["hybridMode"] })}>
                <option value="formula">Automatisk: inverterpris × faktor</option>
                <option value="manual">Manuell pris</option>
              </select>
            </label>
            {setup.hybridMode === "formula" ? (
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Faktor
                <input className={`${numCell} w-20`} inputMode="decimal" value={setup.hybridFactor} onChange={(e) => set({ hybridFactor: toNum(e.target.value) })} />
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                Pris eks. mva
                <input className={`${numCell} w-32`} inputMode="decimal" value={setup.hybridManualEx} onChange={(e) => set({ hybridManualEx: toNum(e.target.value) })} />
              </label>
            )}
            <div className="ml-auto text-right">
              <p className="text-lg font-semibold tabular-nums text-ink">{nok(hybridEx)} kr</p>
              <p className="text-xs text-muted">
                eks. mva{business ? "" : ` · ${nok(hybridEx * 1.25)} kr inkl. mva`}
              </p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            {setup.hybridMode === "formula"
              ? inverterSaleEx == null
                ? "Kalkylen har ingen inverter ennå. Legg til en inverter, eller bruk manuell pris."
                : `Inverteren i kalkylen: ${nok(inverterSaleEx)} kr (sum eks. mva) × ${setup.hybridFactor.toLocaleString("nb-NO")}.`
              : "Fast pris uavhengig av inverteren i kalkylen."}
          </p>
        </div>

        {/* Installasjon og anbefaling */}
        <div className="rounded-xl border border-line p-3">
          <p className="sk-label mb-2">Batteripakke som foreslås først</p>
          <div className="grid grid-cols-[minmax(0,1fr)_88px_120px] items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Modell
              <select className={cell} value={setup.recommendedModelId} onChange={(e) => {
                const m = setup.models.find((x) => x.id === e.target.value);
                set({ recommendedModelId: e.target.value, recommendedModules: suggestedModules(m) });
              }}>
                {setup.models.filter((m) => m.enabled).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              {recommended?.structure === "unit" ? "Enheter" : "Moduler"}
              <input
                className={numCell}
                inputMode="numeric"
                value={setup.recommendedModules}
                onChange={(e) => set({ recommendedModules: Math.max(0, Math.round(toNum(e.target.value))) })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              Installasjon eks. mva
              <input className={numCell} inputMode="decimal" value={setup.installEx} onChange={(e) => set({ installEx: toNum(e.target.value) })} />
            </label>
          </div>
          {recommended && (
            <p className="mt-2 text-xs text-muted">
              {recommended.structure === "modular"
                ? `${setup.recommendedModules} × ${recommended.moduleKwh.toLocaleString("nb-NO")} kWh = ${(setup.recommendedModules * recommended.moduleKwh).toLocaleString("nb-NO", { maximumFractionDigits: 1 })} kWh, ${Math.ceil(setup.recommendedModules / Math.max(1, recommended.modulesPerBase))} BMS`
                : `${setup.recommendedModules} × ${recommended.moduleKwh.toLocaleString("nb-NO")} kWh = ${(setup.recommendedModules * recommended.moduleKwh).toLocaleString("nb-NO", { maximumFractionDigits: 1 })} kWh`}
              {" · "}kunden ser {nok(packEx(recommended, setup) * vat)} kr {taxLabel} for batteri og installasjon.
              {(setup.recommendedModules < recommended.min || setup.recommendedModules > recommended.max) &&
                ` Utenfor ${recommended.min}–${recommended.max}, justeres automatisk.`}
            </p>
          )}
        </div>
      </div>

      {/* Modeller */}
      <div className="border-t border-line">
        <div className="flex items-center justify-between px-4 pt-3">
          <p className="sk-label m-0">
            Batterimodeller kunden kan velge mellom <span className="font-normal text-muted">({enabledCount} valgt)</span>
          </p>
          <button type="button" className="sk-btn sk-btn-ghost sk-btn-sm text-brand" onClick={addCustom}>
            <Plus size={14} /> Legg til modell
          </button>
        </div>
        {setup.models.length === 0 ? (
          <p className="m-4 rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-muted">
            Ingen batterier i produktkatalogen for denne installatøren. Legg til en modell her, eller legg batteriene inn i katalogen.
          </p>
        ) : (
          <div className="overflow-x-auto px-4 pb-4 pt-2">
            <table className="w-full min-w-[1150px] text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-12 px-1.5 py-2">Vis</th>
                  <th className="px-1.5 py-2">Modell</th>
                  <th className="w-44 px-1.5 py-2">Oppbygging</th>
                  <th className="w-24 px-1.5 py-2 text-right">kWh / stk</th>
                  <th className="w-28 px-1.5 py-2 text-right">Pris / stk</th>
                  <th className="w-44 px-1.5 py-2">BMS / base</th>
                  <th className="w-28 px-1.5 py-2 text-right">Pris BMS</th>
                  <th className="w-24 px-1.5 py-2 text-right">Stk / BMS</th>
                  <th className="w-20 px-1.5 py-2 text-right">Min</th>
                  <th className="w-20 px-1.5 py-2 text-right">Maks</th>
                  <th className="w-32 px-1.5 py-2 text-right">Kapasitet</th>
                  <th className="w-8 px-1.5 py-2" />
                </tr>
              </thead>
              <tbody>
                {setup.models.map((m) => {
                  const modular = m.structure === "modular";
                  const custom = m.id.startsWith("egen-");
                  return (
                    <tr key={m.id} className={`border-t border-gray-100 ${m.enabled ? "" : "opacity-55"}`}>
                      <td className="px-1.5 py-1.5">
                        <input type="checkbox" className="size-4" checked={m.enabled} aria-label={`Vis ${m.name} for kunden`} onChange={(e) => setModel(m.id, { enabled: e.target.checked })} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input className={cell} value={m.name} aria-label="Modellnavn" onChange={(e) => setModel(m.id, { name: e.target.value })} />
                        {m.moduleKwh <= 0 && <p className="mt-0.5 text-[11px] text-red-600">Mangler kWh – vises ikke for kunden</p>}
                      </td>
                      <td className="px-1.5 py-1.5">
                        <select
                          className={cell}
                          value={m.structure}
                          aria-label="Oppbygging"
                          onChange={(e) => {
                            const structure = e.target.value as BatteryModelSetup["structure"];
                            setModel(m.id, structure === "unit"
                              ? { structure, modulesPerBase: 1 }
                              : { structure, modulesPerBase: m.modulesPerBase > 1 ? m.modulesPerBase : 8 });
                          }}
                        >
                          <option value="modular">Moduler + BMS</option>
                          <option value="unit">Hel enhet (uten BMS)</option>
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input className={numCell} inputMode="decimal" value={m.moduleKwh} aria-label="kWh per stk" onChange={(e) => setModel(m.id, { moduleKwh: toNum(e.target.value) })} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input className={numCell} inputMode="decimal" value={m.moduleEx} aria-label="Pris per stk eks. mva" onChange={(e) => setModel(m.id, { moduleEx: toNum(e.target.value) })} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input className={cell} disabled={!modular} value={modular ? m.bmsName : "—"} placeholder="BMS / base" aria-label="BMS-navn" onChange={(e) => setModel(m.id, { bmsName: e.target.value })} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input className={numCell} disabled={!modular} inputMode="decimal" value={modular ? m.baseEx : 0} aria-label="Pris BMS eks. mva" onChange={(e) => setModel(m.id, { baseEx: toNum(e.target.value) })} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input className={numCell} disabled={!modular} inputMode="numeric" value={modular ? m.modulesPerBase : "—"} aria-label="Moduler per BMS" onChange={(e) => setModel(m.id, { modulesPerBase: Math.max(1, Math.round(toNum(e.target.value))) })} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input className={numCell} inputMode="numeric" value={m.min} aria-label="Minste antall" onChange={(e) => setModel(m.id, { min: Math.max(1, Math.round(toNum(e.target.value))) })} />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input className={numCell} inputMode="numeric" value={m.max} aria-label="Største antall" onChange={(e) => setModel(m.id, { max: Math.max(1, Math.round(toNum(e.target.value))) })} />
                      </td>
                      <td className="px-1.5 py-1.5 text-right text-xs tabular-nums text-muted">
                        {m.moduleKwh > 0 ? capacityRange(m) : "—"}
                        {m.max < m.min && <span className="block text-red-600">maks &lt; min</span>}
                      </td>
                      <td className="px-1.5 py-1.5 text-right">
                        {custom && (
                          <button type="button" className="sk-icon-btn size-7 text-red-600 hover:bg-red-50" aria-label="Fjern modell" onClick={() => set({ models: setup.models.filter((x) => x.id !== m.id) })}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">
              Modulær: kunden velger antall moduler, og det legges til én BMS per {"«Stk / BMS»"} moduler. Hel enhet: kunden velger antall enheter, uten BMS.
              Prisene er hentet fra katalogen med avtalt påslag, og kan overstyres her. Kryss av for modellene som skal vises; uten avkryssede modeller vises bare «Klargjør for batteri».
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/** Batteri + BMS + installasjon for anbefalt pakke, eks. mva. */
function packEx(m: BatteryModelSetup, setup: BatterySetup) {
  const n = Math.max(m.min, Math.min(m.max, setup.recommendedModules));
  const bases = m.structure === "modular" ? Math.ceil(n / Math.max(1, m.modulesPerBase)) : 0;
  return n * m.moduleEx + bases * m.baseEx + setup.installEx;
}
