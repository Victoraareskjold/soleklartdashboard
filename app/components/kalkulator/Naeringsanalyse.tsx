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
  type AnalysisIssue,
  deleteTariff,
  duplicateTariff,
  updateTariff,
  type PriceArea,
  type QualityReport,
  type RunResult,
  type Surface,
  type Tariff,
  type TariffDefinition,
  type QuoteContext,
  type UploadResult,
} from "@/lib/naeringApi";
import type { Roof } from "../SolarDataView";
import { Dialog } from "./Dialog";
import { Help } from "./fields";
import s from "./kalkulator.module.css";

interface Props {
  leadId: string;
  installerGroupId: string;
  /** Tilbudets utkast (inkl. batteritillegg). Sendes til beregningen, som regner kWp, investering og inverter på serveren. */
  draft: unknown;
  /** Tilbudets installerte effekt, for visning */
  kwp: number | null;
  /** Tilbudets sum eks. mva. (øre), for visning */
  investmentOre: number | null;
  /** Tilbudet har batteri i kalkylen eller som tillegg */
  hasBattery?: boolean;
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

/** Vises når tilbudet ikke har takflater. Tydelig merket som antatt, og kan redigeres. */
const EXAMPLE_SURFACE: Surface = { id: "eksempel", label: "Eksempel: én flate mot sør", panels: null, kwp: null, tiltDeg: 15, azimuthDeg: 180, assumed: true };

const SOURCE_LABEL: Record<string, string> = {
  måledata: "Måledata",
  markedspriser: "Historiske markedspriser",
  tariffregister: "Fra tariffregister",
  simulert: "Simulert",
  oppgitt: "Oppgitt",
  antatt: "Antatt",
  beregnet: "Beregnet",
};
function SourcePill({ type, confirmed }: { type?: string; confirmed?: boolean }) {
  const t = type ?? "antatt";
  const cls = t === "måledata" ? s.st_measured : t === "antatt" ? s.st_assumed : s.st_calculated;
  return (
    <span className={`${s.pill} ${cls}`}>
      {SOURCE_LABEL[t] ?? t}
      {t === "tariffregister" ? (confirmed ? " · bekreftet" : " · ikke bekreftet") : ""}
    </span>
  );
}

/** Avvik ved feltet: feil (rødt), advarsel (oransje), antakelse (dempet). */
function FieldIssues({ issues }: { issues: AnalysisIssue[] }) {
  if (!issues.length) return null;
  return (
    <ul className={s.issues}>
      {issues.map((i, n) => (
        <li key={n} className={i.level === "feil" ? s.issueerr : i.level === "advarsel" ? s.issuewarn : s.muted}>
          {i.level === "feil" ? "Feil: " : i.level === "advarsel" ? "Kontroller: " : "Antakelse: "}
          {i.message}
        </li>
      ))}
    </ul>
  );
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

export default function Naeringsanalyse({ leadId, installerGroupId, draft, kwp, investmentOre, hasBattery, roofs, address, onAnalysis }: Props) {
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
  const [phase, setPhase] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const lockRef = useRef(1);
  const settingsRef = useRef<BusinessSettings | null>(null);
  const draftJson = JSON.stringify(draft ?? null);
  const ranWithDraft = useRef<string | null>(null);

  // ---- last inn (eller opprett) analysen for leaden
  const reload = useCallback(async () => {
    try {
      const res = await getBusinessAnalysis(leadId);
      let a = res.analysis;
      if (!a) {
        // Ny analyse: takflater fra tilbudet/solkartet, ellers en synlig eksempelrad. Tariff velges aldri automatisk.
        a = await createBusinessAnalysis(leadId);
        const fromRoofs = surfacesFromRoofs(roofs);
        const surfaces = fromRoofs.length ? fromRoofs : [EXAMPLE_SURFACE];
        const next = {
          ...a.settings,
          location: { ...a.settings.location, address: a.settings.location.address || address || "" },
          production: { ...a.settings.production, surfaces },
        };
        a = await saveBusinessAnalysis(a.id, a.lockVersion, next);
      }
      setTariffs(await getTariffs(installerGroupId, { selected: a.settings.meteringPoint.tariffId }));
      lockRef.current = a.lockVersion;
      settingsRef.current = a.settings;
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
  /** Endrer skjemaet. Siste verdi holdes i settingsRef, så «Beregn analyse» alltid lagrer det som vises. */
  const update = (fn: (x: BusinessSettings) => BusinessSettings) => {
    const cur = settingsRef.current;
    if (!cur) return;
    const next = fn(cur);
    settingsRef.current = next;
    pending.current = next;
    setSettings(next);
    setSaveState("endret");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
    setStale(true);
  };

  const doRun = async (refresh: boolean) => {
    if (!analysis) return;
    // Felt som lagres ved blur: avslutt redigeringen først, så siste verdi kommer med
    (document.activeElement as HTMLElement | null)?.blur?.();
    await new Promise((r) => setTimeout(r, 0));
    if (timer.current) clearTimeout(timer.current);
    setRunning(true);
    setRunError(null);
    const steps = ["Lagrer skjemaet", "Kontrollerer forbruk og tariff", refresh ? "Henter spotpriser og solproduksjon på nytt" : "Henter spotpriser og solproduksjon", "Beregner resultat"];
    setPhase(steps[0]);
    const timers = steps.slice(1).map((st, i) => setTimeout(() => setPhase(st), 700 * (i + 1)));
    try {
      await flush();
      setRun(await runBusinessAnalysis(analysis.id, { draft, refresh }));
      ranWithDraft.current = draftJson;
      setStale(false);
    } catch (e) {
      setRunError((e as Error).message);
      setRun(null);
    } finally {
      timers.forEach(clearTimeout);
      setPhase(null);
      setRunning(false);
    }
  };
  const quoteChanged = run != null && ranWithDraft.current != null && ranWithDraft.current !== draftJson;
  const issuesFor = (...fields: string[]) => (run?.summary.issues ?? []).filter((i) => fields.includes(i.field));

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
        {hasBattery && (
          <div className={`${s.notice} ${s.info}`}>
            Tilbudet inneholder batteri. Analysen beregner foreløpig bare solcelleanlegget – batteriets nytte og kostnad kommer i batterimodulen,
            og det står tydelig i tilbudet.
          </div>
        )}
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
                    {g.value === "lading" || g.value === "nødstrøm" ? <span className={s.notyet}> · beregnes ikke ennå</span> : null}
                  </button>
                );
              })}
            </div>
            <p className={`${s.small} ${s.muted}`} style={{ marginBottom: 0 }}>
              {st.consumption.level === 3
                ? "Kundens målte forbruk styrer beregningen. Virksomhetstype og driftstid endrer ikke måledataene."
                : "Virksomhetstype og driftstid brukes til å anslå når på døgnet strømmen brukes."}
            </p>
            <FieldIssues issues={issuesFor("mål")} />
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
            <FieldIssues issues={issuesFor("sted","periode")} />
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
            <FieldIssues issues={issuesFor("forbruk")} />
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
                        // Endres en eksempelrad, er den ikke lenger et eksempel
                        const set = (patch: Partial<Surface>) =>
                          update((x) => ({
                            ...x,
                            production: { ...x.production, surfaces: x.production.surfaces.map((y, j) => (j === i ? { ...y, ...patch, assumed: false } : y)) },
                          }));
                        return (
                          <tr key={f.id} className={f.assumed ? s.assumedrow : undefined}>
                            <td>
                              <input className={s.input} defaultValue={f.label} onBlur={(e) => e.target.value !== f.label && set({ label: e.target.value })} />
                              {f.assumed && <div className={`${s.small} ${s.assumedtext}`}>Antatt – tilbudet har ingen takflater. Kontroller retning og helning.</div>}
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
                        <tr className={s.assumedrow}>
                          <td colSpan={6}>
                            <span className={s.assumedtext}>Ingen takflater: beregningen bruker et eksempel (sør, 15°), merket som antatt.</span>{" "}
                            <button type="button" className={`${s.btn} ${s.small2}`} onClick={() => update((x) => ({ ...x, production: { ...x.production, surfaces: [EXAMPLE_SURFACE] } }))}>
                              Vis eksempelraden
                            </button>
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
                    Hentet fra tilbudet: <strong>{kwp != null ? `${nf(kwp, 2)} kWp` : "ingen paneler"}</strong>
                    {run?.quote.inverterNames.length ? ` · ${run.quote.inverterNames.join(", ")}${run.quote.inverterAcKw ? ` (${nf(run.quote.inverterAcKw, 1)} kW AC, produksjonen kappes her)` : " (AC-effekt mangler i produktdata)"}` : ""}{" "}
                    · Systemtap <Help text="Tap i kabler, inverter, smuss o.l. som trekkes i PVGIS-simuleringen. Inverterens effektgrense håndteres separat (kapping), så samme tap trekkes ikke to ganger." />
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
            <FieldIssues issues={issuesFor("takflater","produksjon")} />
          </fieldset>

          {/* ---------------- Nett og avtaler */}
          <fieldset className={`${s.nabox} ${s.wide}`}>
            <legend>Nettleie og strømavtaler</legend>
            <div className={s.fields}>
              <div className={s.wide}>
                <label htmlFor="na-tariff" className={s.fieldlabel}>
                  Nettariff{" "}
                  <Help text="Nettselskapets prismodell for kunden. Kontroller nettselskap, kundegruppe og periode mot nettleiefakturaen. Prisområdet sier ikke hvilket nettselskap kunden har." />
                </label>
                <div className={s.inline} style={{ width: "100%", flexWrap: "wrap" }}>
                  <select
                    id="na-tariff"
                    className={s.input}
                    style={{ flex: 1, minWidth: 260 }}
                    value={st.meteringPoint.tariffId ?? ""}
                    onChange={(e) =>
                      update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, tariffId: e.target.value || null, tariffConfirmed: false, tariffScenario: false } }))
                    }
                  >
                    <option value="">Velg tariff …</option>
                    {tariffs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.gridOwner} – {t.name} ({t.validFrom.slice(0, 4)}
                        {t.validTo && t.validTo.slice(0, 4) !== t.validFrom.slice(0, 4) ? `–${t.validTo.slice(0, 4)}` : ""})
                        {t.owner === "egen" ? " · egen" : ""}
                        {t.archived ? " · arkivert" : ""}
                      </option>
                    ))}
                  </select>
                  <ManualTariff
                    installerGroupId={installerGroupId}
                    onCreated={(t) => (setTariffs((l) => [...l, t]), update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, tariffId: t.id, tariffConfirmed: false, tariffScenario: false } })))}
                  />
                  <button type="button" className={`${s.btn} ${s.small2}`} onClick={() => setShowAdmin(true)}>
                    Administrer tariffer
                  </button>
                </div>
                {!st.meteringPoint.tariffId && (
                  <p className={`${s.small} ${s.muted}`} style={{ margin: "6px 0 0" }}>
                    Ingen tariff er valgt. Velg kundens tariff, eller legg inn satsene fra nettleiefakturaen.
                  </p>
                )}
                <TariffCard
                  tariff={tariffs.find((t) => t.id === st.meteringPoint.tariffId)}
                  period={st.period}
                  installerGroupId={installerGroupId}
                  confirmed={st.meteringPoint.tariffConfirmed}
                  scenario={st.meteringPoint.tariffScenario}
                  onConfirmed={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, tariffConfirmed: v } }))}
                  onScenario={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, tariffScenario: v } }))}
                  onCopied={(t) => (setTariffs((l) => [...l, t]), update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, tariffId: t.id, tariffConfirmed: false, tariffScenario: false } })))}
                  onChooseOther={() => document.getElementById("na-tariff")?.focus()}
                />
                <FieldIssues issues={issuesFor("tariff")} />
              </div>
              <label>
                <span>
                  Avgiftsstatus <Help text="Ordinær sats, redusert sats (f.eks. industri med rett til redusert sats), fritak eller ukjent. Virksomhetstype alene bekrefter ikke rett til redusert sats. Ukjent regnes med ordinær sats og merkes som antatt." />
                </span>
                <select
                  className={s.input}
                  value={st.meteringPoint.elavgift.taxStatus}
                  onChange={(e) =>
                    update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, elavgift: { ...x.meteringPoint.elavgift, taxStatus: e.target.value as BusinessSettings["meteringPoint"]["elavgift"]["taxStatus"] } } }))
                  }
                >
                  <option value="ukjent">Ukjent (regnes som ordinær)</option>
                  <option value="ordinær">Ordinær sats</option>
                  <option value="redusert">Redusert sats</option>
                  <option value="fritak">Fritak</option>
                </select>
                <span className={s.hint}>Periodens offisielle satser brukes, f.eks. 2025: 9,79 / 16,93 / 12,53 øre/kWh (ordinær).</span>
              </label>
              <label>
                <span>
                  Egen elavgiftssats (valgfritt) <Help text="Bare hvis kunden har en annen dokumentert sats. Gjelder hele perioden og merkes som oppgitt. Ikke ta med nettleie eller mva." />
                </span>
                <NumField
                  value={st.meteringPoint.elavgift.orePerKwh}
                  width={70}
                  placeholder="periodens"
                  suffix="øre/kWh eks. mva."
                  onCommit={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, elavgift: { ...x.meteringPoint.elavgift, orePerKwh: v, status: v == null ? "antatt" : "målt" } } }))}
                />
              </label>
              <div className={s.wide}>
                <FieldIssues issues={issuesFor("elavgift")} />
              </div>
              <label>
                <span>
                  Påslag ved kjøp <Help text="Strømleverandørens tillegg til spotprisen. Eksempel: 7 øre/kWh. Finnes i strømavtalen. Ikke før hele strømprisen her." />
                </span>
                <NumField value={st.meteringPoint.buy.markupOrePerKwh} width={70} suffix="øre/kWh" onCommit={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, buy: { ...x.meteringPoint.buy, markupOrePerKwh: v ?? 0 } } }))} />
              </label>
              <label>
                <span>
                  Fastbeløp strømavtale <Help text="Leverandørens faste månedsbeløp. Forsvinner vanligvis ikke med solceller og regnes ikke som spart." />
                </span>
                <NumField value={st.meteringPoint.buy.monthlyFeeNok} width={70} suffix="kr/mnd" onCommit={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, buy: { ...x.meteringPoint.buy, monthlyFeeNok: v ?? 0 } } }))} />
              </label>
              <label>
                Kjøpsavtale
                <select
                  className={s.input}
                  value={st.meteringPoint.buy.status}
                  onChange={(e) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, buy: { ...x.meteringPoint.buy, status: e.target.value as DataStatus } } }))}
                >
                  <option value="antatt">Ukjent – anslag (spot + påslag)</option>
                  <option value="målt">Kundens spotavtale (oppgitt)</option>
                </select>
              </label>
              <label>
                <span>
                  Salg av overskudd <Help text="Salgspris = spot minus fradraget. Eksempel: spot minus 2 øre/kWh. 0 betyr ren spotpris – bare hvis det faktisk er avtalen eller antakelsen." />
                </span>
                <NumField
                  value={st.meteringPoint.sell.deductionOrePerKwh}
                  width={70}
                  suffix="øre/kWh under spot"
                  onCommit={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, sell: { ...x.meteringPoint.sell, deductionOrePerKwh: v ?? 0 } } }))}
                />
              </label>
              <label>
                Salgsavtale
                <select
                  className={s.input}
                  value={st.meteringPoint.sell.status}
                  onChange={(e) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, sell: { ...x.meteringPoint.sell, status: e.target.value as DataStatus } } }))}
                >
                  <option value="antatt">Ukjent – anslag</option>
                  <option value="målt">Kundens avtale (oppgitt)</option>
                </select>
              </label>
              <label>
                <span>
                  Eksportgrense <Help text="Maksimal effekt som kan mates ut til nettet, i kW. Bekreftes fra nettilknytningen. Tomt = ukjent (regnes som ubegrenset og merkes som antakelse). 0 = ingen eksport." />
                </span>
                <NumField value={st.meteringPoint.exportLimitKw} width={70} placeholder="ukjent" suffix="kW" onCommit={(v) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, exportLimitKw: v } }))} />
              </label>
              <label>
                <span>
                  Målepunkt-ID <Help text="Identifikatoren for strømtilknytningen (18 siffer), fra faktura eller strømportal. Ikke det samme som målerens serienummer." />
                </span>
                <input
                  className={s.input}
                  defaultValue={st.meteringPoint.meterId}
                  placeholder="valgfritt"
                  onBlur={(e) => e.target.value !== st.meteringPoint.meterId && update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, meterId: e.target.value.trim() } }))}
                />
              </label>
              <div className={s.wide}>
                <FieldIssues issues={issuesFor("avtaler")} />
              </div>
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
                    ? hasBattery
                      ? "Tilbudet har batteri – solcelledelen er uavklart"
                      : investmentOre != null
                        ? `Hentet fra tilbudet: ${kr(investmentOre / 100)}`
                        : "Tilbudet har ingen sum ennå"
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
                <span>
                  Service og drift per år <Help text="Kundens årlige kostnad som følger av anlegget: service, overvåking, styring o.l. Bruk avtalt beløp eller et anslag. Er ikke samme beløp for alle prosjekter. Tomt = ikke oppgitt (standardverdien i Beregningsregler brukes hvis den finnes)." />
                </span>
                <NumField
                  value={st.economy.opex[0]?.nokPerYear ?? null}
                  width={80}
                  placeholder="ikke oppgitt"
                  suffix="kr/år"
                  onCommit={(v) =>
                    update((x) => ({
                      ...x,
                      economy: { ...x.economy, opex: v == null ? x.economy.opex.slice(1) : [{ name: x.economy.opex[0]?.name ?? "Service og drift", nokPerYear: v }, ...x.economy.opex.slice(1)] },
                    }))
                  }
                />
              </label>
              <label>
                <span>
                  Inverterbytte <Help text="Mulig utskifting av inverteren. «Fra tilbudet» = tilbudets inverterpris × faktoren i Beregningsregler (inkl. arbeid), utbetalt i det året. Beløpet er nominelt (utbetaling i utskiftingsåret)." />
                </span>
                <select
                  className={s.input}
                  value={st.economy.replacementSource}
                  onChange={(e) => update((x) => ({ ...x, economy: { ...x.economy, replacementSource: e.target.value as BusinessSettings["economy"]["replacementSource"] } }))}
                >
                  <option value="kalkyle">Fra tilbudets inverter</option>
                  <option value="manuell">Eget anslag</option>
                  <option value="ingen">Ikke med</option>
                </select>
                {st.economy.replacementSource === "kalkyle" && (
                  <span className={s.hint}>
                    {run?.quote
                      ? run.quote.inverterNok
                        ? `${kr(run.quote.inverterNok * run.quote.replacementFactor)} i år ${run.quote.replacementYear} (inverter ${kr(run.quote.inverterNok)} × ${nf(run.quote.replacementFactor, 2)})`
                        : "Tilbudet har ingen inverter med pris – legg inn eget anslag"
                      : "Regnes ut ved beregning"}
                  </span>
                )}
              </label>
              {st.economy.replacementSource === "manuell" && (
                <>
                  <label>
                    Utskifting i år
                    <NumField
                      value={st.economy.replacements[0]?.year ?? 15}
                      width={50}
                      onCommit={(v) =>
                        update((x) => ({
                          ...x,
                          economy: { ...x.economy, replacements: [{ name: x.economy.replacements[0]?.name ?? "Inverterbytte (anslag)", year: Math.round(v ?? 15), nok: x.economy.replacements[0]?.nok ?? 0 }] },
                        }))
                      }
                    />
                  </label>
                  <label>
                    Kostnad (utstyr + arbeid)
                    <NumField
                      value={st.economy.replacements[0]?.nok ?? null}
                      width={90}
                      placeholder="anslag"
                      suffix="kr"
                      onCommit={(v) =>
                        update((x) => ({
                          ...x,
                          economy: { ...x.economy, replacements: [{ name: x.economy.replacements[0]?.name ?? "Inverterbytte (anslag)", year: x.economy.replacements[0]?.year ?? 15, nok: v ?? 0 }] },
                        }))
                      }
                    />
                  </label>
                </>
              )}
            </div>
            <p className={`${s.small} ${s.muted}`} style={{ marginBottom: 0 }}>
              Nominelle kroner, eks. mva., før skatt og finansiering. Hvert år regnes energiflyten på nytt med degradert produksjon. Forsiktig scenario: ingen strømprisvekst.
            </p>
            <FieldIssues issues={issuesFor("økonomi")} />
          </fieldset>
        </div>

        {/* ---------------- Beregn */}
        <div className={s.footerbar} style={{ margin: "14px -16px -14px", borderRadius: 0, flexWrap: "wrap" }}>
          <span className={`${s.small} ${s.muted}`} style={{ flex: 1, minWidth: 260 }}>
            {phase ? (
              <strong role="status">{phase} …</strong>
            ) : (
              <>
                «Beregn analyse» lagrer skjemaet og regner med verdiene som vises og tilbudet slik det står nå. Spotpriser og PVGIS hentes første gang og
                lagres. «Oppdater kildedata» henter spotpriser og PVGIS på nytt (ikke tariffregisteret). Sendte tilbud endres aldri.
              </>
            )}
          </span>
          <span className={s.inline}>
            <button type="button" className={s.btn} disabled={running} onClick={() => doRun(true)} title="Henter spotpriser og PVGIS-simulering på nytt. Tariffregisteret oppdateres ikke.">
              Oppdater kildedata
            </button>
            <button type="button" className={`${s.btn} ${s.primary}`} disabled={running} onClick={() => doRun(false)}>
              {running ? "Beregner …" : "Beregn analyse"}
            </button>
          </span>
        </div>
      </div>

      {runError && (
        <div className={s.panelbody}>
          <div className={`${s.notice} ${s.error}`} style={{ margin: 0 }}>
            <strong>Analysen ble ikke beregnet.</strong> {runError}
          </div>
        </div>
      )}
      {run && <Result r={run.summary} quote={run.quote} stale={stale || quoteChanged} />}
      {showAdmin && (
        <TariffAdmin
          installerGroupId={installerGroupId}
          selectedId={st.meteringPoint.tariffId}
          onClose={async () => {
            setShowAdmin(false);
            setTariffs(await getTariffs(installerGroupId, { selected: settingsRef.current?.meteringPoint.tariffId }));
          }}
          onSelect={(id) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, tariffId: id, tariffConfirmed: false, tariffScenario: false } }))}
        />
      )}
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

