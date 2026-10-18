"use client";

// «Batteri og hybrid på tilbudet» – settes når estimatet opprettes.
//
// Alt regnes i kalkulatortjenesten (samme vei som grunnkalkylen), her velges bare:
//   - batteritype (HV/LV) og hybridinverter (automatisk = rimeligste egnede, eller manuelt)
//   - påslag på batteri og hybrid (standard = installatørens sats for solcellemateriell)
//   - batteriinstallasjon, modeller kunden kan velge mellom, innkjøpspris og BMS per modell
// Innkjøpspriser og BMS hentes fra produktkatalogen; overstyringer gjelder bare dette tilbudet
// og lagres med kalkylen. Soleklart-satsen ligger inne i kundeprisene og vises ikke for kunden.
import { useState } from "react";
import { ArrowDown, ArrowUp, BatteryCharging, ExternalLink, RotateCcw, Save } from "lucide-react";
import { toast } from "react-toastify";
import { updateSettings, type BatteryOfferConfig, type BatteryOfferResult, type CalcCatalog, type PriceSteps } from "@/lib/calcApi";

interface Props {
  catalog: CalcCatalog;
  config: BatteryOfferConfig;
  onChange: (config: BatteryOfferConfig) => void;
  /** Siste beregning fra tjenesten (null mens den regnes) */
  offer: BatteryOfferResult | null;
  /** Næringskunde: kunden ser priser eks. mva. */
  business: boolean;
}

type ModelConfig = NonNullable<BatteryOfferConfig["models"]>[number];

const kr = (ore: number) => `${Math.round(ore / 100).toLocaleString("nb-NO")} kr`;
const pct = (n: number) => `${n.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} %`;
const kwh = (n: number) => n.toLocaleString("nb-NO", { maximumFractionDigits: 1 });

const cell = "h-8 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-sm text-ink hover:border-gray-300";
const numCell = `${cell} text-right tabular-nums`;
const label = "flex flex-col gap-1 text-xs font-medium text-muted";

