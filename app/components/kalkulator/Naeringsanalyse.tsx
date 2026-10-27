"use client";

// Næringsanalyse på estimatet (trinn 1: solceller for næringsbygg).
// Selger fyller inn så mye som er kjent; resten foreslås og merkes som antatt.
// Analysen regnes i kalkulatortjenesten time for time og låses sammen med estimatet ved «Opprett estimat».
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  BUSINESS_TYPES,
  GOALS,
  createBusinessAnalysis,
  createTariff,
  geocodeAddress,
  getBusinessAnalysis,
  getTariffs,
  importBusinessSeries,
  runBusinessAnalysis,
  saveBusinessAnalysis,
  setSeriesActive,
  uploadBusinessFile,
  type BusinessAnalysis,
  type BusinessSeries,
  type BusinessSettings,
  type BusinessSummary,
  type DataStatus,
  type PriceArea,
  type QualityReport,
  type RunResult,
  type Surface,
  type Tariff,
  type UploadResult,
} from "@/lib/naeringApi";
import type { Roof } from "../SolarDataView";
import { Help } from "./fields";
import s from "./kalkulator.module.css";

interface Props {
  leadId: string;
  installerGroupId: string;
  /** Kalkylens installerte effekt */
  kwp: number | null;
  /** Kalkylens sum eks. mva. (øre). null når den ikke kan brukes (f.eks. batteri i kalkylen) */
  investmentOre: number | null;
  investmentNote?: string;
  /** Takflater fra solkartet */
  roofs?: Roof[];
  address?: string;
  /** Analysen som skal låses med estimatet (null = ingen) */
  onAnalysis?: (id: string | null) => void;
}

const nf = (n: number, d = 0) => n.toLocaleString("nb-NO", { minimumFractionDigits: d, maximumFractionDigits: d });
const kr = (n: number | null | undefined) => (n == null ? "—" : `${nf(Math.round(n))} kr`);
const kwh = (n: number) => `${nf(Math.round(n))} kWh`;
const pct = (x: number) => `${nf(x * 100, 0)} %`;
const MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
const COMPASS = (az: number) => ["nord", "nordøst", "øst", "sørøst", "sør", "sørvest", "vest", "nordvest"][Math.round((((az % 360) + 360) % 360) / 45) % 8];
const lastFullYear = new Date().getFullYear() - 1;
const YEARS = Array.from({ length: lastFullYear - 2022 + 1 }, (_, i) => lastFullYear - i);

/** Takflater fra solkartet. Flate tak (< 5°) regnes med 15° stativ, som i solkartet. */
function surfacesFromRoofs(roofs: Roof[] = []): Surface[] {
  return roofs
    .filter((r) => (r.adjustedPanelCount ?? 0) > 0)
    .map((r, i) => {
      const az = Number(r.direction);
      return {
        id: r.roofId || `tak-${i + 1}`,
        label: `Takflate ${i + 1}${Number.isFinite(az) ? ` (${COMPASS(az)})` : ""}`,
        panels: r.adjustedPanelCount,
        kwp: null,
        tiltDeg: r.angle < 5 ? 15 : Math.round(r.angle),
        azimuthDeg: Number.isFinite(az) ? Math.round(az) : 180,
      };
    });
}

function StatusPill({ status }: { status: DataStatus }) {
  const cls = status === "målt" ? s.st_measured : status === "beregnet" ? s.st_calculated : s.st_assumed;
  return <span className={`${s.pill} ${cls}`}>{status}</span>;
}

/** Tallfelt som lagrer ved blur/Enter. Tomt = null. */
function NumField({
  value,
  onCommit,
  suffix,
  width = 90,
  placeholder,
  ariaLabel,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  suffix?: string;
  width?: number;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value).replace(".", ","));
  useEffect(() => setText(value == null ? "" : String(value).replace(".", ",")), [value]);
  const commit = () => {
    const t = text.trim().replace(/\s/g, "").replace(",", ".");
    if (t === "") return value != null && onCommit(null);
    const n = Number(t);
    if (!Number.isFinite(n)) {
      toast.error("Ugyldig tall");
      return setText(value == null ? "" : String(value));
    }
    if (n !== value) onCommit(n);
  };
  return (
    <span className={s.inputwrap}>
      <input
        aria-label={ariaLabel}
        className={s.input}
        style={{ width, textAlign: "right" }}
        inputMode="decimal"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      {suffix && <span className={s.suffix}>{suffix}</span>}
    </span>
  );
}