const PERIOD_RANGE = (p: BusinessSettings["period"]): [string, string] => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return p.kind === "år" ? [`${p.year}-01-01`, `${p.year}-12-31`] : [`${p.year}-01-01`, `${p.year}-${pad(p.toMonth)}-${pad(p.toDay)}`];
};
const validity = (t: Tariff) => `${t.validFrom} – ${t.validTo ?? "inntil videre"}`;
const OWNER_LABEL: Record<Tariff["owner"], string> = { felles: "Felles register", egen: "Teamets egen", annen: "Annet team" };

function tariffRates(d: TariffDefinition) {
  return [
    `Fastledd ${nf(d.fixedNokPerYear)} kr/år`,
    `energiledd ${nf(d.energyOrePerKwh, 2)} øre/kWh`,
    d.power
      ? `effektledd ${nf(d.power.summerNokPerKwMonth, 2)} / ${nf(d.power.winterNokPerKwMonth, 2)} kr/kW/mnd (sommer/vinter), høyeste time hverdager kl. ${d.power.window.fromHour}–${d.power.window.toHour}`
      : "ingen effektledd",
  ].join(" · ");
}

/** Valgt tariff: hva den inneholder, om den dekker perioden, og selgerens kontroll mot fakturaen. */
function TariffCard({
  tariff,
  period,
  installerGroupId,
  confirmed,
  scenario,
  onConfirmed,
  onScenario,
  onCopied,
  onChooseOther,
}: {
  tariff?: Tariff;
  period: BusinessSettings["period"];
  installerGroupId: string;
  confirmed: boolean;
  scenario: boolean;
  onConfirmed: (v: boolean) => void;
  onScenario: (v: boolean) => void;
  onCopied: (t: Tariff) => void;
  onChooseOther: () => void;
}) {
  const [copying, setCopying] = useState(false);
  if (!tariff) return null;
  const d = tariff.definition;
  const [from, to] = PERIOD_RANGE(period);
  const covers = tariff.validFrom <= from && (tariff.validTo == null || tariff.validTo >= to);
  const copy = async () => {
    setCopying(true);
    try {
      const t = await duplicateTariff(tariff.id, installerGroupId);
      toast.success(`Kopien «${t.name}» er lagt til teamets tariffer.`);
      onCopied(t);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCopying(false);
    }
  };
  return (
    <div className={s.tariffcard}>
      <div className={s.tariffhead}>
        <strong>
          {tariff.gridOwner} – {tariff.name}
        </strong>
        <span className={`${s.pill} ${tariff.owner === "felles" ? s.st_calculated : s.st_assumed}`}>{OWNER_LABEL[tariff.owner]}</span>
        {tariff.archived && <span className={`${s.pill} ${s.st_assumed}`}>Arkivert</span>}
      </div>
      <div className={s.small}>
        Gyldig {validity(tariff)} · kundegruppe {tariff.customerGroup} · kontrollert {tariff.lastChecked}
        {tariff.sourceUrl && (
          <>
            {" "}
            ·{" "}
            <a href={tariff.sourceUrl} target="_blank" rel="noreferrer">
              kilde
            </a>
          </>
        )}
      </div>
      <div className={s.small}>{tariffRates(d)}</div>
      {d.rateChanges?.length ? (
        <div className={`${s.small} ${s.muted}`}>
          Satsendring: {d.rateChanges.map((c) => `fra ${c.from}${c.energyOrePerKwh != null ? ` energiledd ${nf(c.energyOrePerKwh, 2)} øre` : ""}`).join("; ")}
        </div>
      ) : null}
      {(d.minAnnualKwh != null || d.maxAnnualKwh != null || d.includedNote) && (
        <div className={`${s.small} ${s.muted}`}>
          {d.minAnnualKwh != null || d.maxAnnualKwh != null ? `Gjelder årsforbruk ${d.minAnnualKwh != null ? `fra ${nf(d.minAnnualKwh)}` : ""} ${d.maxAnnualKwh != null ? `til ${nf(d.maxAnnualKwh)}` : ""} kWh. ` : ""}
          {d.includedNote}
        </div>
      )}

      {!covers && (
        <div className={`${s.notice} ${scenario ? s.info : s.error}`} style={{ margin: "8px 0 0" }}>
          {scenario ? (
            <>Tariffen gjelder ikke analyseperioden ({from} – {to}). Nettleien regnes som et scenario og merkes slik i resultatet.</>
          ) : (
            <>
              <strong>Tariffen gjelder ikke analyseperioden ({from} – {to}).</strong> Analysen beregnes ikke før du velger riktig tariffversjon, legger inn satsene fra
              nettleiefakturaen, eller bruker denne bevisst som scenario.
            </>
          )}
          <div className={s.inline} style={{ marginTop: 6, flexWrap: "wrap" }}>
            <button type="button" className={`${s.btn} ${s.small2}`} onClick={onChooseOther}>
              Velg annen tariff
            </button>
            <label className={s.inline} style={{ fontWeight: 600 }}>
              <input type="checkbox" checked={scenario} onChange={(e) => onScenario(e.target.checked)} /> Bruk som scenario
            </label>
          </div>
        </div>
      )}

      <div className={s.inline} style={{ marginTop: 8, flexWrap: "wrap" }}>
        <label className={s.inline} style={{ fontWeight: 600 }}>
          <input type="checkbox" checked={confirmed} onChange={(e) => onConfirmed(e.target.checked)} /> Kontrollert mot kundens nettleiefaktura
        </label>
        {tariff.owner === "felles" && (
          <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} disabled={copying} onClick={copy} title="Lag en kopi teamet kan redigere, f.eks. med satsene fra fakturaen.">
            {copying ? "Kopierer …" : "Lag redigerbar kopi"}
          </button>
        )}
      </div>
      {!confirmed && <p className={`${s.small} ${s.muted}`} style={{ margin: "4px 0 0" }}>Ikke kontrollert: tariffen vises som «tariffregister · ikke bekreftet» i grunnlaget.</p>}
    </div>
  );
}