/** Tekstfelt som lagres når det forlates (unngår ny beregning per tastetrykk). Tomt = katalogverdi. */
function Commit({
  value,
  placeholder,
  onCommit,
  className = numCell,
  ariaLabel,
}: {
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
  className?: string;
  ariaLabel: string;
}) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);
  return (
    <input
      className={className}
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={focused ? text : value}
      onFocus={() => {
        setText(value);
        setFocused(true);
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        if (text.trim() !== value) onCommit(text.trim().replace(/\s/g, "").replace(",", "."));
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

export default function BatteryOfferSetup({ catalog, config, onChange, offer, business }: Props) {
  const vat = 1 + catalog.settings.vatPercent / 100;
  const taxLabel = business ? "eks. mva." : "inkl. mva.";
  /** Kundepris slik kunden ser den */
  const shown = (customerOre: number) => kr(business ? customerOre : customerOre * vat);

  const set = (patch: Partial<BatteryOfferConfig>) => onChange({ ...config, ...patch });
  const modelCfg = (id: string) => config.models?.find((m) => m.productId === id);
  const setModel = (id: string, patch: Partial<ModelConfig>) => {
    const list = config.models ?? [];
    const next = list.some((m) => m.productId === id)
      ? list.map((m) => (m.productId === id ? { ...m, ...patch } : m))
      : [...list, { productId: id, ...patch }];
    set({ models: next });
  };

  const batteryWork = catalog.workTypes.filter((w) => w.group === "batteri" && w.active && w.priceOre != null);
  const modelIds = new Set(offer?.models.map((m) => m.productId));
  const batteryCategoryIds = new Set(catalog.categories.filter((c) => c.productKind === "batteri").map((c) => c.id));
  const bmsOptions = catalog.products.filter((p) => p.active && batteryCategoryIds.has(p.categoryId) && !modelIds.has(p.id));

  const header = (
    <div className="border-b border-line px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BatteryCharging size={16} className="text-brand" />
          <h3 className="sk-section-title text-sm">Batteri og hybrid på tilbudet</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="sk-btn sk-btn-ghost sk-btn-sm"
            title="Fjern endringene i dette tilbudet og bruk standardoppsettet (Beregningsregler), katalogpriser, prisavtaler og automatisk hybridvalg"
            onClick={() => onChange({ enabled: config.enabled })}
          >
            <RotateCcw size={14} /> Bruk standardoppsettet
          </button>
        </div>
      </div>
      <label className={`mt-3 flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${config.enabled ? "border-green-300 bg-green-50" : "border-line bg-gray-50"}`}>
        <input type="checkbox" className="mt-0.5 size-5" checked={config.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        <span>
          <span className="block text-sm font-semibold text-ink">Tilby oppgradering til hybridinverter og batteri</span>
          <span className="block text-xs text-muted">
            {config.enabled
              ? "På: kunden ser «Klargjør for batteri» (hybridinverter) og batterimodellene som er huket av under, med priser."
              : "Av: kunden ser bare solcelleanlegget. Ingen oppgraderingsvalg og ingen tilleggspriser for hybrid eller batteri."}
          </span>
        </span>
      </label>
    </div>
  );

  if (!config.enabled) {
    return (
      <section className="sk-card overflow-hidden">
        {header}
        <p className="px-4 py-3 text-sm text-muted">Slå på for å velge hybridinverter og batterimodeller kunden kan velge mellom.</p>
      </section>
    );
  }
  if (!offer) {
    return (
      <section className="sk-card overflow-hidden">
        {header}
        <p className="px-4 pb-4 text-sm text-muted">Beregner batteri og hybrid …</p>
      </section>
    );
  }

  const ratePct = offer.commissionRate * 100;
  /** Flytter en modell opp/ned. Gjelder dette tilbudet; «Lagre … som standard» for nye tilbud. */
  const move = (index: number, dir: -1 | 1) => {
    const ids = offer.models.map((m) => m.productId);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    set({ modelOrder: ids, recommendedModelId: null, recommendedModules: null });
  };
  const hybrid = offer.hybrid;
  const fitting = offer.hybridCandidates.filter((c) => c.fits);
  const notFitting = offer.hybridCandidates.filter((c) => !c.fits);
  const recommended = offer.models.find((m) => m.productId === offer.recommended?.model);

  return (
    <section className="sk-card overflow-hidden">
      {header}

      {offer.warnings.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {offer.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Hybrid */}
        <div className="rounded-xl border border-line p-3">
          <p className="sk-label mb-2">Klargjør for batteri (hybridinverter)</p>
          <div className="grid grid-cols-[110px_minmax(0,1fr)] items-end gap-3">
            <label className={label}>
              Batteritype
              <select className={cell} value={offer.batteryClass} onChange={(e) => set({ batteryClass: e.target.value as "HV" | "LV", hybridProductId: null })}>
                <option value="HV">HV (høyvolt)</option>
                <option value="LV">LV (lavvolt)</option>
              </select>
            </label>
            <label className={label}>
              Hybridinverter
              <select
                className={cell}
                disabled={offer.hybridIncluded}
                value={config.hybridCustom ? "__custom" : (config.hybridProductId ?? "")}
                onChange={(e) =>
                  e.target.value === "__custom"
                    ? set({ hybridProductId: null, hybridCustom: { name: hybrid?.name ?? "", price: hybrid ? String(Math.round(hybrid.purchaseOre / 100)) : "", quantity: hybrid?.quantity ?? 1 } })
                    : set({ hybridProductId: e.target.value || null, hybridCustom: null })
                }
              >
                <option value="">Automatisk{hybrid?.auto ? `: ${hybrid.name}` : " (foretrukket, ellers rimeligste egnede)"}</option>
                <option value="__custom">Egen hybridinverter (ikke i katalogen) …</option>
                {fitting.length > 0 && (
                  <optgroup label={`Passer ${offer.batteryClass} og anlegget`}>
                    {fitting.map((c) => (
                      <option key={c.productId} value={c.productId}>
                        {c.preferred ? "★ " : ""}
                        {c.name} · {c.acKw ?? "?"} kW · {c.supplier} · {kr(c.purchaseOre)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {notFitting.length > 0 && (
                  <optgroup label="Passer ikke (nett, batteritype eller PV-effekt)">
                    {notFitting.map((c) => (
                      <option key={c.productId} value={c.productId}>
                        {c.name} · {c.acKw ?? "?"} kW · {c.supplier}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
          </div>

          {!offer.hybridIncluded &&
            (config.hybridCustom ? (
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_120px_80px] items-end gap-3">
                <label className={label}>
                  Navn (vises for kunden)
                  <Commit
                    className={cell}
                    ariaLabel="Navn på egen hybridinverter"
                    value={config.hybridCustom.name}
                    placeholder="F.eks. Deye 50 kW hybrid"
                    onCommit={(v) => set({ hybridCustom: { ...config.hybridCustom!, name: v } })}
                  />
                </label>
                <label className={label}>
                  Innkjøp / stk (kr)
                  <Commit
                    ariaLabel="Innkjøp per stk"
                    value={config.hybridCustom.price}
                    onCommit={(v) => set({ hybridCustom: { ...config.hybridCustom!, price: v } })}
                  />
                </label>
                <label className={label}>
                  Antall
                  <Commit
                    ariaLabel="Antall hybridinvertere"
                    value={String(config.hybridCustom.quantity ?? 1)}
                    onCommit={(v) => {
                      const n = Math.round(Number(v));
                      if (n > 0) set({ hybridCustom: { ...config.hybridCustom!, quantity: n } });
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-[110px_minmax(0,1fr)] items-end gap-3">
                <label className={label}>
                  Antall hybrider
                  <Commit
                    ariaLabel="Antall hybridinvertere"
                    value={config.hybridQuantity ? String(config.hybridQuantity) : ""}
                    placeholder={String(offer.stringInverter?.quantity ?? 1)}
                    onCommit={(v) => {
                      const n = Math.round(Number(v));
                      set({ hybridQuantity: v === "" || !(n > 0) ? null : n });
                    }}
                  />
                </label>
                <span className="pb-2 text-[11px] text-muted">
                  Tomt = like mange som stringinvertere i grunnpakken ({offer.stringInverter?.quantity ?? 1}). Hver hybrid må tåle sin andel av anlegget.
                </span>
              </div>
            ))}

          {offer.hybridIncluded ? (
            <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-900">
              Hybridinverteren ({hybrid?.name}) er valgt i grunnpakken. «Klargjør for batteri» koster da 0 kr ekstra.
            </p>
          ) : hybrid ? (
            <table className="mt-3 w-full text-xs tabular-nums">
              <tbody>
                <tr>
                  <td className="py-0.5 text-muted">Stringinverter i grunnpakken</td>
                  <td className="py-0.5 text-right">{offer.stringInverter ? `${offer.stringInverter.name} · ${offer.stringInverter.acKw ?? "?"} kW` : "—"}</td>
                </tr>
                <tr>
                  <td className="py-0.5 text-muted">
                    Hybrid {hybrid.custom ? "(egen, ikke i katalogen)" : hybrid.auto ? `(automatisk${hybrid.preferred ? ", foretrukket" : ""})` : "(valgt manuelt)"}
                  </td>
                  <td className="py-0.5 text-right">
                    {hybrid.quantity > 1 ? `${hybrid.quantity} × ` : ""}
                    {hybrid.name}
                    {hybrid.acKw ? ` · ${hybrid.acKw} kW` : ""}
                    {hybrid.batteryClass ? ` · ${hybrid.batteryClass}` : ""}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 text-muted">Hybrid innkjøp + {pct(offer.materialMarkupPercent)} påslag</td>
                  <td className="py-0.5 text-right">
                    {hybrid.quantity > 1 ? `${hybrid.quantity} × ` : ""}
                    {kr(hybrid.purchaseOre)} → {kr(hybrid.saleOre)}
                  </td>
                </tr>
                <tr>
                  <td className="py-0.5 text-muted">− stringinverter(e) som byttes ut (salg i grunnpakken)</td>
                  <td className="py-0.5 text-right">
                    −{Math.min(hybrid.quantity, offer.stringInverter?.quantity ?? 1) > 1 ? `${Math.min(hybrid.quantity, offer.stringInverter?.quantity ?? 1)} × ` : ""}
                    {kr(offer.stringInverter?.saleUnitOre ?? 0)}
                  </td>
                </tr>
                <tr className="border-t border-gray-100 font-semibold text-ink">
                  <td className="pt-1">Mellomlegg til kunden {taxLabel}</td>
                  <td className="pt-1 text-right text-sm">{shown(offer.upgrade.customerOre)}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="mt-3 text-xs text-muted">Ingen hybridinverter valgt.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {offer.stringInverter?.datasheetUrl && (
              <a className="inline-flex items-center gap-1 text-brand underline" href={offer.stringInverter.datasheetUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={12} /> Produktblad stringinverter
              </a>
            )}
            {hybrid?.datasheetUrl && (
              <a className="inline-flex items-center gap-1 text-brand underline" href={hybrid.datasheetUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={12} /> Produktblad hybrid
              </a>
            )}
          </div>
        </div>

        {/* Påslag, installasjon og anbefaling */}
        <div className="rounded-xl border border-line p-3">
          <p className="sk-label mb-2">Påslag, installasjon og forslag</p>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Påslag batteri og hybrid %
              <Commit
                ariaLabel="Påslag batteri og hybrid i prosent"
                value={config.markupPercent ?? ""}
                placeholder={`${catalog.markups.solcellemateriell ?? 0} (avtale)`}
                onCommit={(v) => set({ markupPercent: v === "" ? null : v })}
              />
              <span className="text-[11px] font-normal">
                {offer.materialMarkupOverridden ? `Overstyrt. Avtalen er ${pct(catalog.markups.solcellemateriell ?? 0)}.` : `Fra prisavtalen (solcellemateriell) hos ${catalog.installer.name}.`}
              </span>
            </label>
            <label className={label}>
              Installasjon av batteri
              <select className={cell} value={config.installWorkTypeId ?? offer.install?.workTypeId ?? ""} onChange={(e) => set({ installWorkTypeId: e.target.value || null })}>
                {batteryWork.length === 0 && <option value="">Ingen avtalt sats</option>}
                {batteryWork.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} · {kr(w.priceOre!)}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Installasjon, overstyr sats (kr)
              <Commit
                ariaLabel="Overstyr installasjonssats"
                value={config.installPrice ?? ""}
                placeholder={offer.install ? String(Math.round(offer.install.purchaseOre / 100)) : ""}
                onCommit={(v) => set({ installPrice: v === "" ? null : v })}
              />
            </label>
            <div className="text-right text-xs text-muted">
              {offer.install && (
                <>
                  {kr(offer.install.purchaseOre)} + {pct(offer.elektroMarkupPercent)} = {kr(offer.install.saleOre)}
                  <p className="text-sm font-semibold text-ink">{shown(offer.install.customerOre)}</p>
                  <span>{taxLabel} til kunden</span>
                </>
              )}
            </div>
            <label className={label}>
              Batteri som foreslås først
              <select
                className={cell}
                value={offer.recommended?.model ?? ""}
                onChange={(e) => set({ recommendedModelId: e.target.value || null, recommendedModules: null })}
              >
                {offer.models
                  .filter((m) => m.enabled)
                  .map((m) => (
                    <option key={m.productId} value={m.productId}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className={label}>
              {recommended?.structure === "unit" ? "Antall enheter" : "Antall moduler"}
              <Commit
                ariaLabel="Antall i forslaget"
                value={String(offer.recommended?.modules ?? "")}
                onCommit={(v) => {
                  const n = Math.round(Number(v));
                  set({ recommendedModules: Number.isFinite(n) && n > 0 ? n : null });
                }}
              />
              {recommended && offer.recommended && (
                <span className="text-[11px] font-normal">
                  = {kwh(offer.recommended.modules * recommended.moduleKwh)} kWh (tillatt {recommended.min}–{recommended.max})
                </span>
              )}
            </label>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Kundeprisene inkluderer Soleklart-satsen fra grunnkalkylen ({pct(ratePct)}), så kommisjonen følger med når kunden velger batteri, flere moduler eller hybrid. Satsen vises ikke for kunden.
          </p>
        </div>
      </div>

      {/* Modeller */}
      <div className="border-t border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
          <p className="sk-label m-0">
            Batterimodeller kunden kan velge mellom{" "}
            <span className="font-normal text-muted">
              ({offer.models.filter((m) => m.enabled).length} valgt · vises for kunden i denne rekkefølgen, øverste foreslås først)
            </span>
          </p>
          {catalog.canEdit && (
            <button
              type="button"
              className="sk-btn sk-btn-secondary sk-btn-sm"
              title="Nye tilbud starter med disse modellene i denne rekkefølgen, og med batteri/hybrid slått på. Dette tilbudet endres ikke."
              onClick={() =>
                updateSettings({ batteryDefaults: { offerEnabled: config.enabled, models: offer.models.filter((m) => m.enabled).map((m) => m.productId) } })
                  .then(() => toast.success("Lagret som standard for nye tilbud."))
                  .catch((e: Error) => toast.error(e.message))
              }
            >
              <Save size={14} /> Lagre utvalg og rekkefølge som standard
            </button>
          )}
        </div>
        {offer.models.length === 0 ? (
          <p className="m-4 rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-muted">
            Ingen batterier i produktkatalogen for {catalog.installer.name}. Legg batteriene (og BMS) inn under Prisoppsett → Katalog.
          </p>
        ) : (
          <div className="overflow-x-auto px-4 pb-4 pt-2">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-16 px-1.5 py-2">Rekkefølge</th>
                  <th className="w-12 px-1.5 py-2">Vis</th>
                  <th className="px-1.5 py-2">Modell</th>
                  <th className="w-28 px-1.5 py-2 text-right">Innkjøp / stk</th>
                  <th className="w-56 px-1.5 py-2">BMS</th>
                  <th className="w-28 px-1.5 py-2 text-right">Innkjøp BMS</th>
                  <th className="w-20 px-1.5 py-2 text-right">Stk / BMS</th>
                  <th className="w-16 px-1.5 py-2 text-right">Min</th>
                  <th className="w-16 px-1.5 py-2 text-right">Maks</th>
                  <th className="w-40 px-1.5 py-2 text-right">Kunden ser ({taxLabel})</th>
                </tr>
              </thead>
              <tbody>
                {offer.models.map((m, i) => {
                  const cfg = modelCfg(m.productId);
                  const priceCell = (steps: PriceSteps) => `${kr(steps.purchaseOre)} → ${kr(steps.saleOre)}`;
                  return (
                    <tr key={m.productId} className={`border-t border-gray-100 align-top ${m.enabled ? "" : "opacity-55"}`}>
                      <td className="px-1.5 py-1.5 whitespace-nowrap">
                        <button type="button" className="sk-icon-btn size-7" aria-label={`Flytt ${m.name} opp`} disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="sk-icon-btn size-7"
                          aria-label={`Flytt ${m.name} ned`}
                          disabled={i === offer.models.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={m.enabled}
                          aria-label={`Vis ${m.name} for kunden`}
                          onChange={(e) => setModel(m.productId, { enabled: e.target.checked })}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <p className="font-medium text-ink">{m.name}</p>
                        <p className="text-[11px] text-muted">
                          {m.batteryClass ?? "type mangler"} · {kwh(m.moduleKwh)} kWh/{m.structure === "modular" ? "modul" : "enhet"} · {kwh(m.min * m.moduleKwh)}–
                          {kwh(m.max * m.moduleKwh)} kWh
                          {m.datasheetUrl && (
                            <>
                              {" · "}
                              <a className="text-brand underline" href={m.datasheetUrl} target="_blank" rel="noreferrer">
                                produktblad
                              </a>
                            </>
                          )}
                        </p>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <Commit
                          ariaLabel={`Innkjøp per stk ${m.name}`}
                          value={cfg?.modulePrice ?? ""}
                          placeholder={String(Math.round(m.module.purchaseOre / 100))}
                          onCommit={(v) => setModel(m.productId, { modulePrice: v === "" ? null : v })}
                        />
                        <p className="mt-0.5 text-right text-[11px] text-muted">{m.modulePriceOverridden ? "overstyrt" : "katalog"}</p>
                      </td>
                      <td className="px-1.5 py-1.5">
                        <select
                          className={cell}
                          aria-label={`BMS for ${m.name}`}
                          value={cfg?.bmsProductId === null ? "none" : (cfg?.bmsProductId ?? m.bms?.productId ?? "")}
                          onChange={(e) => setModel(m.productId, { bmsProductId: e.target.value === "none" ? null : e.target.value || undefined })}
                        >
                          <option value="">{m.bms?.productId ? "Automatisk" : "Ingen funnet (automatisk)"}</option>
                          <option value="none">Ingen BMS (hel enhet)</option>
                          {bmsOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {kr(p.priceOre)}
                            </option>
                          ))}
                        </select>
                        {m.bms && <p className="mt-0.5 text-[11px] text-muted">{m.bms.name}</p>}
                      </td>
                      <td className="px-1.5 py-1.5">
                        <Commit
                          ariaLabel={`Innkjøp BMS ${m.name}`}
                          value={cfg?.bmsPrice ?? ""}
                          placeholder={m.bms ? String(Math.round(m.bms.purchaseOre / 100)) : "—"}
                          onCommit={(v) => setModel(m.productId, { bmsPrice: v === "" ? null : v })}
                        />
                        {m.bms && <p className="mt-0.5 text-right text-[11px] text-muted">{m.bms.overridden ? "overstyrt" : "katalog"}</p>}
                      </td>
                      <td className="px-1.5 py-1.5">
                        <Commit
                          ariaLabel={`Moduler per BMS ${m.name}`}
                          value={m.structure === "modular" ? String(m.modulesPerBms) : "—"}
                          onCommit={(v) => {
                            const n = Math.round(Number(v));
                            if (n > 0) setModel(m.productId, { modulesPerBms: n });
                          }}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <Commit
                          ariaLabel={`Minste antall ${m.name}`}
                          value={String(m.min)}
                          onCommit={(v) => {
                            const n = Math.round(Number(v));
                            if (n > 0) setModel(m.productId, { min: n });
                          }}
                        />
                      </td>
                      <td className="px-1.5 py-1.5">
                        <Commit
                          ariaLabel={`Største antall ${m.name}`}
                          value={String(m.max)}
                          onCommit={(v) => {
                            const n = Math.round(Number(v));
                            if (n > 0) setModel(m.productId, { max: n });
                          }}
                        />
                      </td>
                      <td className="px-1.5 py-1.5 text-right text-xs tabular-nums">
                        <p className="text-muted" title="Innkjøp → etter installatørens påslag">
                          {priceCell(m.module)}
                        </p>
                        <p className="font-semibold text-ink">{shown(m.module.customerOre)} / stk</p>
                        {m.bms && (
                          <>
                            <p className="mt-1 text-muted">{priceCell(m.bms)}</p>
                            <p className="font-semibold text-ink">{shown(m.bms.customerOre)} / BMS</p>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">
              Innkjøp hentes fra katalogen; tomt felt = katalogpris. Påslaget ({pct(offer.materialMarkupPercent)}) legges på innkjøp av moduler, BMS og hybrid.
              BMS kobles fast til batteriet i katalogen (Prisoppsett → Katalog → batteriet → «BMS»), eller velges her for dette tilbudet. Modulær: én BMS per «Stk / BMS» moduler.
              Uten avkryssede modeller vises bare «Klargjør for batteri».
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