export default function Naeringsanalyse({ leadId, installerGroupId, kwp, investmentOre, investmentNote, roofs, address, onAnalysis }: Props) {
  const [analysis, setAnalysis] = useState<BusinessAnalysis | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [series, setSeries] = useState<BusinessSeries[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"lagret" | "lagrer" | "endret">("lagret");
  const [run, setRun] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [stale, setStale] = useState(false);
  const lockRef = useRef(1);

  // ---- last inn (eller opprett) analysen for leaden
  const reload = useCallback(async () => {
    try {
      const [res, t] = await Promise.all([getBusinessAnalysis(leadId), getTariffs(installerGroupId)]);
      setTariffs(t);
      let a = res.analysis;
      if (!a) {
        a = await createBusinessAnalysis(leadId);
        const surfaces = surfacesFromRoofs(roofs);
        const next = {
          ...a.settings,
          location: { ...a.settings.location, address: a.settings.location.address || address || "" },
          production: { ...a.settings.production, surfaces },
          meteringPoint: { ...a.settings.meteringPoint, tariffId: t.length === 1 ? t[0].id : null },
        };
        a = await saveBusinessAnalysis(a.id, a.lockVersion, next);
      }
      lockRef.current = a.lockVersion;
      setAnalysis(a);
      setSettings(a.settings);
      setSeries(res.series);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, installerGroupId]);
  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    onAnalysis?.(enabled && analysis ? analysis.id : null);
  }, [enabled, analysis, onAnalysis]);

  // ---- lagring (debounce)
  const pending = useRef<BusinessSettings | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(async () => {
    if (!analysis || !pending.current) return;
    const next = pending.current;
    pending.current = null;
    setSaveState("lagrer");
    try {
      const saved = await saveBusinessAnalysis(analysis.id, lockRef.current, next);
      lockRef.current = saved.lockVersion;
      setSaveState(pending.current ? "endret" : "lagret");
    } catch (e) {
      toast.error(`Næringsanalysen ble ikke lagret: ${(e as Error).message}`);
      setSaveState("endret");
      if (/endret av noen andre/.test((e as Error).message)) reload();
    }
  }, [analysis, reload]);
  const update = (fn: (x: BusinessSettings) => BusinessSettings) => {
    setSettings((cur) => {
      if (!cur) return cur;
      const next = fn(cur);
      pending.current = next;
      setSaveState("endret");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 500);
      return next;
    });
    setStale(true);
  };

  const doRun = async (refresh: boolean) => {
    if (!analysis) return;
    if (timer.current) clearTimeout(timer.current);
    await flush();
    setRunning(true);
    setRunError(null);
    try {
      setRun(await runBusinessAnalysis(analysis.id, { kwp, investmentOre, refresh }));
      setStale(false);
    } catch (e) {
      setRunError((e as Error).message);
      setRun(null);
    } finally {
      setRunning(false);
    }
  };

  const activeLoad = series.find((x) => x.kind === "forbruk" && x.active);
  const activeProd = series.find((x) => x.kind === "produksjon" && x.active);

  if (loadError)
    return (
      <div className={s.panel}>
        <div className={s.panelbody}>
          <div className={`${s.notice} ${s.error}`}>Næringsanalysen kunne ikke lastes: {loadError}</div>
          <button className={s.btn} onClick={reload}>
            Prøv igjen
          </button>
        </div>
      </div>
    );
  if (!settings || !analysis) return <div className={s.panel}><div className={s.panelbody}>Laster næringsanalyse …</div></div>;

  const st = settings;
  const typeInfo = BUSINESS_TYPES.find((b) => b.value === st.businessType)!;
  const hours = st.openHours ?? typeInfo.hours;

  return (
    <section className={s.panel}>
      <div className={s.panelhead}>
        <div>
          <h2>Næringsanalyse – lønnsomhet time for time</h2>
          <div className={`${s.small} ${s.muted}`}>
            Følger estimatet og låses når estimatet opprettes. {saveState === "lagret" ? "Lagret." : saveState === "lagrer" ? "Lagrer …" : "Ulagrede endringer."}
          </div>
        </div>
        <label className={s.check}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Ta med i tilbudet
        </label>
      </div>

      <div className={s.panelbody}>
        <div className={s.nagrid}>
          {/* ---------------- Virksomhet */}
          <fieldset className={s.nabox}>
            <legend>Virksomhet og mål</legend>
            <div className={s.fields}>
              <label>
                Virksomhetstype
                <select
                  className={s.input}
                  value={st.businessType}
                  onChange={(e) => update((x) => ({ ...x, businessType: e.target.value as BusinessSettings["businessType"], openHours: null }))}
                >
                  {BUSINESS_TYPES.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Driftstid fra
                <NumField value={hours[0]} width={60} suffix="kl." onCommit={(v) => update((x) => ({ ...x, openHours: [Math.max(0, Math.min(24, v ?? 0)), hours[1]] }))} />
              </label>
              <label>
                Driftstid til
                <NumField value={hours[1]} width={60} suffix="kl." onCommit={(v) => update((x) => ({ ...x, openHours: [hours[0], Math.max(0, Math.min(24, v ?? 24))] }))} />
              </label>
            </div>
            <div className={s.chips} style={{ marginTop: 10 }}>
              {GOALS.map((g) => {
                const on = st.goals.includes(g.value);
                return (
                  <button
                    key={g.value}
                    type="button"
                    className={`${s.chip} ${on ? s.chipon : ""}`}
                    onClick={() => update((x) => ({ ...x, goals: on ? x.goals.filter((v) => v !== g.value) : [...x.goals, g.value] }))}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
            {(st.goals.includes("lading") || st.goals.includes("nødstrøm") || st.goals.includes("effekt")) && (
              <p className={`${s.small} ${s.muted}`}>Batteri, lading og nødstrøm beregnes i neste trinn. Nå beregnes solceller alene.</p>
            )}
          </fieldset>

          {/* ---------------- Sted og periode */}
          <fieldset className={s.nabox}>
            <legend>Sted og periode</legend>
            <div className={s.fields}>
              <label className={s.wide}>
                Adresse
                <div className={s.inline} style={{ width: "100%" }}>
                  <input
                    className={s.input}
                    style={{ flex: 1 }}
                    defaultValue={st.location.address}
                    onBlur={(e) =>
                      e.target.value !== st.location.address &&
                      update((x) => ({ ...x, location: { ...x.location, address: e.target.value, lat: null, lon: null, priceAreaSource: "foreslått", priceArea: x.location.priceAreaSource === "valgt" ? x.location.priceArea : null } }))
                    }
                  />
                  <button
                    type="button"
                    className={`${s.btn} ${s.small2}`}
                    onClick={async () => {
                      try {
                        const g = await geocodeAddress(st.location.address);
                        update((x) => ({
                          ...x,
                          location: { ...x.location, lat: g.lat, lon: g.lon, priceArea: x.location.priceAreaSource === "valgt" ? x.location.priceArea : g.priceArea, priceAreaSource: x.location.priceAreaSource },
                        }));
                        toast.info(`Fant ${g.address} (${g.municipality})${g.priceArea ? ` – foreslått ${g.priceArea}` : ""}.`);
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    Finn
                  </button>
                </div>
                {st.location.lat != null && (
                  <span className={`${s.small} ${s.muted}`} style={{ fontWeight: 400 }}>
                    {nf(st.location.lat, 4)}, {nf(st.location.lon ?? 0, 4)}
                  </span>
                )}
              </label>
              <label>
                Prisområde
                <select
                  className={s.input}
                  value={st.location.priceArea ?? ""}
                  onChange={(e) => update((x) => ({ ...x, location: { ...x.location, priceArea: (e.target.value || null) as PriceArea | null, priceAreaSource: "valgt" } }))}
                >
                  <option value="">Foreslå fra adresse</option>
                  {(["NO1", "NO2", "NO3", "NO4", "NO5"] as const).map((a) => (
                    <option key={a} value={a}>
                      {a}
                      {st.location.priceArea === a && st.location.priceAreaSource === "foreslått" ? " (foreslått – kontroller)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Beregn med
                <select
                  className={s.input}
                  value={st.period.kind}
                  onChange={(e) => {
                    const now = new Date();
                    update((x) => ({
                      ...x,
                      period:
                        e.target.value === "år"
                          ? { kind: "år", year: lastFullYear }
                          : { kind: "hittil", year: now.getFullYear(), toMonth: now.getMonth() + 1, toDay: Math.max(1, now.getDate() - 1) },
                    }));
                  }}
                >
                  <option value="år">Et helt år</option>
                  <option value="hittil">Hittil i år</option>
                </select>
              </label>
              <label>
                {st.period.kind === "år" ? "År (priser)" : "Til og med"}
                {st.period.kind === "år" ? (
                  <select className={s.input} value={st.period.year} onChange={(e) => update((x) => ({ ...x, period: { kind: "år", year: Number(e.target.value) } }))}>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    className={s.input}
                    value={`${st.period.year}-${String(st.period.toMonth).padStart(2, "0")}-${String(st.period.toDay).padStart(2, "0")}`}
                    onChange={(e) => {
                      const [y, m, d] = e.target.value.split("-").map(Number);
                      if (y && m && d) update((x) => ({ ...x, period: { kind: "hittil", year: y, toMonth: m, toDay: d } }));
                    }}
                  />
                )}
              </label>
            </div>
          </fieldset>

          {/* ---------------- Forbruk */}
          <fieldset className={`${s.nabox} ${s.wide}`}>
            <legend>Forbruk</legend>
            <div className={s.chips}>
              {(
                [
                  [1, "Årsforbruk (raskt estimat)"],
                  [2, "Månedsforbruk"],
                  [3, "Målte timeverdier (fil)"],
                ] as const
              ).map(([lvl, label]) => (
                <button key={lvl} type="button" className={`${s.chip} ${st.consumption.level === lvl ? s.chipon : ""}`} onClick={() => update((x) => ({ ...x, consumption: { ...x.consumption, level: lvl } }))}>
                  {label}
                </button>
              ))}
            </div>
            {st.consumption.level === 1 && (
              <div className={s.fields}>
                <label>
                  Årsforbruk
                  <NumField value={st.consumption.annualKwh} width={120} suffix="kWh" onCommit={(v) => update((x) => ({ ...x, consumption: { ...x.consumption, annualKwh: v } }))} />
                </label>
                <label>
                  Kilde
                  <select
                    className={s.input}
                    value={st.consumption.annualKwhStatus}
                    onChange={(e) => update((x) => ({ ...x, consumption: { ...x.consumption, annualKwhStatus: e.target.value as DataStatus } }))}
                  >
                    <option value="antatt">Anslag</option>
                    <option value="målt">Fra faktura / nettselskap</option>
                  </select>
                </label>
                <p className={`${s.small} ${s.muted} ${s.wide}`} style={{ margin: 0 }}>
                  Fordeles over døgn og år med standardprofil for {typeInfo.label.toLowerCase()} (driftstid {hours[0]}–{hours[1]}, helg og helligdager lavere, mer om vinteren). Merkes som anslått.
                </p>
              </div>
            )}
            {st.consumption.level === 2 && (
              <div className={s.monthgrid}>
                {MONTHS.map((m, i) => (
                  <label key={m}>
                    {m}
                    <NumField
                      value={st.consumption.monthlyKwh?.[i] ?? null}
                      width={84}
                      onCommit={(v) =>
                        update((x) => {
                          const arr = [...(x.consumption.monthlyKwh ?? Array(12).fill(0))];
                          arr[i] = v ?? 0;
                          return { ...x, consumption: { ...x.consumption, monthlyKwh: arr } };
                        })
                      }
                    />
                  </label>
                ))}
                <p className={`${s.small} ${s.muted}`} style={{ gridColumn: "1 / -1", margin: 0 }}>
                  kWh per måned (f.eks. fra fakturaer). Fordelingen over døgnet er anslått.
                </p>
              </div>
            )}
            {st.consumption.level === 3 && (
              <SeriesBlock
                kind="forbruk"
                analysisId={analysis.id}
                active={activeLoad}
                all={series.filter((x) => x.kind === "forbruk")}
                onChanged={reload}
                onMeter={(meterId) => meterId && !st.meteringPoint.meterId && update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, meterId } }))}
              />
            )}
          </fieldset>

          {/* ---------------- Produksjon */}
          <fieldset className={`${s.nabox} ${s.wide}`}>
            <legend>Solproduksjon</legend>
            <div className={s.chips}>
              <button type="button" className={`${s.chip} ${st.production.source === "pvgis" ? s.chipon : ""}`} onClick={() => update((x) => ({ ...x, production: { ...x.production, source: "pvgis" } }))}>
                Simulert (PVGIS)
              </button>
              <button type="button" className={`${s.chip} ${st.production.source === "fil" ? s.chipon : ""}`} onClick={() => update((x) => ({ ...x, production: { ...x.production, source: "fil" } }))}>
                Leverandørens fil
              </button>
            </div>
            {st.production.source === "pvgis" ? (
              <>
                <div className={s.tablewrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Takflate</th>
                        <th className={s.num}>Paneler</th>
                        <th className={s.num}>
                          kWp <Help text="Tomt = kalkylens kWp fordelt etter antall paneler" />
                        </th>
                        <th className={s.num}>Helning</th>
                        <th className={s.num}>
                          Retning <Help text="Grader fra nord: 90 øst, 180 sør, 270 vest" />
                        </th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {st.production.surfaces.map((f, i) => {
                        const set = (patch: Partial<Surface>) =>
                          update((x) => ({ ...x, production: { ...x.production, surfaces: x.production.surfaces.map((y, j) => (j === i ? { ...y, ...patch } : y)) } }));
                        return (
                          <tr key={f.id}>
                            <td>
                              <input className={s.input} defaultValue={f.label} onBlur={(e) => e.target.value !== f.label && set({ label: e.target.value })} />
                            </td>
                            <td className={s.num}>
                              <NumField value={f.panels} width={64} onCommit={(v) => set({ panels: v == null ? null : Math.round(v) })} />
                            </td>
                            <td className={s.num}>
                              <NumField value={f.kwp} width={70} placeholder="auto" onCommit={(v) => set({ kwp: v })} />
                            </td>
                            <td className={s.num}>
                              <NumField value={f.tiltDeg} width={54} suffix="°" onCommit={(v) => set({ tiltDeg: Math.max(0, Math.min(90, v ?? 0)) })} />
                            </td>
                            <td className={s.num}>
                              <NumField value={f.azimuthDeg} width={60} suffix={`° ${COMPASS(f.azimuthDeg)}`} onCommit={(v) => set({ azimuthDeg: (((v ?? 180) % 360) + 360) % 360 })} />
                            </td>
                            <td className={s.rowactions2}>
                              <button
                                type="button"
                                className={`${s.btn} ${s.ghost} ${s.danger}`}
                                onClick={() => update((x) => ({ ...x, production: { ...x.production, surfaces: x.production.surfaces.filter((_, j) => j !== i) } }))}
                              >
                                Fjern
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!st.production.surfaces.length && (
                        <tr>
                          <td colSpan={6} className={s.muted}>
                            Ingen takflater. Beregningen antar da én flate mot sør med 15° helning.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className={s.inline} style={{ marginTop: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`${s.btn} ${s.small2}`}
                    onClick={() =>
                      update((x) => ({
                        ...x,
                        production: { ...x.production, surfaces: [...x.production.surfaces, { id: `tak-${Date.now()}`, label: `Takflate ${x.production.surfaces.length + 1}`, panels: null, kwp: null, tiltDeg: 15, azimuthDeg: 180 }] },
                      }))
                    }
                  >
                    Legg til takflate
                  </button>
                  {roofs?.length ? (
                    <button type="button" className={`${s.btn} ${s.small2}`} onClick={() => update((x) => ({ ...x, production: { ...x.production, surfaces: surfacesFromRoofs(roofs) } }))}>
                      Hent fra solkartet
                    </button>
                  ) : null}
                  <span className={`${s.small} ${s.muted}`}>
                    Kalkylen: {kwp != null ? `${nf(kwp, 2)} kWp` : "ingen paneler"} · Systemtap
                  </span>
                  <NumField value={st.production.lossPct} width={50} suffix="%" onCommit={(v) => update((x) => ({ ...x, production: { ...x.production, lossPct: v ?? 14 } }))} />
                  <span className={`${s.small} ${s.muted}`}>· Værår</span>
                  <select
                    className={s.input}
                    value={st.production.weatherYear ?? ""}
                    onChange={(e) => update((x) => ({ ...x, production: { ...x.production, weatherYear: e.target.value ? Number(e.target.value) : null } }))}
                  >
                    <option value="">Samme som prisene</option>
                    {Array.from({ length: 2025 - 2014 + 1 }, (_, i) => 2025 - i).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <SeriesBlock kind="produksjon" analysisId={analysis.id} active={activeProd} all={series.filter((x) => x.kind === "produksjon")} onChanged={reload} />
            )}
          </fieldset>

          {/* ---------------- Nett og avtaler */}
          <fieldset className={`${s.nabox} ${s.wide}`}>
            <legend>Nettleie og strømavtaler</legend>
            <div className={s.fields}>
              <label className={s.wide}>
                Nettariff
                <div className={s.inline} style={{ width: "100%" }}>
                  <select
                    className={s.input}
                    style={{ flex: 1 }}
                    value={st.meteringPoint.tariffId ?? ""}
                    onChange={(e) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, tariffId: e.target.value || null } }))}
                  >
                    <option value="">Velg tariff …</option>
                    {tariffs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.gridOwner} – {t.name} ({t.validFrom.slice(0, 4)}
                        {t.validTo && t.validTo.slice(0, 4) !== t.validFrom.slice(0, 4) ? `–${t.validTo.slice(0, 4)}` : ""}){t.isManual ? " · manuell" : ""}
                      </option>
                    ))}
                  </select>
                  <ManualTariff installerGroupId={installerGroupId} onCreated={(t) => (setTariffs((l) => [...l, t]), update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, tariffId: t.id } })))} />
                </div>
                <TariffInfo tariff={tariffs.find((t) => t.id === st.meteringPoint.tariffId)} year={st.period.year} />
              </label>
              <label>
                Påslag kjøp
                <NumField value={st.meteringPoint.buy.markupOrePerKwh} width={70} suffix="øre/kWh" onCommit={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, buy: { ...x.meteringPoint.buy, markupOrePerKwh: v ?? 0 } } }))} />
              </label>
              <label>
                Fast månedsbeløp kraft
                <NumField value={st.meteringPoint.buy.monthlyFeeNok} width={70} suffix="kr/mnd" onCommit={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, buy: { ...x.meteringPoint.buy, monthlyFeeNok: v ?? 0 } } }))} />
              </label>
              <label>
                Kjøpsavtale
                <select
                  className={s.input}
                  value={st.meteringPoint.buy.status}
                  onChange={(e) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, buy: { ...x.meteringPoint.buy, status: e.target.value as DataStatus } } }))}
                >
                  <option value="antatt">Antatt (spot + påslag)</option>
                  <option value="målt">Kundens avtale</option>
                </select>
              </label>
              <label>
                Salg av overskudd
                <NumField
                  value={st.meteringPoint.sell.deductionOrePerKwh}
                  width={70}
                  suffix="øre/kWh under spot"
                  onCommit={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, sell: { ...x.meteringPoint.sell, deductionOrePerKwh: v ?? 0 } } }))}
                />
              </label>
              <label>
                Elavgift
                <NumField
                  value={st.meteringPoint.elavgift.orePerKwh}
                  width={70}
                  placeholder="ikke oppgitt"
                  suffix="øre/kWh"
                  onCommit={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, elavgift: { ...x.meteringPoint.elavgift, orePerKwh: v, status: v == null ? "antatt" : "beregnet" } } }))}
                />
              </label>
              <label>
                Avgiftsstatus
                <select
                  className={s.input}
                  value={st.meteringPoint.elavgift.taxStatus}
                  onChange={(e) =>
                    update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, elavgift: { ...x.meteringPoint.elavgift, taxStatus: e.target.value as BusinessSettings["meteringPoint"]["elavgift"]["taxStatus"] } } }))
                  }
                >
                  <option value="ukjent">Ukjent</option>
                  <option value="ordinær">Ordinær</option>
                  <option value="redusert">Redusert (industri o.l.)</option>
                </select>
              </label>
              <label>
                Eksportgrense
                <NumField value={st.meteringPoint.exportLimitKw} width={70} placeholder="ingen" suffix="kW" onCommit={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, exportLimitKw: v } }))} />
              </label>
              <label>
                Målepunkt-ID
                <input
                  className={s.input}
                  defaultValue={st.meteringPoint.meterId}
                  placeholder="valgfritt"
                  onBlur={(e) => e.target.value !== st.meteringPoint.meterId && update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, meterId: e.target.value.trim() } }))}
                />
              </label>
            </div>
          </fieldset>

          {/* ---------------- Økonomi */}
          <fieldset className={`${s.nabox} ${s.wide}`}>
            <legend>Økonomi over levetiden</legend>
            <div className={s.fields} style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
              <label>
                Investering
                <select
                  className={s.input}
                  value={st.economy.investment.source}
                  onChange={(e) => update((x) => ({ ...x, economy: { ...x.economy, investment: { ...x.economy.investment, source: e.target.value as BusinessSettings["economy"]["investment"]["source"] } } }))}
                >
                  <option value="kalkyle">Fra kalkylen (eks. mva.)</option>
                  <option value="manuell">Annet beløp</option>
                  <option value="uavklart">Uavklart</option>
                </select>
                <span className={`${s.small} ${s.muted}`} style={{ fontWeight: 400 }}>
                  {st.economy.investment.source === "kalkyle"
                    ? investmentOre != null
                      ? kr(investmentOre / 100)
                      : (investmentNote ?? "Kalkylen har ingen sum ennå")
                    : null}
                </span>
              </label>
              {st.economy.investment.source === "manuell" && (
                <label>
                  Beløp eks. mva.
                  <NumField value={st.economy.investment.nok} width={110} suffix="kr" onCommit={(v) => update((x) => ({ ...x, economy: { ...x.economy, investment: { ...x.economy.investment, nok: v } } }))} />
                </label>
              )}
              <label>
                Analyseperiode
                <select className={s.input} value={st.economy.years} onChange={(e) => update((x) => ({ ...x, economy: { ...x.economy, years: Number(e.target.value) } }))}>
                  {[10, 15, 20, 25, 30, 35, 40].map((y) => (
                    <option key={y} value={y}>
                      {y} år
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kalkulasjonsrente <Help text="Nominell. 8,12 % = NVEs 6 % realrente + 2 % inflasjon. Kundens avkastningskrav kan overstyre." />
                <NumField value={st.economy.discountRatePct} width={60} suffix="%" onCommit={(v) => update((x) => ({ ...x, economy: { ...x.economy, discountRatePct: v ?? 8.12 } }))} />
              </label>
              <label>
                Paneldegradering
                <NumField value={st.economy.degradationPct} width={60} suffix="%/år" onCommit={(v) => update((x) => ({ ...x, economy: { ...x.economy, degradationPct: v ?? 0.4 } }))} />
              </label>
              <label>
                Vekst strømpris (hoved)
                <NumField
                  value={st.economy.growth.kraftPct}
                  width={60}
                  suffix="%/år"
                  onCommit={(v) =>
                    update((x) => ({
                      ...x,
                      economy: { ...x.economy, growth: { ...x.economy.growth, kraftPct: v ?? 0 } },
                      scenarios: x.scenarios.map((sc, i) => (i === 0 ? { name: `Hovedscenario: strømpris +${nf(v ?? 0, 1)} %/år`, kraftGrowthPct: v ?? 0 } : sc)),
                    }))
                  }
                />
              </label>
              <label>
                Vekst nettleie
                <NumField value={st.economy.growth.nettleiePct} width={60} suffix="%/år" onCommit={(v) => update((x) => ({ ...x, economy: { ...x.economy, growth: { ...x.economy.growth, nettleiePct: v ?? 0 } } }))} />
              </label>
              <label>
                Vekst avgift
                <NumField value={st.economy.growth.avgiftPct} width={60} suffix="%/år" onCommit={(v) => update((x) => ({ ...x, economy: { ...x.economy, growth: { ...x.economy.growth, avgiftPct: v ?? 0 } } }))} />
              </label>
              <label>
                Vekst driftskostnader
                <NumField value={st.economy.growth.driftPct} width={60} suffix="%/år" onCommit={(v) => update((x) => ({ ...x, economy: { ...x.economy, growth: { ...x.economy.growth, driftPct: v ?? 0 } } }))} />
              </label>
              <label>
                Service per år
                <NumField
                  value={st.economy.opex[0]?.nokPerYear ?? 0}
                  width={80}
                  suffix="kr"
                  onCommit={(v) => update((x) => ({ ...x, economy: { ...x.economy, opex: [{ name: x.economy.opex[0]?.name ?? "Service", nokPerYear: v ?? 0 }, ...x.economy.opex.slice(1)] } }))}
                />
              </label>
              <label>
                Inverterbytte år
                <NumField
                  value={st.economy.replacements[0]?.year ?? null}
                  width={50}
                  placeholder="ingen"
                  onCommit={(v) =>
                    update((x) => ({
                      ...x,
                      economy: { ...x.economy, replacements: v == null ? [] : [{ name: x.economy.replacements[0]?.name ?? "Inverterbytte", year: Math.round(v), nok: x.economy.replacements[0]?.nok ?? 0 }] },
                    }))
                  }
                />
              </label>
              {st.economy.replacements[0] && (
                <label>
                  Inverterbytte kostnad
                  <NumField
                    value={st.economy.replacements[0].nok}
                    width={90}
                    suffix="kr"
                    onCommit={(v) => update((x) => ({ ...x, economy: { ...x.economy, replacements: [{ ...x.economy.replacements[0], nok: v ?? 0 }] } }))}
                  />
                </label>
              )}
            </div>
            <p className={`${s.small} ${s.muted}`} style={{ marginBottom: 0 }}>
              Nominelle kroner, eks. mva., før skatt og finansiering. Hvert år regnes energiflyten på nytt med degradert produksjon. Forsiktig scenario: ingen strømprisvekst.
            </p>
          </fieldset>
        </div>

        {/* ---------------- Beregn */}
        <div className={s.footerbar} style={{ margin: "14px -16px -14px", borderRadius: 0 }}>
          <span className={`${s.small} ${s.muted}`}>
            Priser og PVGIS hentes første gang og lagres. «Hent oppdaterte kildedata» henter på nytt. Sendte tilbud endres aldri.
          </span>
          <span className={s.inline}>
            <button type="button" className={s.btn} disabled={running} onClick={() => doRun(true)} title="Henter spotpriser og PVGIS på nytt">
              Hent oppdaterte kildedata
            </button>
            <button type="button" className={`${s.btn} ${s.primary}`} disabled={running} onClick={() => doRun(false)}>
              {running ? "Beregner …" : "Beregn med lagret grunnlag"}
            </button>
          </span>
        </div>
      </div>

      {runError && (
        <div className={s.panelbody}>
          <div className={`${s.notice} ${s.error}`} style={{ margin: 0 }}>
            Ikke beregnet: {runError}
          </div>
        </div>
      )}
      {run && <Result r={run.summary} stale={stale} />}
    </section>
  );
}

// ---------------------------------------------------------------- filopplasting og datakontroll

function SeriesBlock({
  kind,
  analysisId,
  active,
  all,
  onChanged,
  onMeter,
}: {
  kind: "forbruk" | "produksjon";
  analysisId: string;
  active?: BusinessSeries;
  all: BusinessSeries[];
  onChanged: () => void;
  onMeter?: (meterId: string | null) => void;
}) {
  const [upload, setUpload] = useState<UploadResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<{ candidateId: string; unit: string; convention: "auto" | "start" | "slutt" }>({ candidateId: "", unit: "", convention: "auto" });
  const [report, setReport] = useState<QualityReport | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setReport(null);
    try {
      const res = await uploadBusinessFile(analysisId, file);
      setUpload(res);
      // Foreslå: riktig rolle, ikke aggregat, størst sum
      const best =
        [...res.candidates].filter((c) => !c.aggregateOf && (c.roleGuess === kind || c.roleGuess === "ukjent")).sort((a, b) => b.sum - a.sum)[0] ?? res.candidates[0];
      setPick({ candidateId: best.id, unit: best.unitGuess === "ukjent" ? "" : best.unitGuess, convention: "auto" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const check = async (confirm: boolean) => {
    if (!upload) return;
    setBusy(true);
    try {
      const res = await importBusinessSeries(analysisId, upload.file.id, {
        candidateId: pick.candidateId,
        kind,
        unit: pick.unit || undefined,
        convention: pick.convention,
        confirm,
      });
      setReport(res.report);
      if (confirm) {
        toast.success(`${kind === "forbruk" ? "Forbruket" : "Produksjonen"} er lagt inn.`);
        onMeter?.(upload.candidates.find((c) => c.id === pick.candidateId)?.meterId ?? null);
        setUpload(null);
        setReport(null);
        onChanged();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {active ? (
        <div className={s.inverterinfo} style={{ marginTop: 0 }}>
          <div className={s.inline} style={{ justifyContent: "space-between", width: "100%" }}>
            <span>
              <StatusPill status={active.status} /> <strong>{active.provenance.source}</strong>
            </span>
            <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} onClick={() => setSeriesActive(analysisId, active.id, false).then(onChanged)}>
              Ikke bruk
            </button>
          </div>
          <div className={s.small}>
            {active.provenance.period?.from} – {active.provenance.period?.to} · {active.intervals} {active.resolutionMin === 60 ? "timer" : "kvarter"} · {kwh(active.sumKwh)}
          </div>
          {active.quality && <Issues issues={active.quality.issues} />}
        </div>
      ) : (
        <p className={`${s.small} ${s.muted}`} style={{ marginTop: 0 }}>
          Ingen {kind === "forbruk" ? "forbruksfil" : "produksjonsfil"} er i bruk.
          {all.length ? " Tidligere importerte serier:" : ""}
        </p>
      )}
      {!active && all.length > 0 && (
        <div className={s.list} style={{ maxHeight: 140, marginBottom: 8 }}>
          {all.slice(0, 5).map((x) => (
            <button key={x.id} type="button" className={s.btn} onClick={() => setSeriesActive(analysisId, x.id, true).then(onChanged)}>
              <span>{x.provenance.source}</span>
              <span className={s.muted}>Bruk</span>
            </button>
          ))}
        </div>
      )}

      <label className={s.inline} style={{ marginTop: 8 }}>
        <span className={`${s.btn} ${s.small2}`}>{busy ? "Leser …" : active ? "Last opp ny fil" : "Last opp Excel/CSV"}</span>
        <input type="file" accept=".xlsx,.csv,.txt" hidden disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        <span className={`${s.small} ${s.muted}`}>Timesverdier eller kvarter, ett eller flere målepunkter. Maks ca. 4 MB.</span>
      </label>

      {upload && (
        <div className={s.uploadbox}>
          <div className={s.small}>
            <strong>{upload.fileName}</strong> – velg serien som skal brukes:
          </div>
          {upload.notes.map((n) => (
            <div key={n} className={`${s.small} ${s.muted}`}>
              {n}
            </div>
          ))}
          <div className={s.tablewrap}>
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Kolonne</th>
                  <th>Målepunkt</th>
                  <th>Tolket som</th>
                  <th>Periode</th>
                  <th className={s.num}>Rader</th>
                  <th className={s.num}>Sum</th>
                </tr>
              </thead>
              <tbody>
                {upload.candidates.map((c) => (
                  <tr key={c.id} className={c.aggregateOf ? s.hiddenrow : undefined}>
                    <td>
                      <input type="radio" name={`cand-${kind}`} checked={pick.candidateId === c.id} onChange={() => (setPick({ candidateId: c.id, unit: c.unitGuess === "ukjent" ? "" : c.unitGuess, convention: "auto" }), setReport(null))} />
                    </td>
                    <td>
                      {c.sheet} · {c.header || c.id}
                      {c.aggregateOf && <div className={`${s.small} ${s.muted}`}>Sum av andre målere – ikke bruk sammen med dem</div>}
                    </td>
                    <td>
                      {c.meterId ?? "—"}
                      {c.priceArea && <span className={s.muted}> · {c.priceArea}</span>}
                    </td>
                    <td title={c.roleReason}>{c.roleGuess}</td>
                    <td className={s.small}>
                      {c.first} – {c.last}
                    </td>
                    <td className={s.num}>
                      {nf(c.rows)}
                      {c.emptyRows ? <span className={s.muted}> (+{c.emptyRows} tomme)</span> : null}
                    </td>
                    <td className={s.num}>{nf(c.sum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={s.inline} style={{ flexWrap: "wrap", marginTop: 8 }}>
            <label className={s.inline}>
              Enhet
              <select className={s.input} value={pick.unit} onChange={(e) => (setPick((p) => ({ ...p, unit: e.target.value })), setReport(null))}>
                <option value="">Ukjent (antas kWh)</option>
                <option value="kWh">kWh per intervall</option>
                <option value="Wh">Wh</option>
                <option value="MWh">MWh</option>
                <option value="kW">kW (middeleffekt)</option>
                <option value="W">W (middeleffekt)</option>
              </select>
            </label>
            <label className={s.inline}>
              Tidspunktet er
              <select className={s.input} value={pick.convention} onChange={(e) => (setPick((p) => ({ ...p, convention: e.target.value as typeof p.convention })), setReport(null))}>
                <option value="auto">Gjenkjenn</option>
                <option value="start">Starten av intervallet</option>
                <option value="slutt">Slutten av intervallet</option>
              </select>
            </label>
            <button type="button" className={s.btn} disabled={busy || !pick.candidateId} onClick={() => check(false)}>
              Kontroller
            </button>
            <button type="button" className={`${s.btn} ${s.primary}`} disabled={busy || !report || report.issues.some((i) => i.code === "HULL_LANGE")} onClick={() => check(true)}>
              Bruk denne serien
            </button>
            <button type="button" className={`${s.btn} ${s.ghost}`} onClick={() => (setUpload(null), setReport(null))}>
              Avbryt
            </button>
          </div>
          {report && (
            <div className={s.inverterinfo}>
              <strong>Datakontroll:</strong> {report.firstLocal} – {report.lastLocal} · {nf(report.intervals)} {report.resolutionMin === 60 ? "timer" : "kvarter"}
              {report.expectedIntervals !== report.intervals ? ` (forventet ${nf(report.expectedIntervals)})` : ""} · sum {kwh(report.sumKwh)} · {report.missing} manglende · {report.duplicates} duplikater ·{" "}
              {report.estimated} estimert
              <Issues issues={report.issues} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Issues({ issues }: { issues: QualityReport["issues"] }) {
  const shown = issues.filter((i) => i.code !== "TOPP" || issues.length < 3);
  if (!shown.length) return null;
  return (
    <ul className={s.issues}>
      {shown.map((i) => (
        <li key={i.code} className={i.level === "feil" ? s.issueerr : i.level === "advarsel" ? s.issuewarn : undefined}>
          {i.message}
          {i.examples?.length ? <span className={s.muted}> ({i.examples.slice(0, 2).join(", ")})</span> : null}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- tariff

function TariffInfo({ tariff, year }: { tariff?: Tariff; year: number }) {
  if (!tariff) return null;
  const d = tariff.definition;
  const outside = tariff.validFrom.slice(0, 4) > String(year) || (tariff.validTo && tariff.validTo.slice(0, 4) < String(year));
  return (
    <span className={`${s.small} ${s.muted}`} style={{ fontWeight: 400 }}>
      Fastledd {nf(d.fixedNokPerYear)} kr/år · energiledd {nf(d.energyOrePerKwh, 2)} øre/kWh
      {d.power ? ` · effektledd ${d.power.summerNokPerKwMonth}/${d.power.winterNokPerKwMonth} kr/kW/mnd (sommer/vinter, høyeste time hverdager ${d.power.window.fromHour}–${d.power.window.toHour})` : ""}
      {d.rateChanges?.length ? ` · satsendring fra ${d.rateChanges.map((c) => c.from).join(", ")}` : ""} · kontrollert {tariff.lastChecked}
      {outside && <strong style={{ color: "#8a5414" }}> · Gjelder ikke {year}: regnes som scenario med annen tariff</strong>}
    </span>
  );
}

function ManualTariff({ installerGroupId, onCreated }: { installerGroupId: string; onCreated: (t: Tariff) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ gridOwner: "", name: "Næring", validFrom: `${new Date().getFullYear()}-01-01`, fixed: "", energy: "", summer: "", winter: "", from: "6", to: "22" });
  const num = (x: string) => Number(x.replace(",", ".").replace(/\s/g, ""));
  if (!open)
    return (
      <button type="button" className={`${s.btn} ${s.small2}`} onClick={() => setOpen(true)}>
        Registrer manuelt
      </button>
    );
  const save = async () => {
    try {
      const hasPower = f.summer.trim() !== "" || f.winter.trim() !== "";
      const t = await createTariff({
        installerGroupId,
        gridOwner: f.gridOwner,
        name: f.name,
        validFrom: f.validFrom,
        validTo: null,
        sourceUrl: null,
        definition: {
          fixedNokPerYear: num(f.fixed || "0"),
          energyOrePerKwh: num(f.energy || "0"),
          power: hasPower
            ? {
                method: "maks_time_i_vindu",
                window: { weekdays: [1, 2, 3, 4, 5], fromHour: num(f.from), toHour: num(f.to) + 1, excludeHolidays: true },
                summerMonths: [4, 5, 6, 7, 8, 9],
                summerNokPerKwMonth: num(f.summer || "0"),
                winterNokPerKwMonth: num(f.winter || "0"),
              }
            : null,
          notes: ["Registrert manuelt fra dashboardet. Effektgrunnlag: høyeste time i vinduet (hverdager), sommer april–september."],
        },
      });
      toast.success("Tariffen er registrert for teamet.");
      onCreated(t);
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const field = (k: keyof typeof f, label: string, w = 90) => (
    <label>
      {label}
      <input className={s.input} style={{ width: w }} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  return (
    <div className={s.manualtariff}>
      {field("gridOwner", "Nettselskap", 160)}
      {field("name", "Tariffnavn", 160)}
      {field("validFrom", "Gyldig fra", 110)}
      {field("fixed", "Fastledd kr/år")}
      {field("energy", "Energiledd øre/kWh")}
      {field("summer", "Effekt sommer kr/kW/mnd")}
      {field("winter", "Effekt vinter kr/kW/mnd")}
      {field("from", "Effektvindu fra kl.", 60)}
      {field("to", "til kl. (t.o.m.)", 60)}
      <span className={s.inline}>
        <button type="button" className={`${s.btn} ${s.primary} ${s.small2}`} disabled={!f.gridOwner || !f.name} onClick={save}>
          Lagre tariff
        </button>
        <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} onClick={() => setOpen(false)}>
          Avbryt
        </button>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- resultat

function Result({ r, stale }: { r: BusinessSummary; stale: boolean }) {
  const [scenario, setScenario] = useState(0);
  const eco = r.economy?.[scenario] ?? null;
  const maxCost = useMemo(() => Math.max(...r.months.map((m) => m.costBefore), 1), [r.months]);
  const sv = r.savings;
  const parts = [
    { label: "Kraft du slipper å kjøpe", v: sv.kraft },
    { label: "Nettleie, energiledd", v: sv.nettleieEnergi },
    { label: "Effektledd (lavere topper)", v: sv.effektledd },
    { label: "Elavgift", v: sv.elavgift },
    { label: "Salg av overskudd", v: sv.salg },
  ];

  return (
    <div className={s.panelbody} style={{ borderTop: "1px solid var(--line)", opacity: stale ? 0.6 : 1 }}>
      {stale && <div className={`${s.notice} ${s.info}`}>Innstillingene er endret siden beregningen. Beregn på nytt.</div>}
      <p style={{ margin: "0 0 12px", fontWeight: 600 }}>{r.customerSentence}</p>

      <div className={s.kpis}>
        <div>
          <span>Investering eks. mva.</span>
          <strong>{r.investmentNok == null ? "Uavklart" : kr(r.investmentNok)}</strong>
        </div>
        <div>
          <span>Netto gevinst første år</span>
          <strong>{eco ? kr(eco.firstYearNet) : kr(sv.total)}</strong>
        </div>
        <div>
          <span>Tilbakebetaling</span>
          <strong>{eco?.paybackYears != null ? `${nf(eco.paybackYears, 1)} år` : r.investmentNok == null ? "—" : `Ikke innen ${r.assumptions.years} år`}</strong>
        </div>
        <div>
          <span>Nåverdi ({nf(r.assumptions.discountRatePct, 2)} %)</span>
          <strong>{eco?.npv != null ? kr(eco.npv) : "—"}</strong>
        </div>
        <div>
          <span>Strømregning før → etter ({r.period.label})</span>
          <strong>
            {kr(r.before.cost.netto)} → {kr(r.after.cost.netto)}
          </strong>
        </div>
      </div>
      {r.investmentNok == null && eco && (
        <p className={s.small}>
          Høyeste investering som gir positiv nåverdi: <strong>{kr(eco.pvOfOperations)}</strong> ({eco.name.toLowerCase()}).
        </p>
      )}

      {r.economy && r.economy.length > 1 && (
        <div className={s.chips}>
          {r.economy.map((e, i) => (
            <button key={e.name} type="button" className={`${s.chip} ${i === scenario ? s.chipon : ""}`} onClick={() => setScenario(i)}>
              {e.name}
            </button>
          ))}
        </div>
      )}

      <div className={s.grid}>
        <div>
          <h3 className={s.grouphead}>Hvor verdien kommer fra ({r.period.label})</h3>
          <table>
            <tbody>
              {parts.map((p) => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  <td className={s.num}>{kr(p.v)}</td>
                </tr>
              ))}
              <tr>
                <td className={s.strong}>Sum lavere strømregning</td>
                <td className={`${s.num} ${s.strong}`}>{kr(sv.total)}</td>
              </tr>
            </tbody>
          </table>
          <p className={`${s.small} ${s.muted}`}>
            Fastledd og faste gebyrer er ikke regnet som spart. Egenbruk {pct(r.kpi.selfConsumptionShare)} av solstrømmen · selvforsyning {pct(r.kpi.selfSufficiencyShare)} av forbruket ·{" "}
            {nf(r.system.kwp, 1)} kWp, {kwh(r.after.pvKwh)} produsert.
          </p>
        </div>
        <div>
          <h3 className={s.grouphead}>Strømregning per måned</h3>
          <div className={s.bars}>
            {r.months.map((m) => (
              <div key={m.month} title={`${m.month}: ${kr(m.costBefore)} → ${kr(m.costAfter)}`}>
                <span style={{ height: `${(m.costBefore / maxCost) * 100}%` }} className={s.barbefore} />
                <span style={{ height: `${(Math.max(0, m.costAfter) / maxCost) * 100}%` }} className={s.barafter} />
                <em>{MONTHS[Number(m.month.slice(5)) - 1]}</em>
              </div>
            ))}
          </div>
          <div className={`${s.small} ${s.muted}`}>
            <span className={`${s.legend} ${s.barbefore}`} /> uten solceller <span className={`${s.legend} ${s.barafter}`} /> med solceller
          </div>
        </div>
      </div>

      <details className={s.details}>
        <summary>Måned for måned</summary>
        <div className={s.tablewrap}>
          <table>
            <thead>
              <tr>
                <th>Måned</th>
                <th className={s.num}>Forbruk</th>
                <th className={s.num}>Sol</th>
                <th className={s.num}>Egenbruk</th>
                <th className={s.num}>Eksport</th>
                <th className={s.num}>Topp før</th>
                <th className={s.num}>Topp etter</th>
                <th className={s.num}>Regning før</th>
                <th className={s.num}>Regning etter</th>
              </tr>
            </thead>
            <tbody>
              {r.months.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td className={s.num}>{nf(m.loadKwh)}</td>
                  <td className={s.num}>{nf(m.pvKwh)}</td>
                  <td className={s.num}>{nf(m.selfKwh)}</td>
                  <td className={s.num}>{nf(m.exportKwh)}</td>
                  <td className={s.num}>{nf(m.peakBeforeKw, 1)} kW</td>
                  <td className={s.num}>{nf(m.peakAfterKw, 1)} kW</td>
                  <td className={s.num}>{kr(m.costBefore)}</td>
                  <td className={s.num}>{kr(m.costAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {eco && (
        <details className={s.details}>
          <summary>Kontantstrøm per år ({eco.name.toLowerCase()})</summary>
          <div className={s.tablewrap}>
            <table>
              <thead>
                <tr>
                  <th>År</th>
                  <th className={s.num}>Spart kraft</th>
                  <th className={s.num}>Spart nettleie</th>
                  <th className={s.num}>Spart avgift</th>
                  <th className={s.num}>Salg</th>
                  <th className={s.num}>Drift</th>
                  <th className={s.num}>Utskifting</th>
                  <th className={s.num}>Netto</th>
                  <th className={s.num}>Akkumulert</th>
                </tr>
              </thead>
              <tbody>
                {eco.rows.map((y) => (
                  <tr key={y.year}>
                    <td>{y.year}</td>
                    <td className={s.num}>{nf(y.savedKraft)}</td>
                    <td className={s.num}>{nf(y.savedNettleie)}</td>
                    <td className={s.num}>{nf(y.savedAvgift)}</td>
                    <td className={s.num}>{nf(y.salg)}</td>
                    <td className={s.num}>−{nf(y.drift)}</td>
                    <td className={s.num}>{y.utskifting ? `−${nf(y.utskifting)}` : ""}</td>
                    <td className={`${s.num} ${s.strong}`}>{nf(y.netto)}</td>
                    <td className={s.num}>{y.akkumulert == null ? "—" : nf(y.akkumulert)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`${s.small} ${s.muted}`}>
            Internrente: {eco.irr != null ? `${nf(eco.irr * 100, 1)} %` : (eco.irrNote ?? "—")} · Diskontert tilbakebetaling: {eco.discountedPaybackYears != null ? `${nf(eco.discountedPaybackYears, 1)} år` : "—"} ·{" "}
            {r.assumptions.vat} {r.assumptions.beforeTax}
          </p>
        </details>
      )}

      <details className={s.details} open>
        <summary>Datagrunnlag og forutsetninger</summary>
        <table>
          <tbody>
            {r.basis.map((b) => (
              <tr key={b.what}>
                <td style={{ width: 150 }}>{b.what}</td>
                <td>
                  <StatusPill status={b.status} />
                </td>
                <td>
                  <strong>{b.value}</strong>
                  <div className={`${s.small} ${s.muted}`}>
                    {b.source}
                    {b.period ? ` · ${b.period}` : ""}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {r.economyNote && <p className={s.small}>{r.economyNote}</p>}
        {r.warnings.length > 0 && (
          <ul className={s.issues}>
            {r.warnings.map((w) => (
              <li key={w} className={s.issuewarn}>
                {w}
              </li>
            ))}
          </ul>
        )}
        <p className={`${s.small} ${s.muted}`}>
          Kontroller: {r.checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.label}`).join(" · ")} · motor {r.engineVersion} · grunnlag {r.inputHash.slice(0, 8)}
        </p>
      </details>
    </div>
  );
}