type TariffFormValues = { gridOwner: string; name: string; validFrom: string; validTo: string; fixed: string; energy: string; summer: string; winter: string; from: string; to: string; sourceUrl: string };

const toForm = (t?: Tariff): TariffFormValues => {
  const d = t?.definition;
  const str = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
  return {
    gridOwner: t?.gridOwner ?? "",
    name: t?.name ?? "Næring",
    validFrom: t?.validFrom ?? `${new Date().getFullYear()}-01-01`,
    validTo: t?.validTo ?? "",
    fixed: str(d?.fixedNokPerYear),
    energy: str(d?.energyOrePerKwh),
    summer: str(d?.power?.summerNokPerKwMonth),
    winter: str(d?.power?.winterNokPerKwMonth),
    from: String(d?.power?.window.fromHour ?? 6),
    to: String((d?.power?.window.toHour ?? 22) - 1),
    sourceUrl: t?.sourceUrl ?? "",
  };
};

/** Skjema for tariff fra nettleiefakturaen (ny) eller redigering av teamets egen tariff. */
function TariffForm({ installerGroupId, existing, onSaved, onCancel }: { installerGroupId: string; existing?: Tariff; onSaved: (t: Tariff) => void; onCancel: () => void }) {
  const [f, setF] = useState<TariffFormValues>(() => toForm(existing));
  const [saving, setSaving] = useState(false);
  const num = (x: string) => Number(x.replace(",", ".").replace(/\s/g, ""));
  const bad = (x: string) => x.trim() !== "" && !Number.isFinite(num(x));
  const invalid = !f.gridOwner.trim() || !f.name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(f.validFrom) || (f.validTo !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(f.validTo)) || [f.fixed, f.energy, f.summer, f.winter, f.from, f.to].some(bad);
  const save = async () => {
    setSaving(true);
    try {
      const hasPower = f.summer.trim() !== "" || f.winter.trim() !== "";
      const prev = existing?.definition;
      const definition: TariffDefinition = {
        ...(prev ?? {}),
        fixedNokPerYear: num(f.fixed || "0"),
        energyOrePerKwh: num(f.energy || "0"),
        power: hasPower
          ? {
              method: "maks_time_i_vindu",
              window: { weekdays: prev?.power?.window.weekdays ?? [1, 2, 3, 4, 5], fromHour: num(f.from), toHour: num(f.to) + 1, excludeHolidays: prev?.power?.window.excludeHolidays ?? true },
              summerMonths: prev?.power?.summerMonths ?? [4, 5, 6, 7, 8, 9],
              summerNokPerKwMonth: num(f.summer || "0"),
              winterNokPerKwMonth: num(f.winter || "0"),
            }
          : null,
        notes: prev?.notes?.length ? prev.notes : ["Lagt inn fra kundens nettleiefaktura. Effektgrunnlag: høyeste time i vinduet (hverdager), sommer april–september."],
      };
      const body = { gridOwner: f.gridOwner.trim(), name: f.name.trim(), validFrom: f.validFrom, validTo: f.validTo || null, sourceUrl: f.sourceUrl.trim() || null, definition };
      const t = existing ? await updateTariff(existing.id, { installerGroupId, ...body }) : await createTariff({ installerGroupId, ...body });
      toast.success(existing ? `«${t.name}» er oppdatert.` : `«${t.name}» er lagt til teamets tariffer.`);
      onSaved(t);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const field = (k: keyof TariffFormValues, label: string, w = 90, placeholder?: string) => (
    <label>
      {label}
      <input className={s.input} style={{ width: w }} value={f[k]} placeholder={placeholder} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </label>
  );
  return (
    <div className={s.manualtariff}>
      <p className={`${s.small} ${s.muted}`} style={{ width: "100%", margin: 0 }}>
        Satsene eks. mva. slik de står på nettleiefakturaen. Tomt effektledd = tariff uten effektledd. Tariffen lagres for teamet og kan gjenbrukes.
      </p>
      {field("gridOwner", "Nettselskap", 160)}
      {field("name", "Tariffnavn", 160)}
      {field("validFrom", "Gyldig fra", 110, "ÅÅÅÅ-MM-DD")}
      {field("validTo", "Gyldig til (valgfritt)", 110, "ÅÅÅÅ-MM-DD")}
      {field("fixed", "Fastledd kr/år")}
      {field("energy", "Energiledd øre/kWh")}
      {field("summer", "Effekt sommer kr/kW/mnd")}
      {field("winter", "Effekt vinter kr/kW/mnd")}
      {field("from", "Effektvindu fra kl.", 60)}
      {field("to", "til kl. (t.o.m.)", 60)}
      {field("sourceUrl", "Kilde (lenke, valgfritt)", 220)}
      <span className={s.inline}>
        <button type="button" className={`${s.btn} ${s.primary} ${s.small2}`} disabled={invalid || saving} onClick={save}>
          {saving ? "Lagrer …" : existing ? "Lagre endringer" : "Lagre tariff"}
        </button>
        <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} onClick={onCancel}>
          Avbryt
        </button>
      </span>
    </div>
  );
}

function ManualTariff({ installerGroupId, onCreated }: { installerGroupId: string; onCreated: (t: Tariff) => void }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className={`${s.btn} ${s.small2}`} onClick={() => setOpen(true)}>
        Legg inn fra nettleiefaktura
      </button>
    );
  return <TariffForm installerGroupId={installerGroupId} onSaved={(t) => (onCreated(t), setOpen(false))} onCancel={() => setOpen(false)} />;
}

/** Oversikt over teamets og felles tariffer: velg, rediger, kopier, slett/arkiver og gjenopprett. */
function TariffAdmin({ installerGroupId, selectedId, onClose, onSelect }: { installerGroupId: string; selectedId: string | null; onClose: () => void; onSelect: (id: string) => void }) {
  const [list, setList] = useState<Tariff[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Tariff | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      setList(await getTariffs(installerGroupId, { includeArchived: true, selected: selectedId }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [installerGroupId, selectedId]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = (t: Tariff) =>
    act(async () => {
      const r = await deleteTariff(t.id, installerGroupId);
      toast.success(r.deleted ? `«${t.name}» er slettet.` : `«${t.name}» er arkivert fordi den er brukt (${r.usage.analyses} analyse(r), ${r.usage.locked} sendt(e) tilbud).`);
      setConfirmDelete(null);
    });

  const shown = (list ?? []).filter((t) => showArchived || !t.archived);
  const groups: [string, Tariff[]][] = [
    ["Teamets tariffer", shown.filter((t) => t.owner === "egen")],
    ["Felles register (vedlikeholdes av Soleklart)", shown.filter((t) => t.owner === "felles")],
  ];
  const usageText = (t: Tariff) => (t.usage ? `Brukt i ${t.usage.analyses} analyse(r) · ${t.usage.locked} sendt(e) tilbud` : "");

  return (
    <Dialog
      title="Tariffer"
      onClose={onClose}
      footer={
        <>
          <label className={s.inline} style={{ marginRight: "auto" }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Vis arkiverte
          </label>
          <button type="button" className={`${s.btn} ${s.primary}`} onClick={onClose}>
            Ferdig
          </button>
        </>
      }
    >
      {error && <div className={`${s.notice} ${s.error}`}>{error}</div>}
      {!list && !error && <p className={s.muted}>Laster …</p>}
      <div style={{ marginBottom: 10 }}>
        {editing === "ny" ? (
          <TariffForm installerGroupId={installerGroupId} onSaved={() => (setEditing(null), load())} onCancel={() => setEditing(null)} />
        ) : (
          <button type="button" className={`${s.btn} ${s.small2}`} onClick={() => setEditing("ny")}>
            Ny tariff fra nettleiefaktura
          </button>
        )}
      </div>
      {groups.map(([title, rows]) => (
        <div key={title} style={{ marginBottom: 14 }}>
          <h3 className={s.grouphead}>{title}</h3>
          {rows.length === 0 && <p className={`${s.small} ${s.muted}`}>Ingen.</p>}
          {rows.map((t) => (
            <div key={t.id} className={s.tariffrow} style={{ opacity: t.archived ? 0.65 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>
                  {t.gridOwner} – {t.name}
                </strong>
                {t.id === selectedId && <span className={`${s.pill} ${s.st_measured}`} style={{ marginLeft: 6 }}>Valgt</span>}
                {t.archived && <span className={`${s.pill} ${s.st_assumed}`} style={{ marginLeft: 6 }}>Arkivert</span>}
                <div className={`${s.small} ${s.muted}`}>
                  Gyldig {validity(t)} · kontrollert {t.lastChecked}
                  {usageText(t) ? ` · ${usageText(t)}` : ""}
                </div>
                <div className={`${s.small} ${s.muted}`}>{tariffRates(t.definition)}</div>
                {editing === t.id && (
                  <TariffForm installerGroupId={installerGroupId} existing={t} onSaved={() => (setEditing(null), load())} onCancel={() => setEditing(null)} />
                )}
                {confirmDelete?.id === t.id && (
                  <div className={`${s.notice} ${s.error}`} style={{ margin: "8px 0 0" }}>
                    {t.usage && (t.usage.analyses > 0 || t.usage.locked > 0) ? (
                      <>
                        «{t.gridOwner} – {t.name}» er brukt ({usageText(t).toLowerCase()}) og blir <strong>arkivert</strong>, ikke slettet. Den forsvinner fra listen for nye valg,
                        men analyser og sendte tilbud beholder den.
                      </>
                    ) : (
                      <>
                        Slette «{t.gridOwner} – {t.name}» permanent? Den er ikke brukt i noen analyse.
                      </>
                    )}
                    <div className={s.inline} style={{ marginTop: 6 }}>
                      <button type="button" className={`${s.btn} ${s.small2} ${s.danger}`} disabled={busy} onClick={() => remove(t)}>
                        {t.usage && (t.usage.analyses > 0 || t.usage.locked > 0) ? "Arkiver" : "Slett"}
                      </button>
                      <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} onClick={() => setConfirmDelete(null)}>
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className={s.inline} style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
                {!t.archived && t.id !== selectedId && (
                  <button type="button" className={`${s.btn} ${s.small2}`} onClick={() => (onSelect(t.id), onClose())}>
                    Velg
                  </button>
                )}
                {t.owner === "egen" && !t.archived && editing !== t.id && (
                  <button
                    type="button"
                    className={`${s.btn} ${s.ghost} ${s.small2}`}
                    disabled={!!t.usage?.locked}
                    title={t.usage?.locked ? "Brukt i sendt tilbud. Lag en kopi for å endre satsene." : undefined}
                    onClick={() => setEditing(t.id)}
                  >
                    Rediger
                  </button>
                )}
                <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} disabled={busy} onClick={() => act(async () => toast.success(`Kopien «${(await duplicateTariff(t.id, installerGroupId)).name}» er laget.`))}>
                  Kopier
                </button>
                {t.owner === "egen" && !t.archived && (
                  <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} onClick={() => setConfirmDelete(t)}>
                    Slett
                  </button>
                )}
                {t.owner === "egen" && t.archived && (
                  <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} disabled={busy} onClick={() => act(() => updateTariff(t.id, { installerGroupId, archived: false }))}>
                    Gjenopprett
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </Dialog>
  );
}

// ---------------------------------------------------------------- resultat

function Result({ r, quote, stale }: { r: BusinessSummary; quote: QuoteContext; stale: boolean }) {
  const [scenario, setScenario] = useState(0);
  const eco = r.economy?.[scenario] ?? null;
  const maxCost = useMemo(() => Math.max(...r.months.map((m) => m.costBefore), 1), [r.months]);
  const sv = r.savings;
  const issues = r.issues ?? [];
  const errors = issues.filter((i) => i.level === "feil");
  const warns = issues.filter((i) => i.level === "advarsel");
  const assumed = issues.filter((i) => i.level === "antakelse");
  const valid = r.valid ?? errors.length === 0;
  const priceYear = r.years?.price ?? Number(r.period.label.match(/\d{4}/)?.[0] ?? lastFullYear);
  const hist = r.historical ?? { energySaving: sv.total, opex: 0, net: sv.total, opexItems: [] };
  const calculated = new Date(r.calculatedAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });
  const parts = [
    { label: "Spart kjøp av kraft (spot + påslag)", v: sv.kraft },
    { label: "Spart nettleie, energiledd", v: sv.nettleieEnergi },
    { label: "Spart nettleie, effektledd (lavere topper)", v: sv.effektledd },
    { label: "Spart elavgift", v: sv.elavgift },
    ...(sv.fastOgGebyr ? [{ label: "Fastledd og faste gebyrer", v: sv.fastOgGebyr }] : []),
    { label: "Salg av overskudd", v: sv.salg },
  ];
  const selfKwh = r.after.selfKwh;

  return (
    <div className={s.panelbody} style={{ borderTop: "1px solid var(--line)", opacity: stale ? 0.6 : 1 }}>
      {stale && <div className={`${s.notice} ${s.info}`}>Skjemaet eller tilbudet er endret siden beregningen. Beregn på nytt før du oppretter estimat.</div>}

      <div className={s.resulthead}>
        <strong>Beregnet {calculated}</strong>
        <span>{nf(r.system.kwp, 1)} kWp</span>
        <span>Investering {r.investmentNok == null ? "uavklart" : `${kr(r.investmentNok)} eks. mva.`}</span>
        <span>
          Prisår {priceYear}
          {r.period.complete ? "" : ` (${r.period.label})`} · værgrunnlag {r.years?.weather ?? "—"}
        </span>
        {quote.inverterAcKw != null && <span>Inverter {nf(quote.inverterAcKw, 1)} kW AC</span>}
      </div>

      {!valid && (
        <div className={`${s.notice} ${s.error}`}>
          <strong>Analysen er ikke gyldig og kan ikke vises for kunden.</strong> Rett feilene under og beregn på nytt. Tallene under er bare til kontroll.
        </div>
      )}
      {issues.length > 0 && (
        <div className={s.issuebox}>
          <strong className={s.small}>
            {errors.length} feil · {warns.length} å kontrollere · {assumed.length} antakelser
          </strong>
          <FieldIssues issues={[...errors, ...warns, ...assumed]} />
        </div>
      )}
      {r.scope?.batteryOffered && (
        <div className={`${s.notice} ${s.info}`}>Tilbudet har batteri. Batteriets nytte er ikke beregnet i denne analysen; resultatet gjelder solcelleanlegget alene.</div>
      )}

      <p style={{ margin: "12px 0", fontWeight: 600, opacity: valid ? 1 : 0.6 }}>{r.customerSentence}</p>

      <div className={s.grid} style={{ opacity: valid ? 1 : 0.6 }}>
        <div>
          <h3 className={s.grouphead}>Beregnet besparelse i {priceYear}</h3>
          <table>
            <tbody>
              {parts.map((p) => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  <td className={s.num}>{kr(p.v)}</td>
                </tr>
              ))}
              <tr>
                <td className={s.strong}>Sum lavere netto energikostnad</td>
                <td className={`${s.num} ${s.strong}`}>{kr(hist.energySaving)}</td>
              </tr>
              {hist.opexItems.length ? (
                hist.opexItems.map((o) => (
                  <tr key={o.name}>
                    <td>− {o.name}</td>
                    <td className={s.num}>−{kr(o.nok)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className={s.muted}>− Løpende kostnader (ikke oppgitt)</td>
                  <td className={s.num}>{kr(0)}</td>
                </tr>
              )}
              <tr>
                <td className={s.strong}>Netto årlig gevinst i {priceYear}</td>
                <td className={`${s.num} ${s.strong}`}>{kr(hist.net)}</td>
              </tr>
            </tbody>
          </table>
          <p className={`${s.small} ${s.muted}`}>
            Regnet time for time med faktiske priser og satser i {priceYear}. Strømregning før → etter: {kr(r.before.cost.netto)} → {kr(r.after.cost.netto)}. Fastledd er ikke regnet som spart.
          </p>
          <ul className={`${s.small} ${s.plainlist}`}>
            <li>
              <strong>Egenforbruk {pct(r.kpi.selfConsumptionShare)}</strong>: {kwh(selfKwh)} av {kwh(r.after.pvKwh)} solstrøm brukes i bygget, resten ({kwh(r.after.exportKwh)}) selges.
            </li>
            <li>
              <strong>Selvforsyning {pct(r.kpi.selfSufficiencyShare)}</strong>: {kwh(selfKwh)} av byggets forbruk på {kwh(r.after.loadKwh)} dekkes av solstrøm.
            </li>
            {(r.scope?.clippedKwh ?? 0) > 0 && (
              <li>
                {kwh(r.scope!.clippedKwh)} går tapt fordi inverteren er begrenset til {nf(r.scope!.inverterAcKw ?? 0, 1)} kW AC.
              </li>
            )}
          </ul>
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

      <h3 className={s.grouphead} style={{ marginTop: 16 }}>
        Økonomi over {r.assumptions.years} år
      </h3>
      {!eco ? (
        <p className={`${s.small} ${s.muted}`}>{r.economyNote ?? "Levetidsøkonomien er ikke beregnet."}</p>
      ) : (
        <div style={{ opacity: valid ? 1 : 0.6 }}>
          {r.economy && r.economy.length > 1 && (
            <div className={s.chips}>
              {r.economy.map((e, i) => (
                <button key={e.name} type="button" className={`${s.chip} ${i === scenario ? s.chipon : ""}`} onClick={() => setScenario(i)}>
                  {e.name}
                </button>
              ))}
            </div>
          )}
          <div className={s.kpis}>
            <div>
              <span>Investering eks. mva.</span>
              <strong>{r.investmentNok == null ? "Uavklart" : kr(r.investmentNok)}</strong>
            </div>
            <div>
              <span>Netto gevinst år 1 ({eco.name.toLowerCase()})</span>
              <strong>{kr(eco.firstYearNet)}</strong>
            </div>
            <div>
              <span>Tilbakebetaling ({eco.name.toLowerCase()})</span>
              <strong>{eco.paybackYears != null ? `${nf(eco.paybackYears, 1)} år` : r.investmentNok == null ? "—" : `Ikke innen ${r.assumptions.years} år`}</strong>
            </div>
            <div>
              <span>
                Nåverdi ({eco.name.toLowerCase()}, {nf(r.assumptions.discountRatePct, 2)} %)
              </span>
              <strong>{eco.npv != null ? kr(eco.npv) : "—"}</strong>
            </div>
            <div>
              <span>Internrente</span>
              <strong>{eco.irr != null ? `${nf(eco.irr * 100, 1)} %` : "—"}</strong>
            </div>
          </div>
          {r.investmentNok == null && (
            <p className={s.small}>
              Høyeste investering som gir positiv nåverdi: <strong>{kr(eco.pvOfOperations)}</strong> ({eco.name.toLowerCase()}).
            </p>
          )}
          <p className={`${s.small} ${s.muted}`}>
            År 1 bygger på {priceYear}-beregningen med vekst fra året etter: kraft {nf(eco.kraftGrowth * 100, 1)} %/år, nettleie {nf(r.assumptions.growth.nettleiePct, 1)} %/år, avgift{" "}
            {nf(r.assumptions.growth.avgiftPct, 1)} %/år, drift {nf(r.assumptions.growth.driftPct, 1)} %/år, degradering {nf(r.assumptions.degradationPct, 1)} %/år.{" "}
            {r.assumptions.replacements?.length ? `Utskifting: ${r.assumptions.replacements.map((x) => `${x.name} ${kr(x.nok)} i år ${x.year}`).join(", ")}.` : "Ingen utskifting er med."}{" "}
            {r.assumptions.vat} {r.assumptions.beforeTax}
          </p>
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
              Internrente: {eco.irr != null ? `${nf(eco.irr * 100, 1)} %` : (eco.irrNote ?? "—")} · Diskontert tilbakebetaling: {eco.discountedPaybackYears != null ? `${nf(eco.discountedPaybackYears, 1)} år` : "—"}
            </p>
          </details>
        </div>
      )}

      <details className={s.details}>
        <summary>Måned for måned ({priceYear})</summary>
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

      <details className={s.details} open>
        <summary>Datagrunnlag og forutsetninger</summary>
        <table>
          <tbody>
            {r.basis.map((b) => (
              <tr key={b.what}>
                <td style={{ width: 150 }}>{b.what}</td>
                <td>{b.sourceType ? <SourcePill type={b.sourceType} confirmed={b.confirmed} /> : <StatusPill status={b.status} />}</td>
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
