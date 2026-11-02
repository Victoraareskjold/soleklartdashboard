"use client";

// Næringsanalyse på estimatet (trinn 1: solceller for næringsbygg).
// Selger fyller inn så mye som er kjent; resten foreslås og merkes som antatt.
// Analysen regnes i kalkulatortjenesten time for time og låses sammen med estimatet ved «Opprett estimat».
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  type Charger,
  type ConsumptionSettings,
  type ExportLimitMode,
  type OtherMeter,
  type BatterySummary,
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
const COMPASS_OPTS = [
  { deg: 0, label: "Nord" }, { deg: 45, label: "Nordøst" }, { deg: 90, label: "Øst" }, { deg: 135, label: "Sørøst" },
  { deg: 180, label: "Sør" }, { deg: 225, label: "Sørvest" }, { deg: 270, label: "Vest" }, { deg: 315, label: "Nordvest" },
];
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
  // Norske tall: mellomrom som tusenskille og desimalkomma når feltet ikke redigeres
  const show = (v: number | null) => (v == null ? "" : v.toLocaleString("nb-NO", { maximumFractionDigits: 2 }));
  const [text, setText] = useState(show(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(show(value));
  }, [value, focused]);
  const commit = () => {
    const t = text.trim().replace(/[\s\u00a0\u202f]/g, "").replace("−", "-").replace(",", ".");
    if (t === "") return value != null && onCommit(null);
    const n = Number(t);
    if (!Number.isFinite(n)) {
      toast.error("Ugyldig tall");
      return setText(show(value));
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
        onFocus={() => setFocused(true)}
        onBlur={() => (setFocused(false), commit())}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      {suffix && <span className={s.suffix}>{suffix}</span>}
    </span>
  );
}

/** Feltetikett med hjelp, kontroll og kort instruksjon synlig under feltet. */
function F({ label, help, more, hint, wide, children }: { label: string; help?: string; more?: string; hint?: ReactNode; wide?: boolean; children: ReactNode }) {
  return (
    <label className={wide ? s.wide : undefined}>
      <span>
        {label}
        {help && <Help text={help} more={more} />}
      </span>
      {children}
      {hint && <span className={s.hint}>{hint}</span>}
    </label>
  );
}

type GroupKey = "bygg" | "anlegg" | "strom" | "okonomi" | "kontroll";
const GROUP_FIELDS: Record<GroupKey, (f: string) => boolean> = {
  bygg: (f) => ["forbruk", "sted", "periode", "mål", "lading"].includes(f) || f.startsWith("måler:"),
  anlegg: (f) => ["takflater", "produksjon", "batteri"].includes(f),
  strom: (f) => ["tariff", "elavgift", "avtaler"].includes(f),
  okonomi: (f) => f === "økonomi",
  kontroll: (f) => f === "kilder",
};

/** Én av de fem gruppene. Lukket gruppe viser en kort oppsummering. */
function Group({
  n,
  title,
  summary,
  open,
  onToggle,
  issues,
  more,
  moreOpen,
  onMore,
  children,
}: {
  n: number;
  title: string;
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  issues: AnalysisIssue[];
  more?: ReactNode;
  moreOpen?: boolean;
  onMore?: () => void;
  children: ReactNode;
}) {
  const err = issues.filter((i) => i.level === "feil").length;
  const warn = issues.filter((i) => i.level === "advarsel").length;
  return (
    <section className={s.nagroup}>
      <button type="button" className={s.nagrouphead} aria-expanded={open} onClick={onToggle}>
        <span className={s.nastep}>{n}</span>
        <strong>{title}</strong>
        {!open && <span className={s.nasummary}>{summary}</span>}
        <span className={s.nabadges}>
          {err > 0 && <span className={`${s.pill} ${s.st_error}`}>{err} feil</span>}
          {warn > 0 && <span className={`${s.pill} ${s.st_assumed}`}>{warn} å kontrollere</span>}
        </span>
        <span aria-hidden className={s.chev}>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className={s.nagroupbody}>
          {children}
          {more && (
            <>
              <button type="button" className={s.morebtn} aria-expanded={!!moreOpen} onClick={onMore}>
                {moreOpen ? "Færre innstillinger" : "Flere innstillinger"}
              </button>
              {moreOpen && <div className={s.moreinner}>{more}</div>}
            </>
          )}
          <FieldIssues issues={issues} />
        </div>
      )}
    </section>
  );
}

function TariffSelect({ id, value, tariffs, onChange }: { id: string; value: string | null; tariffs: Tariff[]; onChange: (v: string | null) => void }) {
  return (
    <select id={id} className={s.input} style={{ flex: 1, minWidth: 220 }} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
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
  );
}

const EXPORT_MODES: { value: ExportLimitMode; label: string }[] = [
  { value: "ukjent", label: "Ukjent (regnes uten grense, merkes)" },
  { value: "ingen_grense", label: "Ingen grense (bekreftet)" },
  { value: "grense", label: "Grense i kW" },
  { value: "ingen_eksport", label: "Ingen eksport (0 kW)" },
];

function hoursText(h: [number, number] | null) {
  return h ? `${String(h[0]).padStart(2, "0")}–${String(h[1]).padStart(2, "0")}` : "stengt";
}

/** Driftstid for én dagtype: fra–til eller stengt. */
function DayHours({ label, value, onChange }: { label: string; value: [number, number] | null; onChange: (v: [number, number] | null) => void }) {
  return (
    <div className={s.dayhours}>
      <span>{label}</span>
      <label className={s.check} style={{ fontWeight: 400, fontSize: 12 }}>
        <input type="checkbox" checked={value == null} onChange={(e) => onChange(e.target.checked ? null : [7, 17])} /> stengt
      </label>
      {value && (
        <span className={s.inline}>
          <NumField ariaLabel={`${label} fra`} value={value[0]} width={48} onCommit={(v) => onChange([Math.max(0, Math.min(23, v ?? 0)), value[1]])} />–
          <NumField ariaLabel={`${label} til`} value={value[1]} width={48} suffix="kl." onCommit={(v) => onChange([value[0], Math.max(1, Math.min(24, v ?? 24))])} />
        </span>
      )}
    </div>
  );
}

/** Forbruksgrunnlag for et målepunkt (hovedmåler eller andre målere). */
function ConsumptionInput({
  c,
  onChange,
  typeLabel,
  hoursLabel,
  fileBlock,
}: {
  c: ConsumptionSettings;
  onChange: (fn: (c: ConsumptionSettings) => ConsumptionSettings) => void;
  typeLabel: string;
  hoursLabel: string;
  fileBlock: ReactNode;
}) {
  return (
    <>
      <div className={s.chips} role="radiogroup" aria-label="Forbruksgrunnlag">
        {(
          [
            [1, "Anslått profil (årsforbruk)"],
            [2, "Tilpasset kundens månedsforbruk"],
            [3, "Kundens målte forbruk (fil)"],
          ] as const
        ).map(([lvl, label]) => (
          <button key={lvl} type="button" role="radio" aria-checked={c.level === lvl} className={`${s.chip} ${c.level === lvl ? s.chipon : ""}`} onClick={() => onChange((x) => ({ ...x, level: lvl }))}>
            {label}
          </button>
        ))}
      </div>
      {c.level === 1 && (
        <div className={s.fields2}>
          <F
            label="Årsforbruk"
            help="Hvor mye strøm bygget bruker på ett år, i kWh. Finnes i årsoversikten fra nettselskapet eller i strømportalen."
            more="Eksempel: 60 000 kWh. Mangler tallet, legg inn et anslag og velg «Anslag» som kilde – da merkes resultatet som anslått."
            hint={`Fordeles over døgn og år med standardprofil for ${typeLabel.toLowerCase()} (${hoursLabel}).`}
          >
            <NumField value={c.annualKwh} width={130} suffix="kWh" onCommit={(v) => onChange((x) => ({ ...x, annualKwh: v }))} />
          </F>
          <F label="Kilde for forbruk" help="Hvor tallet kommer fra. Vises i grunnlaget slik at kunden ser hva det bygger på.">
            <select
              className={s.input}
              value={c.source ?? (c.annualKwhStatus === "målt" ? "faktura" : "anslag")}
              onChange={(e) => {
                const v = e.target.value as NonNullable<ConsumptionSettings["source"]>;
                onChange((x) => ({ ...x, source: v, annualKwhStatus: v === "anslag" ? "antatt" : "målt" }));
              }}
            >
              <option value="anslag">Anslag</option>
              <option value="kunde">Oppgitt av kunden</option>
              <option value="faktura">Faktura / nettselskap</option>
            </select>
          </F>
        </div>
      )}
      {c.level === 2 && (
        <div className={s.monthgrid}>
          {MONTHS.map((m, i) => (
            <label key={m}>
              {m}
              <NumField
                value={c.monthlyKwh?.[i] ?? null}
                width={84}
                onCommit={(v) =>
                  onChange((x) => {
                    const arr = [...(x.monthlyKwh ?? Array(12).fill(0))];
                    arr[i] = v ?? 0;
                    return { ...x, monthlyKwh: arr };
                  })
                }
              />
            </label>
          ))}
          <p className={`${s.small} ${s.muted}`} style={{ gridColumn: "1 / -1", margin: 0 }}>
            kWh per måned, f.eks. fra fakturaene. Det forbedrer sesongfordelingen, men sier ikke når på døgnet strømmen brukes.
          </p>
        </div>
      )}
      {c.level === 3 && fileBlock}
    </>
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
  const [open, setOpen] = useState<Record<GroupKey, boolean>>({ bygg: true, anlegg: true, strom: true, okonomi: true, kontroll: true });
  const [more, setMore] = useState<Record<GroupKey, boolean>>({ bygg: false, anlegg: false, strom: false, okonomi: false, kontroll: false });
  const [editKwp, setEditKwp] = useState(false);
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
  const mp = (patch: Partial<BusinessSettings["meteringPoint"]>) => update((x) => ({ ...x, meteringPoint: { ...x.meteringPoint, ...patch } }));
  const eco = (patch: Partial<BusinessSettings["economy"]>) => update((x) => ({ ...x, economy: { ...x.economy, ...patch } }));
  const bat = (patch: Partial<BusinessSettings["battery"]>) => update((x) => ({ ...x, battery: { ...x.battery, ...patch } }));

  const doRun = async (refresh: boolean) => {
    if (!analysis) return;
    // Felt som lagres ved blur: avslutt redigeringen først, så siste verdi kommer med
    (document.activeElement as HTMLElement | null)?.blur?.();
    await new Promise((r) => setTimeout(r, 0));
    if (timer.current) clearTimeout(timer.current);
    setRunning(true);
    setRunError(null);
    const steps = [
      "Lagrer skjemaet",
      "Kontrollerer forbruk og tariff",
      refresh ? "Henter spotpriser og solproduksjon på nytt" : "Henter solproduksjon og spotpriser",
      "Beregner resultat",
      ...(hasBattery || settingsRef.current?.battery.include === "ja" ? ["Planlegger batteristyring"] : []),
    ];
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
  const allIssues = run?.summary.issues ?? [];
  const groupIssues = (g: GroupKey) => allIssues.filter((i) => GROUP_FIELDS[g](i.field));

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
  const hoursLabel = st.schedule
    ? `hverdager ${hoursText(st.schedule.weekdays)}, lørdag ${hoursText(st.schedule.saturday)}, søndag ${hoursText(st.schedule.sunday)}`
    : `driftstid ${hours[0]}–${hours[1]} på hverdager, lavere i helg og på helligdager`;
  const seriesFor = (mpId: string, kind: "forbruk" | "produksjon") => series.filter((x) => x.kind === kind && x.meteringPointId === mpId);
  const activeFor = (mpId: string, kind: "forbruk" | "produksjon") => seriesFor(mpId, kind).find((x) => x.active);
  const qb = run?.quote.battery ?? null;
  const batteryOn = st.battery.include === "ja" || (st.battery.include === "auto" && (hasBattery || !!qb));
  const tariff = tariffs.find((t) => t.id === st.meteringPoint.tariffId);
  const consumptionLabel = { 1: "anslått profil", 2: "tilpasset månedsforbruk", 3: "kundens målte forbruk" }[st.consumption.level];
  const isoToNo = (iso: string) => iso.split("-").reverse().map((x, i) => (i < 2 ? String(Number(x)) : x)).join(".");
  const periodText =
    st.period.kind === "år"
      ? `${st.period.year}`
      : st.period.kind === "hittil"
        ? `1.1.–${st.period.toDay}.${st.period.toMonth}.${st.period.year}`
        : `${isoToNo(st.period.from)}–${isoToNo(st.period.to)}`;
  const surfacesKwp = run?.summary.system.kwp ?? kwp;
  const meterIds = [{ id: st.meteringPoint.id, label: st.meteringPoint.label }, ...st.otherMeters.map((m) => ({ id: m.id, label: m.label }))];

  const setOther = (i: number, fn: (m: OtherMeter) => OtherMeter) => update((x) => ({ ...x, otherMeters: x.otherMeters.map((m, j) => (j === i ? fn(m) : m)) }));

  return (
    <section className={s.panel}>
      <div className={s.panelhead}>
        <div>
          <h2>Næringsanalyse – lønnsomhet time for time</h2>
          <div className={`${s.small} ${s.muted}`}>
            Følger estimatet og låses når estimatet opprettes. {saveState === "lagret" ? "Lagret." : saveState === "lagrer" ? "Lagrer …" : "Ulagrede endringer."}
          </div>
        </div>
        <span className={s.inline}>
          <button
            type="button"
            className={`${s.btn} ${s.ghost} ${s.small2}`}
            onClick={() => {
              const all = Object.values(open).every(Boolean);
              setOpen({ bygg: !all, anlegg: !all, strom: !all, okonomi: !all, kontroll: true });
            }}
          >
            {Object.values(open).every(Boolean) ? "Lukk alle" : "Åpne alle"}
          </button>
          <label className={s.check}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Ta med i tilbudet
          </label>
        </span>
      </div>

      <div className={s.panelbody}>
        {hasBattery && (
          <div className={`${s.notice} ${s.info}`}>
            Tilbudet inneholder batteri. Analysen regner tre alternativer: solceller alene, med batteri på grunnstyring og med smart prisstyring. Se batterikortet
            under «Anlegget».
          </div>
        )}

        {/* ================= 1 Bygget og perioden */}
        <Group
          n={1}
          title="Bygget og perioden"
          open={open.bygg}
          onToggle={() => setOpen((o) => ({ ...o, bygg: !o.bygg }))}
          moreOpen={more.bygg}
          onMore={() => setMore((m) => ({ ...m, bygg: !m.bygg }))}
          issues={groupIssues("bygg")}
          summary={
            <>
              {typeInfo.label} · {periodText} · {consumptionLabel}
              {st.consumption.level === 1 && st.consumption.annualKwh ? ` ${kwh(st.consumption.annualKwh)}` : ""} · {st.location.priceArea ?? "prisområde fra adresse"}
              {st.otherMeters.length ? ` · ${st.otherMeters.length + 1} målere` : ""}
              {st.charging.enabled && st.charging.chargers.length ? " · lading" : ""}
            </>
          }
          more={
            <div className={s.fields2}>
              <div className={s.wide}>
                <span className={s.fieldlabel}>
                  Driftstider per dag
                  <Help
                    text="Når er virksomheten vanligvis i drift? Brukes bare til å anslå forbruksprofilen når måledata mangler."
                    more="Eksempel: mandag–fredag 07–17, lørdag stengt. Forbruk utenom åpningstid blir ikke null – grunnlasten (ventilasjon, kjøl o.l.) er med."
                  />
                </span>
                <label className={s.check} style={{ fontWeight: 400, fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={st.schedule != null}
                    onChange={(e) => update((x) => ({ ...x, schedule: e.target.checked ? { weekdays: hours, saturday: null, sunday: null, closedMonths: [] } : null }))}
                  />
                  Egne driftstider for hverdag, lørdag og søndag, og måneder med redusert drift
                </label>
                {st.schedule ? (
                  <div className={s.dayhoursgrid}>
                    <DayHours label="Hverdager" value={st.schedule.weekdays} onChange={(v) => update((x) => ({ ...x, schedule: { ...x.schedule!, weekdays: v } }))} />
                    <DayHours label="Lørdag" value={st.schedule.saturday} onChange={(v) => update((x) => ({ ...x, schedule: { ...x.schedule!, saturday: v } }))} />
                    <DayHours label="Søndag/helligdag" value={st.schedule.sunday} onChange={(v) => update((x) => ({ ...x, schedule: { ...x.schedule!, sunday: v } }))} />
                    <div className={s.dayhours}>
                      <span>Redusert drift</span>
                      <span className={s.chips} style={{ margin: 0 }}>
                        {MONTHS.map((mn, i) => {
                          const on = st.schedule!.closedMonths?.includes(i + 1) ?? false;
                          return (
                            <button
                              key={mn}
                              type="button"
                              aria-pressed={on}
                              className={`${s.chip} ${on ? s.chipon : ""}`}
                              style={{ padding: "2px 8px", fontSize: 12 }}
                              onClick={() =>
                                update((x) => {
                                  const cur = x.schedule!.closedMonths ?? [];
                                  return { ...x, schedule: { ...x.schedule!, closedMonths: on ? cur.filter((m) => m !== i + 1) : [...cur, i + 1].sort((a, b) => a - b) } };
                                })
                              }
                            >
                              {mn}
                            </button>
                          );
                        })}
                      </span>
                      <Help text="Måneder med redusert drift, f.eks. fellesferie i juli. Da regnes bare grunnlasten (ventilasjon, kjøl o.l.) i måneden." />
                    </div>
                  </div>
                ) : (
                  <div className={s.inline} style={{ marginTop: 6 }}>
                    <span className={s.small}>Hverdager</span>
                    <NumField ariaLabel="Driftstid fra" value={hours[0]} width={48} onCommit={(v) => update((x) => ({ ...x, openHours: [Math.max(0, Math.min(24, v ?? 0)), hours[1]] }))} />–
                    <NumField ariaLabel="Driftstid til" value={hours[1]} width={48} suffix="kl." onCommit={(v) => update((x) => ({ ...x, openHours: [hours[0], Math.max(0, Math.min(24, v ?? 24))] }))} />
                    <span className={`${s.small} ${s.muted}`}>Helg: typisk for {typeInfo.label.toLowerCase()}</span>
                  </div>
                )}
              </div>
              <F
                label="Prisområde"
                help="Området som bestemmer spotprisen, f.eks. NO1. Foreslås fra adressen. Dette er ikke det samme som nettselskap."
                hint={st.location.priceAreaSource === "foreslått" ? "Foreslått fra adressen – kontroller." : "Valgt manuelt."}
              >
                <select
                  className={s.input}
                  value={st.location.priceArea ?? ""}
                  onChange={(e) => update((x) => ({ ...x, location: { ...x.location, priceArea: (e.target.value || null) as PriceArea | null, priceAreaSource: e.target.value ? "valgt" : "foreslått" } }))}
                >
                  <option value="">Foreslå fra adresse</option>
                  {(["NO1", "NO2", "NO3", "NO4", "NO5"] as const).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </F>
              <F
                label="Målepunkt-ID"
                help="Identifikatoren for strømtilknytningen (18 siffer), fra faktura eller strømportal."
                more="Er ikke nødvendigvis det samme som målerens serienummer. Hentes fra målefilen når den har det."
              >
                <input className={s.input} defaultValue={st.meteringPoint.meterId} placeholder="valgfritt" onBlur={(e) => e.target.value !== st.meteringPoint.meterId && mp({ meterId: e.target.value.trim() })} />
              </F>

              {/* ---- Lading */}
              <div className={`${s.wide} ${s.subbox}`}>
                <label className={s.check}>
                  <input type="checkbox" checked={st.charging.enabled} onChange={(e) => update((x) => ({ ...x, charging: { ...x.charging, enabled: e.target.checked, chargers: x.charging.chargers.length ? x.charging.chargers : [{ label: "Ladepunkter", count: 4, kw: 22, kwhPerDay: 30, window: [8, 16], days: "hverdager" }] } }))} />
                  Lading (elbil, maskiner)
                  <Help
                    text="Planlagt lading som legges til forbruket i alle alternativene. Brukes for å se hvor mye solstrøm som går til lading og hvordan effekttoppen påvirkes."
                    more="Fordelt jevnt i ladevinduet (anslag). Er ladingen allerede med i kundens målte forbruk, kryss av for det, så telles den ikke to ganger."
                  />
                </label>
                {st.charging.enabled && (
                  <>
                    <label className={s.check} style={{ fontWeight: 400, fontSize: 12 }}>
                      <input type="checkbox" checked={st.charging.inConsumption} onChange={(e) => update((x) => ({ ...x, charging: { ...x.charging, inConsumption: e.target.checked } }))} />
                      Ladingen finnes allerede i forbruksdataene
                    </label>
                    {st.charging.chargers.map((c, i) => {
                      const set = (patch: Partial<Charger>) => update((x) => ({ ...x, charging: { ...x.charging, chargers: x.charging.chargers.map((y, j) => (j === i ? { ...y, ...patch } : y)) } }));
                      return (
                        <div key={i} className={s.chargerrow}>
                          <input className={s.input} aria-label="Navn" defaultValue={c.label} onBlur={(e) => set({ label: e.target.value })} style={{ width: 130 }} />
                          <NumField ariaLabel="Antall" value={c.count} width={44} suffix="stk ×" onCommit={(v) => set({ count: Math.max(1, Math.round(v ?? 1)) })} />
                          <NumField ariaLabel="Effekt per ladepunkt" value={c.kw} width={54} suffix="kW," onCommit={(v) => set({ kw: Math.max(1, v ?? 22) })} />
                          <NumField ariaLabel="Energi per dag" value={c.kwhPerDay} width={54} suffix="kWh/dag hver, kl." onCommit={(v) => set({ kwhPerDay: Math.max(0, v ?? 0) })} />
                          <NumField ariaLabel="Ladevindu fra" value={c.window[0]} width={40} onCommit={(v) => set({ window: [Math.max(0, Math.min(23, v ?? 8)), c.window[1]] })} />–
                          <NumField ariaLabel="Ladevindu til" value={c.window[1]} width={40} onCommit={(v) => set({ window: [c.window[0], Math.max(1, Math.min(24, v ?? 16))] })} />
                          <select className={s.input} value={c.days} onChange={(e) => set({ days: e.target.value as Charger["days"] })} aria-label="Dager">
                            <option value="hverdager">hverdager</option>
                            <option value="alle">alle dager</option>
                          </select>
                          <button type="button" className={`${s.btn} ${s.ghost} ${s.danger} ${s.small2}`} onClick={() => update((x) => ({ ...x, charging: { ...x.charging, chargers: x.charging.chargers.filter((_, j) => j !== i) } }))}>
                            Fjern
                          </button>
                        </div>
                      );
                    })}
                    <div className={s.inline} style={{ flexWrap: "wrap" }}>
                      <button type="button" className={`${s.btn} ${s.small2}`} onClick={() => update((x) => ({ ...x, charging: { ...x.charging, chargers: [...x.charging.chargers, { label: "Ladepunkt", count: 1, kw: 22, kwhPerDay: 30, window: [8, 16], days: "hverdager" }] } }))}>
                        Legg til ladepunkter
                      </button>
                      {st.otherMeters.length > 0 && (
                        <label className={s.inline} style={{ fontSize: 12 }}>
                          på
                          <select className={s.input} value={st.charging.meteringPointId ?? st.meteringPoint.id} onChange={(e) => update((x) => ({ ...x, charging: { ...x.charging, meteringPointId: e.target.value } }))}>
                            {meterIds.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* ---- Flere målere */}
              <div className={`${s.wide} ${s.subbox}`}>
                <span className={s.fieldlabel}>
                  Flere målepunkter
                  <Help
                    text="Har kunden flere strømmålere, kan hver få eget forbruk og egen tariff. Takflatene kan kobles til måleren de skal stå bak."
                    more="Resultatet summerer alle målerne og viser besparelsen per måler. Strømavtale og elavgift følger hovedmåleren."
                  />
                </span>
                <div className={s.inline} style={{ marginBottom: 6 }}>
                  <span className={s.small}>Hovedmåler:</span>
                  <input className={s.input} style={{ width: 180 }} aria-label="Navn på hovedmåleren" defaultValue={st.meteringPoint.label} onBlur={(e) => e.target.value !== st.meteringPoint.label && mp({ label: e.target.value || "Hovedmåler" })} />
                </div>
                {st.otherMeters.map((m, i) => (
                  <div key={m.id} className={s.meterbox}>
                    <div className={s.inline} style={{ width: "100%", flexWrap: "wrap" }}>
                      <input className={s.input} style={{ width: 160 }} aria-label="Navn på måleren" defaultValue={m.label} onBlur={(e) => setOther(i, (x) => ({ ...x, label: e.target.value || "Måler" }))} />
                      <input className={s.input} style={{ width: 170 }} aria-label="Målepunkt-ID" placeholder="målepunkt-ID" defaultValue={m.meterId} onBlur={(e) => setOther(i, (x) => ({ ...x, meterId: e.target.value.trim() }))} />
                      <TariffSelect id={`na-tariff-${m.id}`} value={m.tariffId} tariffs={tariffs} onChange={(v) => setOther(i, (x) => ({ ...x, tariffId: v, tariffConfirmed: false, tariffScenario: false }))} />
                      <label className={s.check} style={{ fontWeight: 400, fontSize: 12 }}>
                        <input type="checkbox" checked={m.tariffConfirmed} onChange={(e) => setOther(i, (x) => ({ ...x, tariffConfirmed: e.target.checked }))} /> kontrollert mot faktura
                      </label>
                      <label className={s.check} style={{ fontWeight: 400, fontSize: 12 }}>
                        <input type="checkbox" checked={m.tariffScenario} onChange={(e) => setOther(i, (x) => ({ ...x, tariffScenario: e.target.checked }))} /> scenario
                      </label>
                      <button type="button" className={`${s.btn} ${s.ghost} ${s.danger} ${s.small2}`} onClick={() => update((x) => ({ ...x, otherMeters: x.otherMeters.filter((_, j) => j !== i), production: { ...x.production, surfaces: x.production.surfaces.map((f) => (f.meteringPointId === m.id ? { ...f, meteringPointId: null } : f)) } }))}>
                        Fjern måler
                      </button>
                    </div>
                    <ConsumptionInput
                      c={m.consumption}
                      onChange={(fn) => setOther(i, (x) => ({ ...x, consumption: fn(x.consumption) }))}
                      typeLabel={typeInfo.label}
                      hoursLabel={hoursLabel}
                      fileBlock={<SeriesBlock kind="forbruk" analysisId={analysis.id} meteringPointId={m.id} active={activeFor(m.id, "forbruk")} all={seriesFor(m.id, "forbruk")} onChanged={reload} onMeter={(id) => id && !m.meterId && setOther(i, (x) => ({ ...x, meterId: id }))} />}
                    />
                    <div className={s.inline} style={{ flexWrap: "wrap", marginTop: 6 }}>
                      <span className={s.small}>Eksportgrense</span>
                      <select className={s.input} value={m.exportLimitMode} onChange={(e) => setOther(i, (x) => ({ ...x, exportLimitMode: e.target.value as ExportLimitMode }))}>
                        {EXPORT_MODES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {m.exportLimitMode === "grense" && <NumField value={m.exportLimitKw} width={70} suffix="kW" onCommit={(v) => setOther(i, (x) => ({ ...x, exportLimitKw: v }))} />}
                    </div>
                    <FieldIssues issues={allIssues.filter((x) => x.field === `måler:${m.id}`)} />
                  </div>
                ))}
                <button
                  type="button"
                  className={`${s.btn} ${s.small2}`}
                  onClick={() =>
                    update((x) => ({
                      ...x,
                      otherMeters: [
                        ...x.otherMeters,
                        {
                          id: `mp${Date.now().toString(36)}`,
                          label: `Måler ${x.otherMeters.length + 2}`,
                          meterId: "",
                          tariffId: null,
                          tariffConfirmed: false,
                          tariffScenario: false,
                          exportLimitMode: "ukjent",
                          exportLimitKw: null,
                          importLimitKw: null,
                          consumption: { level: 1, annualKwh: null, annualKwhStatus: "antatt", monthlyKwh: null, source: "anslag" },
                        },
                      ],
                    }))
                  }
                >
                  Legg til målepunkt
                </button>
              </div>
            </div>
          }
        >
          <div className={s.fields2}>
            <F
              wide
              label="Adresse"
              help="Adressen til bygget som skal få anlegget. Brukes til solsimuleringen og forslag til prisområde."
              more="Kontroller karttreffet ved usikker adresse. Prisområdet sier ikke hvilket nettselskap kunden har."
              hint={
                st.location.lat != null
                  ? `Kartpunkt ${nf(st.location.lat, 4)}, ${nf(st.location.lon ?? 0, 4)}${st.location.priceArea ? ` · prisområde ${st.location.priceArea}${st.location.priceAreaSource === "foreslått" ? " (foreslått – kontroller)" : ""}` : ""}`
                  : "Trykk «Finn» for å kontrollere karttreffet."
              }
            >
              <span className={s.inline} style={{ width: "100%" }}>
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
              </span>
            </F>
            <F
              label="Analyseår"
              help="Året (eller delen av året) som skal undersøkes. Priser, forbruk, værgrunnlag og tariffperioder knyttes til denne perioden."
              more="Egendefinert periode: f.eks. 14.3.–13.3. når kundens målefil dekker det. 12 måneder gir også økonomi over levetiden; kortere perioder vises som de er, ikke oppskalert."
              hint="Resultatet svarer på: «Hva ville anlegget ha spart i denne perioden?»"
            >
              <span className={s.inline}>
                <select
                  className={s.input}
                  aria-label="Periode"
                  value={st.period.kind}
                  onChange={(e) => {
                    const now = new Date();
                    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    const yesterday = new Date(now.getTime() - 86_400_000);
                    const yearAgo = new Date(yesterday.getTime() - 364 * 86_400_000);
                    update((x) => ({
                      ...x,
                      period:
                        e.target.value === "år"
                          ? { kind: "år", year: lastFullYear }
                          : e.target.value === "hittil"
                            ? { kind: "hittil", year: now.getFullYear(), toMonth: now.getMonth() + 1, toDay: Math.max(1, now.getDate() - 1) }
                            : { kind: "egendefinert", year: yearAgo.getFullYear(), from: iso(yearAgo), to: iso(yesterday) },
                    }));
                  }}
                >
                  <option value="år">Helt år</option>
                  <option value="hittil">Hittil i år</option>
                  <option value="egendefinert">Egendefinert (inntil 12 mnd)</option>
                </select>
                {st.period.kind === "egendefinert" ? (
                  <>
                    <input
                      type="date"
                      aria-label="Fra og med"
                      className={s.input}
                      value={st.period.from}
                      onChange={(e) => e.target.value && update((x) => ({ ...x, period: { ...(x.period as { kind: "egendefinert"; year: number; from: string; to: string }), from: e.target.value, year: Number(e.target.value.slice(0, 4)) } }))}
                    />
                    –
                    <input
                      type="date"
                      aria-label="Til og med"
                      className={s.input}
                      value={st.period.to}
                      onChange={(e) => e.target.value && update((x) => ({ ...x, period: { ...(x.period as { kind: "egendefinert"; year: number; from: string; to: string }), to: e.target.value } }))}
                    />
                  </>
                ) : st.period.kind === "år" ? (
                  <select className={s.input} aria-label="År" value={st.period.year} onChange={(e) => update((x) => ({ ...x, period: { kind: "år", year: Number(e.target.value) } }))}>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="date"
                    aria-label="Til og med"
                    className={s.input}
                    value={st.period.kind === "hittil" ? `${st.period.year}-${String(st.period.toMonth).padStart(2, "0")}-${String(st.period.toDay).padStart(2, "0")}` : ""}
                    onChange={(e) => {
                      const [y, m, d] = e.target.value.split("-").map(Number);
                      if (y && m && d) update((x) => ({ ...x, period: { kind: "hittil", year: y, toMonth: m, toDay: d } }));
                    }}
                  />
                )}
              </span>
            </F>
            <F
              label="Virksomhetstype"
              help="Velg typen drift som ligner bygget. Brukes til å anslå når strømmen brukes dersom vi mangler måledata."
              more="Eksempel: kontor eller døgnkontinuerlig drift. Med kundens målte forbruk styrer måledataene beregningen, og virksomhetstypen endrer ikke tallene."
              hint={st.consumption.level === 3 ? "Kundens målte forbruk styrer beregningen." : hoursLabel}
            >
              <select className={s.input} value={st.businessType} onChange={(e) => update((x) => ({ ...x, businessType: e.target.value as BusinessSettings["businessType"], openHours: null }))}>
                {BUSINESS_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </F>
            <div className={s.wide}>
              <span className={s.fieldlabel}>
                Forbruksgrunnlag
                <Help
                  text="Hvor godt vi kjenner forbruket. Anslått profil er en normal og tillatt arbeidsflyt – resultatet merkes da som anslått."
                  more="Målefil: Excel/CSV med tidspunkt og forbruk (timer eller kvarter). Kontroller foreslått enhet, målepunkt, periode og manglende intervaller før bruk."
                />
              </span>
              <ConsumptionInput
                c={st.consumption}
                onChange={(fn) => update((x) => ({ ...x, consumption: fn(x.consumption) }))}
                typeLabel={typeInfo.label}
                hoursLabel={hoursLabel}
                fileBlock={
                  <SeriesBlock
                    kind="forbruk"
                    analysisId={analysis.id}
                    meteringPointId={st.meteringPoint.id}
                    active={activeFor(st.meteringPoint.id, "forbruk")}
                    all={seriesFor(st.meteringPoint.id, "forbruk")}
                    onChanged={reload}
                    onMeter={(meterId) => meterId && !st.meteringPoint.meterId && mp({ meterId })}
                  />
                }
              />
            </div>
            <div className={s.wide}>
              <span className={s.fieldlabel}>
                Mål
                <Help text="Hva ønsker kunden særlig å oppnå? Valget endrer ikke beregningen, men viser hva som er med." more="Lading regnes når ladepunkter er lagt inn (Flere innstillinger). Nødstrøm regnes som en reserve i batteriet." />
              </span>
              <div className={s.chips}>
                {GOALS.map((g) => {
                  const on = st.goals.includes(g.value);
                  const note =
                    g.value === "lading"
                      ? st.charging.enabled && st.charging.chargers.length
                        ? "· regnes med"
                        : "· legg inn ladepunkter"
                      : g.value === "nødstrøm"
                        ? batteryOn
                          ? "· reserve i batteriet"
                          : "· krever batteri"
                        : null;
                  return (
                    <button
                      key={g.value}
                      type="button"
                      aria-pressed={on}
                      className={`${s.chip} ${on ? s.chipon : ""}`}
                      onClick={() => update((x) => ({ ...x, goals: on ? x.goals.filter((v) => v !== g.value) : [...x.goals, g.value] }))}
                    >
                      {g.label}
                      {note && <span className={s.notyet}> {note}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Group>

        {/* ================= 2 Anlegget */}
        <Group
          n={2}
          title="Anlegget"
          open={open.anlegg}
          onToggle={() => setOpen((o) => ({ ...o, anlegg: !o.anlegg }))}
          moreOpen={more.anlegg}
          onMore={() => setMore((m) => ({ ...m, anlegg: !m.anlegg }))}
          issues={groupIssues("anlegg")}
          summary={
            <>
              {surfacesKwp != null ? `${nf(surfacesKwp, 1)} kWp` : "ingen paneler"} · {st.production.surfaces.length} takflate{st.production.surfaces.length === 1 ? "" : "r"}
              {st.production.surfaces.some((f) => f.assumed) ? " (eksempel)" : ""} · {st.production.source === "pvgis" ? "PVGIS" : "leverandørens fil"}
              {batteryOn ? ` · batteri${qb?.capacityKwh ? ` ${nf(qb.capacityKwh, 1)} kWh` : ""}` : ""}
            </>
          }
          more={
            <div className={s.fields2}>
              <F
                label="Systemtap"
                help="Tap i kabler, inverter, smuss o.l. som trekkes i solsimuleringen (PVGIS)."
                more="PVGIS modellerer selv temperatur, innstråling og refleksjon. Inverterens effektgrense håndteres separat (kapping), så samme tap trekkes ikke to ganger. Bruk et dokumentert anslag, typisk 10–14 %."
              >
                <NumField value={st.production.lossPct} width={60} suffix="%" onCommit={(v) => update((x) => ({ ...x, production: { ...x.production, lossPct: v ?? 14 } }))} />
              </F>
              <F
                label="Værgrunnlag"
                help="Året solsimuleringen bygger på. For en historisk analyse brukes samme år som prisene når PVGIS har det (PVGIS 6: til og med 2025)."
                hint="Faktisk brukt værår vises ved resultatet."
              >
                <select className={s.input} value={st.production.weatherYear ?? ""} onChange={(e) => update((x) => ({ ...x, production: { ...x.production, weatherYear: e.target.value ? Number(e.target.value) : null } }))}>
                  <option value="">Samme som prisåret</option>
                  {Array.from({ length: 2025 - 2014 + 1 }, (_, i) => 2025 - i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </F>
              <F label="Solproduksjon fra" help="PVGIS-simulering eller leverandørens produksjonsserie. Kontroller at en importert fil faktisk viser produksjon, ikke kundens forbruk.">
                <select className={s.input} value={st.production.source} onChange={(e) => update((x) => ({ ...x, production: { ...x.production, source: e.target.value as "pvgis" | "fil" } }))}>
                  <option value="pvgis">Simulert (PVGIS)</option>
                  <option value="fil">Leverandørens fil (timer/kvarter)</option>
                </select>
              </F>
              {batteryOn && (
                <div className={`${s.wide} ${s.subbox}`}>
                  <span className={s.fieldlabel}>Batteri – tekniske verdier og kostnader</span>
                  <p className={`${s.small} ${s.muted}`} style={{ margin: "0 0 8px" }}>
                    Tomme felt hentes fra produktdata i tilbudet. Mangler de der, brukes en forsiktig standardverdi som merkes som antatt.
                  </p>
                  <div className={s.fields2}>
                    <F label="Kapasitet (nominell)" help="Energi batteriet kan lagre, i kWh. Hentes fra produktet. Skill nominell fra brukbar kapasitet." hint={qb?.capacityKwh ? `Fra tilbudet: ${nf(qb.capacityKwh, 1)} kWh` : undefined}>
                      <NumField value={st.battery.capacityKwh} width={90} placeholder="fra tilbudet" suffix="kWh" onCommit={(v) => bat({ capacityKwh: v })} />
                    </F>
                    <F label="Brukbar andel" help="Hvor stor del av den nominelle kapasiteten som faktisk kan brukes. Fra produktbladet." hint={qb?.usablePct ? `Produktdata: ${nf(qb.usablePct)} %` : "Mangler i produktdata: antatt 90 %"}>
                      <NumField value={st.battery.usablePct} width={60} placeholder="90" suffix="%" onCommit={(v) => bat({ usablePct: v })} />
                    </F>
                    <F
                      label="Ladeeffekt"
                      help="Hvor raskt batteriet kan lades eller levere energi, i kW. Begrenses også av hybridinverteren."
                      more="Eksempel: 315 kW. Ikke det samme som nettilknytningens grense – importgrensen legges inn under «Strøm og nettleie»."
                      hint={qb?.powerKw ? `Fra tilbudet: ${nf(qb.powerKw, 1)} kW (${qb.powerNote})` : "Mangler: antatt 0,5 × kapasitet"}
                    >
                      <NumField value={st.battery.powerKw} width={70} placeholder="fra tilbudet" suffix="kW" onCommit={(v) => bat({ powerKw: v })} />
                    </F>
                    <F label="Utladeeffekt (hvis annen)" help="Lading og utlading kan ha ulike grenser. Tomt = samme som ladeeffekten.">
                      <NumField value={st.battery.dischargeKw} width={70} placeholder="som lading" suffix="kW" onCommit={(v) => bat({ dischargeKw: v })} />
                    </F>
                    <F label="Virkningsgrad tur-retur" help="Energi som går tapt ved lading og utlading. Total tur-retur-virkningsgrad fra produktdata." hint={qb?.roundTripPct ? `Produktdata: ${nf(qb.roundTripPct)} %` : "Mangler: antatt 90 %"}>
                      <NumField value={st.battery.roundTripPct} width={60} placeholder="90" suffix="%" onCommit={(v) => bat({ roundTripPct: v })} />
                    </F>
                    <F label="Nødstrømsreserve" help="Andelen av batteriet som holdes igjen til reserve og derfor ikke brukes til vanlig drift eller handel." hint={st.goals.includes("nødstrøm") ? "Nødstrøm er valgt som mål: 20 % hvis tomt" : "Tomt = ingen reserve"}>
                      <NumField value={st.battery.reservePct} width={60} placeholder={st.goals.includes("nødstrøm") ? "20" : "0"} suffix="%" onCommit={(v) => bat({ reservePct: v })} />
                    </F>
                    <F label="Hjelpelast" help="Strøm batterisystemet selv bruker hele tiden (styring, kjøling). Regnes som en kostnad for batteriet.">
                      <NumField value={st.battery.auxKw} width={60} suffix="kW" onCommit={(v) => bat({ auxKw: v ?? 0 })} />
                    </F>
                    <F label="Aldring" help="Årlig tap av kapasitet. Batteriet har egne verdier – ikke det samme som panelenes degradering.">
                      <NumField value={st.battery.degradationPct} width={60} suffix="%/år" onCommit={(v) => bat({ degradationPct: v ?? 2 })} />
                    </F>
                    <F label="Levetid" help="Når batteriet regnes byttet. Utskiftingen legges inn i kontantstrømmen." hint={qb?.lifeYears ? `Produktdata: ${qb.lifeYears} år` : undefined}>
                      <NumField value={st.battery.lifeYears} width={50} suffix="år" onCommit={(v) => bat({ lifeYears: Math.max(1, Math.round(v ?? 15)) })} />
                    </F>
                    <div className={s.wide}>
                      <span className={s.fieldlabel}>
                        Tillatte energiveier
                        <Help text="Bare det utstyr, avtaler og nettilknytning tillater. Sol til bygg og batteri, og batteri til bygg, er alltid med." more="Lading fra nett kan skape en ny effekttopp – styringen tar hensyn til effektleddet. Salg fra batteriet krever at avtalen og tilknytningen tillater det." />
                      </span>
                      <label className={s.check} style={{ fontWeight: 400 }}>
                        <input type="checkbox" checked={st.battery.gridCharge} onChange={(e) => bat({ gridCharge: e.target.checked })} /> Lading fra nettet
                      </label>
                      <label className={s.check} style={{ fontWeight: 400 }}>
                        <input type="checkbox" checked={st.battery.gridExport} onChange={(e) => bat({ gridExport: e.target.checked })} /> Salg fra batteriet til nettet
                      </label>
                    </div>
                    <F label="Batteriinvestering" help="Kostnaden for batteriet, BMS, hybridoppgradering og installasjon. Hentes fra tilbudet." hint={qb?.investmentNok != null ? `Fra tilbudet: ${kr(qb.investmentNok)} – ${qb.investmentNote}` : "Hentes fra tilbudet ved beregning"}>
                      <NumField value={st.battery.investmentNok} width={110} placeholder="fra tilbudet" suffix="kr" onCommit={(v) => bat({ investmentNok: v })} />
                    </F>
                    <F
                      label="Smartstyring, kostnad per år"
                      help="Kostnaden og avtalen for smart prisstyring. Trekkes fra smartstyringens resultat."
                      more="Vis hva som er inkludert. Faste gebyrer og eventuell inntektsdeling trekkes fra. Et eksempelgebyr gjelder ikke automatisk for alle batterier."
                      hint={st.battery.smartFeeNokPerYear == null ? "Ikke oppgitt: regnes som 0 og merkes" : undefined}
                    >
                      <NumField value={st.battery.smartFeeNokPerYear} width={90} placeholder="ikke oppgitt" suffix="kr/år" onCommit={(v) => bat({ smartFeeNokPerYear: v })} />
                    </F>
                    <F label="Smartstyring, engangskostnad" help="Oppstart eller utstyr for styringen. Legges til investeringen i smartalternativet.">
                      <NumField value={st.battery.smartFeeOnceNok} width={90} suffix="kr" onCommit={(v) => bat({ smartFeeOnceNok: v ?? 0 })} />
                    </F>
                    <F
                      label="Slitasje i styringen"
                      help="Kostnad per kWh utladet som styringen tar hensyn til, så den unngår handler som ikke dekker slitasjen."
                      more="Brukes bare i styringen. Slitasjen føres ikke som kontantutgift – den dekkes av batteribyttet i kontantstrømmen."
                    >
                      <NumField value={st.battery.wearOrePerKwh} width={60} suffix="øre/kWh" onCommit={(v) => bat({ wearOrePerKwh: v ?? 0 })} />
                    </F>
                  </div>
                </div>
              )}
            </div>
          }
        >
          <div className={s.fromquote}>
            <span>
              Hentet fra tilbudet: <strong>{kwp != null ? `${nf(kwp, 2)} kWp` : "ingen paneler i kalkylen"}</strong>
              {run?.quote.inverterNames.length
                ? ` · ${run.quote.inverterNames.join(", ")}${run.quote.inverterAcKw ? ` (${nf(run.quote.inverterAcKw, 1)} kW AC – produksjonen kappes her)` : " (AC-effekt mangler i produktdata)"}`
                : ""}
            </span>
            <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} onClick={() => setEditKwp((v) => !v)}>
              {editKwp ? "Ferdig" : "Endre"}
            </button>
          </div>
          {editKwp && (
            <p className={`${s.small} ${s.muted}`}>
              Anleggsstørrelsen følger kalkylen over. Endre panelantallet der, eller sett fast kWp per takflate i tabellen under (tom = kalkylens kWp fordelt etter
              panelantall).
            </p>
          )}
          {st.production.source === "pvgis" ? (
            <>
              <div className={s.tablewrap}>
                <table>
                  <thead>
                    <tr>
                      <th>
                        Takflate <Help text="Del anlegget etter retning og helning. Et øst/vest-anlegg legges inn med to flater. Hentes fra tilbudet når det har takflater." />
                      </th>
                      <th className={s.num}>Paneler</th>
                      <th className={s.num}>
                        kWp <Help text="kWp er panelenes samlede merkeeffekt. 100 paneler på 460 W gir 46 kWp. Tomt = kalkylens kWp fordelt etter panelantall." />
                      </th>
                      <th className={s.num}>
                        Helning <Help text="Panelenes vinkel fra horisontalen: 0° er flatt, 90° loddrett. Oppgi panelvinkelen – den kan være annerledes enn takvinkelen." />
                      </th>
                      <th className={s.num}>
                        Retning <Help text="Retningen panelene vender: 90° øst, 180° sør, 270° vest." />
                      </th>
                      <th className={s.num}>
                        Skygge <Help text="Skyggetap fra bygninger, trær o.l. i prosent av flatens produksjon. PVGIS regner selv med terrenget (horisonten)." more="Tomt eller 0 = ingen ekstra skygge. Bruk et dokumentert anslag, f.eks. fra skyggeanalyse." />
                      </th>
                      {st.otherMeters.length > 0 && <th>Måler</th>}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {st.production.surfaces.map((f, i) => {
                      // Endres en eksempelrad, er den ikke lenger et eksempel
                      const set = (patch: Partial<Surface>) =>
                        update((x) => ({ ...x, production: { ...x.production, surfaces: x.production.surfaces.map((y, j) => (j === i ? { ...y, ...patch, assumed: false } : y)) } }));
                      return (
                        <tr key={f.id} className={f.assumed ? s.assumedrow : undefined}>
                          <td>
                            <input className={s.input} aria-label="Navn på takflaten" defaultValue={f.label} onBlur={(e) => e.target.value !== f.label && set({ label: e.target.value })} />
                            {f.assumed && <div className={`${s.small} ${s.assumedtext}`}>Antatt – tilbudet har ingen takflater. Kontroller retning og helning.</div>}
                          </td>
                          <td className={s.num}>
                            <NumField ariaLabel="Paneler" value={f.panels} width={64} onCommit={(v) => set({ panels: v == null ? null : Math.round(v) })} />
                          </td>
                          <td className={s.num}>
                            <NumField ariaLabel="kWp" value={f.kwp} width={70} placeholder="auto" onCommit={(v) => set({ kwp: v })} />
                          </td>
                          <td className={s.num}>
                            <NumField ariaLabel="Helning" value={f.tiltDeg} width={54} suffix="°" onCommit={(v) => set({ tiltDeg: Math.max(0, Math.min(90, v ?? 0)) })} />
                          </td>
                          <td className={s.num}>
                            <select className={s.input} aria-label="Retning" value={COMPASS_OPTS.some((o) => o.deg === f.azimuthDeg) ? f.azimuthDeg : ""} onChange={(e) => e.target.value !== "" && set({ azimuthDeg: Number(e.target.value) })}>
                              {!COMPASS_OPTS.some((o) => o.deg === f.azimuthDeg) && <option value="">{f.azimuthDeg}° ({COMPASS(f.azimuthDeg)})</option>}
                              {COMPASS_OPTS.map((o) => (
                                <option key={o.deg} value={o.deg}>
                                  {o.label} ({o.deg}°)
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={s.num}>
                            <NumField ariaLabel="Skyggetap" value={f.shadingPct ?? 0} width={50} suffix="%" onCommit={(v) => set({ shadingPct: Math.max(0, Math.min(80, v ?? 0)) })} />
                          </td>
                          {st.otherMeters.length > 0 && (
                            <td>
                              <select className={s.input} aria-label="Måler" value={f.meteringPointId ?? st.meteringPoint.id} onChange={(e) => set({ meteringPointId: e.target.value === st.meteringPoint.id ? null : e.target.value })}>
                                {meterIds.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    {m.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
                          <td className={s.rowactions2}>
                            <button type="button" className={`${s.btn} ${s.ghost} ${s.danger}`} onClick={() => update((x) => ({ ...x, production: { ...x.production, surfaces: x.production.surfaces.filter((_, j) => j !== i) } }))}>
                              Fjern
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!st.production.surfaces.length && (
                      <tr className={s.assumedrow}>
                        <td colSpan={8}>
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
                      production: { ...x.production, surfaces: [...x.production.surfaces, { id: `tak-${Date.now()}`, label: `Takflate ${x.production.surfaces.length + 1}`, panels: null, kwp: null, tiltDeg: 15, azimuthDeg: 180, meteringPointId: null }] },
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
                  Simulert med PVGIS · systemtap {nf(st.production.lossPct)} % · værgrunnlag {st.production.weatherYear ?? "samme som prisåret"}
                </span>
              </div>
            </>
          ) : (
            <SeriesBlock kind="produksjon" analysisId={analysis.id} meteringPointId={st.meteringPoint.id} active={activeFor(st.meteringPoint.id, "produksjon")} all={seriesFor(st.meteringPoint.id, "produksjon")} onChanged={reload} />
          )}

          {/* ---- Batterikort */}
          {(batteryOn || hasBattery) && (
            <div className={s.batterycard}>
              <div className={s.tariffhead}>
                <strong>Batteri</strong>
                <span className={`${s.pill} ${batteryOn ? s.st_measured : s.st_assumed}`}>{batteryOn ? "beregnes" : "valgt bort"}</span>
              </div>
              <div className={s.small}>
                {qb ? (
                  <>
                    Hentet fra tilbudet: <strong>{qb.label}</strong>
                    {qb.capacityKwh ? ` · ${nf(qb.capacityKwh, 1)} kWh` : " · kapasitet mangler"}
                    {qb.powerKw ? ` · ${nf(qb.powerKw, 1)} kW` : " · effekt mangler"}
                    {qb.investmentNok != null ? ` · ${kr(qb.investmentNok)}` : ""}
                    {qb.sharedAcKw ? ` · hybridinverter ${nf(qb.sharedAcKw, 1)} kW delt med solcellene` : ""}
                  </>
                ) : hasBattery ? (
                  "Tilbudet har batteri. Kapasitet, effekt og pris hentes fra tilbudet når du beregner."
                ) : (
                  "Batteri lagt inn manuelt – fyll inn kapasitet og effekt under «Flere innstillinger»."
                )}
              </div>
              <div className={s.small} style={{ marginTop: 4 }}>
                Regnes som tre alternativer med samme energibalanse: solceller alene, batteri med grunnstyring (lader av overskudd og dekker eget forbruk) og smart
                prisstyring (plan hver dag når morgendagens priser er kjent).
              </div>
              <label className={s.inline} style={{ marginTop: 6, fontSize: 12 }}>
                Batteri i analysen
                <select className={s.input} value={st.battery.include} onChange={(e) => bat({ include: e.target.value as BusinessSettings["battery"]["include"] })}>
                  <option value="auto">Når tilbudet har batteri</option>
                  <option value="ja">Alltid (manuelle verdier)</option>
                  <option value="nei">Ikke med</option>
                </select>
              </label>
            </div>
          )}
          {!batteryOn && !hasBattery && (
            <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} style={{ marginTop: 8 }} onClick={() => (bat({ include: "ja" }), setMore((m) => ({ ...m, anlegg: true })))}>
              Legg til batteri i analysen
            </button>
          )}
        </Group>

        {/* ================= 3 Strøm og nettleie */}
        <Group
          n={3}
          title="Strøm og nettleie"
          open={open.strom}
          onToggle={() => setOpen((o) => ({ ...o, strom: !o.strom }))}
          moreOpen={more.strom}
          onMore={() => setMore((m) => ({ ...m, strom: !m.strom }))}
          issues={groupIssues("strom")}
          summary={
            <>
              {tariff ? `${tariff.gridOwner} – ${tariff.name}${st.meteringPoint.tariffConfirmed ? " (kontrollert)" : " (ikke kontrollert)"}` : "ingen tariff valgt"} · påslag{" "}
              {nf(st.meteringPoint.buy.markupOrePerKwh, 1)} øre · avgift {st.meteringPoint.elavgift.taxStatus}
            </>
          }
          more={
            <div className={s.fields2}>
              <F
                label="Egen elavgiftssats"
                help="Bare hvis kunden har en annen dokumentert sats. Gjelder hele perioden og merkes som oppgitt."
                more="Hold avgiften adskilt fra nettleie og mva. Uten egen sats brukes periodens offisielle satser for avgiftsstatusen."
              >
                <NumField
                  value={st.meteringPoint.elavgift.orePerKwh}
                  width={70}
                  placeholder="periodens"
                  suffix="øre/kWh eks. mva."
                  onCommit={(v) => mp({ elavgift: { ...st.meteringPoint.elavgift, orePerKwh: v, status: v == null ? "antatt" : "målt" } })}
                />
              </F>
              <F
                label="Fastbeløp strømavtale"
                help="Leverandørens faste månedsbeløp. Dette er en annen kostnad enn nettleien og forsvinner vanligvis ikke med solceller."
                more="Eksempel: 500 kr/mnd. Regnes aldri som spart."
              >
                <NumField value={st.meteringPoint.buy.monthlyFeeNok} width={80} suffix="kr/mnd" onCommit={(v) => mp({ buy: { ...st.meteringPoint.buy, monthlyFeeNok: v ?? 0 } })} />
              </F>
              <F
                label="Eksportgrense"
                help="Maksimal effekt som samlet kan mates ut til nettet. Oppgis i kW og bekreftes fra nettilknytningen."
                more="0 betyr ingen eksport. «Ukjent» er et eget valg: regnes uten grense, men merkes som antakelse. Grensen begrenser salg fra både sol og batteri."
              >
                <span className={s.inline}>
                  <select className={s.input} value={st.meteringPoint.exportLimitMode === "ukjent" && st.meteringPoint.exportLimitKw != null ? "grense" : st.meteringPoint.exportLimitMode} onChange={(e) => mp({ exportLimitMode: e.target.value as ExportLimitMode })}>
                    {EXPORT_MODES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {(st.meteringPoint.exportLimitMode === "grense" || (st.meteringPoint.exportLimitMode === "ukjent" && st.meteringPoint.exportLimitKw != null)) && (
                    <NumField value={st.meteringPoint.exportLimitKw} width={70} suffix="kW" onCommit={(v) => mp({ exportLimitKw: v, exportLimitMode: "grense" })} />
                  )}
                </span>
              </F>
              <F
                label="Prisgulv ved salg"
                help="Laveste salgspris i avtalen. Med prisgulv 0 koster det ikke å selge når spotprisen er negativ."
                more="Tomt = ingen prisgulv: salg ved negative priser blir en kostnad. Gebyrer i salgsavtalen legges inn som fradrag."
              >
                <NumField value={st.meteringPoint.sell.floorOrePerKwh} width={70} placeholder="ingen" suffix="øre/kWh" onCommit={(v) => mp({ sell: { ...st.meteringPoint.sell, floorOrePerKwh: v } })} />
              </F>
              <F
                label="Avregning"
                help="Om kunden avregnes per time eller per kvarter. Med kvartersdata og kvartersavregning regnes analysen per kvarter."
                more="Døgnmarkedet har kvarterspriser fra 1.10.2025. Timeforbruk blir ikke kvartersforbruk av å fordeles – da regnes det per time."
              >
                <select className={s.input} value={st.meteringPoint.settlement} onChange={(e) => mp({ settlement: e.target.value as "time" | "kvarter" })}>
                  <option value="time">Per time</option>
                  <option value="kvarter">Per kvarter</option>
                </select>
              </F>
              <F
                label="Importgrense"
                help="Største samtidige effekt som kan hentes fra nettet (kW). Viktig ved batterilading og ladere."
                more="Hent godkjent verdi fra tilknytningen. Ikke likestill batteriets effekt med nettilknytningen. Tomt = ukjent."
              >
                <NumField value={st.meteringPoint.importLimitKw} width={80} placeholder="ukjent" suffix="kW" onCommit={(v) => mp({ importLimitKw: v })} />
              </F>
            </div>
          }
        >
          <div className={s.fields2}>
            <div className={s.wide}>
              <label htmlFor="na-tariff" className={s.fieldlabel}>
                Nettariff
                <Help
                  text="Nettselskapets prismodell for kunden. Kontroller nettselskap, kundegruppe og periode mot nettleiefakturaen."
                  more="Prisområdet sier ikke hvilket nettselskap kunden har, og årsforbruket alene fastslår ikke kundegruppen. Finnes ikke riktig tariff, legg inn satsene fra nettleiefakturaen."
                />
              </label>
              <div className={s.inline} style={{ width: "100%", flexWrap: "wrap" }}>
                <TariffSelect id="na-tariff" value={st.meteringPoint.tariffId} tariffs={tariffs} onChange={(v) => mp({ tariffId: v, tariffConfirmed: false, tariffScenario: false })} />
                <ManualTariff installerGroupId={installerGroupId} onCreated={(t) => (setTariffs((l) => [...l, t]), mp({ tariffId: t.id, tariffConfirmed: false, tariffScenario: false }))} />
                <button type="button" className={`${s.btn} ${s.small2}`} onClick={() => setShowAdmin(true)}>
                  Administrer tariffer
                </button>
              </div>
              {!st.meteringPoint.tariffId && <span className={s.hint}>Ingen tariff er valgt. Velg kundens tariff, eller legg inn satsene fra nettleiefakturaen.</span>}
              <TariffCard
                tariff={tariff}
                period={st.period}
                installerGroupId={installerGroupId}
                confirmed={st.meteringPoint.tariffConfirmed}
                scenario={st.meteringPoint.tariffScenario}
                onConfirmed={(v) => mp({ tariffConfirmed: v })}
                onScenario={(v) => mp({ tariffScenario: v })}
                onCopied={(t) => (setTariffs((l) => [...l, t]), mp({ tariffId: t.id, tariffConfirmed: false, tariffScenario: false }))}
                onChooseOther={() => document.getElementById("na-tariff")?.focus()}
              />
            </div>
            <F
              label="Kjøpsavtale"
              help="Spot med påslag, fastpris eller annen dokumentert avtale. Påslaget er leverandørens tillegg til spotprisen."
              more="Eksempel: 7 øre/kWh = 0,07 kr/kWh. Ikke før hele strømprisen som påslag. Fastpris = kraftpris per kWh eks. mva. (uten nettleie og avgift). Mangler avtalen, bruk et synlig merket anslag."
              hint={st.meteringPoint.buy.status === "antatt" ? "Kjøpsavtalen er ukjent – merkes som anslag." : "Kundens avtale."}
            >
              <span className={s.inline} style={{ flexWrap: "wrap" }}>
                <select className={s.input} aria-label="Avtaletype kjøp" value={st.meteringPoint.buy.type} onChange={(e) => mp({ buy: { ...st.meteringPoint.buy, type: e.target.value as "spot" | "fastpris" } })}>
                  <option value="spot">Spot + påslag</option>
                  <option value="fastpris">Fastpris</option>
                </select>
                {st.meteringPoint.buy.type === "fastpris" ? (
                  <NumField ariaLabel="Fast kraftpris" value={st.meteringPoint.buy.fixedOrePerKwh} width={70} suffix="øre/kWh" onCommit={(v) => mp({ buy: { ...st.meteringPoint.buy, fixedOrePerKwh: v } })} />
                ) : (
                  <NumField ariaLabel="Påslag" value={st.meteringPoint.buy.markupOrePerKwh} width={70} suffix="øre/kWh" onCommit={(v) => mp({ buy: { ...st.meteringPoint.buy, markupOrePerKwh: v ?? 0 } })} />
                )}
                <select className={s.input} aria-label="Kjøpsavtale" value={st.meteringPoint.buy.status} onChange={(e) => mp({ buy: { ...st.meteringPoint.buy, status: e.target.value as DataStatus } })}>
                  <option value="antatt">Anslag</option>
                  <option value="målt">Kundens spotavtale</option>
                </select>
              </span>
            </F>
            <F
              label="Salg av overskudd"
              help="Salgspris = spot minus fradraget i avtalen."
              more="Eksempel: spot minus 2 øre/kWh. 0 betyr ren spotpris – bare hvis det faktisk er avtalen eller antakelsen."
              hint={st.meteringPoint.sell.status === "antatt" ? "Salgsavtalen er ukjent – merkes som anslag." : "Kundens avtale."}
            >
              <span className={s.inline} style={{ flexWrap: "wrap" }}>
                <select className={s.input} aria-label="Avtaletype salg" value={st.meteringPoint.sell.type} onChange={(e) => mp({ sell: { ...st.meteringPoint.sell, type: e.target.value as "spot" | "fastpris" } })}>
                  <option value="spot">Spot − fradrag</option>
                  <option value="fastpris">Fastpris</option>
                </select>
                {st.meteringPoint.sell.type === "fastpris" ? (
                  <NumField ariaLabel="Fast salgspris" value={st.meteringPoint.sell.fixedOrePerKwh} width={70} suffix="øre/kWh" onCommit={(v) => mp({ sell: { ...st.meteringPoint.sell, fixedOrePerKwh: v } })} />
                ) : (
                  <NumField ariaLabel="Fradrag" value={st.meteringPoint.sell.deductionOrePerKwh} width={70} suffix="øre under spot" onCommit={(v) => mp({ sell: { ...st.meteringPoint.sell, deductionOrePerKwh: v ?? 0 } })} />
                )}
                <select className={s.input} aria-label="Salgsavtale" value={st.meteringPoint.sell.status} onChange={(e) => mp({ sell: { ...st.meteringPoint.sell, status: e.target.value as DataStatus } })}>
                  <option value="antatt">Anslag</option>
                  <option value="målt">Kundens avtale</option>
                </select>
              </span>
            </F>
            <F
              label="Avgiftsstatus"
              help="Ordinær sats, redusert sats, fritak eller ukjent. Periodens offisielle satser brukes."
              more="Virksomhetstype alene bekrefter ikke rett til redusert sats. Ukjent regnes med ordinær sats og merkes som antatt. Eksempel ordinær 2025: 9,79 / 16,93 / 12,53 øre/kWh."
            >
              <select className={s.input} value={st.meteringPoint.elavgift.taxStatus} onChange={(e) => mp({ elavgift: { ...st.meteringPoint.elavgift, taxStatus: e.target.value as BusinessSettings["meteringPoint"]["elavgift"]["taxStatus"] } })}>
                <option value="ukjent">Ukjent (regnes som ordinær)</option>
                <option value="ordinær">Ordinær sats</option>
                <option value="redusert">Redusert sats</option>
                <option value="fritak">Fritak</option>
              </select>
            </F>
          </div>
        </Group>

        {/* ================= 4 Økonomi fremover */}
        <Group
          n={4}
          title="Økonomi fremover"
          open={open.okonomi}
          onToggle={() => setOpen((o) => ({ ...o, okonomi: !o.okonomi }))}
          moreOpen={more.okonomi}
          onMore={() => setMore((m) => ({ ...m, okonomi: !m.okonomi }))}
          issues={groupIssues("okonomi")}
          summary={
            <>
              Investering{" "}
              {st.economy.investment.source === "kalkyle"
                ? run?.quote.investmentNok != null
                  ? kr(run.quote.investmentNok)
                  : investmentOre != null
                    ? kr(investmentOre / 100)
                    : "fra tilbudet"
                : st.economy.investment.source === "manuell"
                  ? kr(st.economy.investment.nok)
                  : "uavklart"}{" "}
              · {st.economy.years} år · service {st.economy.opex[0] ? `${kr(st.economy.opex[0].nokPerYear)}/år` : "ikke oppgitt"} · mva. {st.economy.vatDeductible === "nei" ? "inkl." : "eks."}
            </>
          }
          more={
            <div className={s.fields2}>
              <F
                label="Kalkulasjonsrente"
                help="Brukes til å vurdere hva fremtidige gevinster er verdt i dag. Påvirker nåverdi og diskontert tilbakebetaling, ikke fjorårets strømregning."
                more="Nominell. 8,12 % = NVEs 6 % realrente + 2 % inflasjon. Kundens avkastningskrav kan overstyre."
              >
                <NumField value={st.economy.discountRatePct} width={60} suffix="%" onCommit={(v) => eco({ discountRatePct: v ?? 8.12 })} />
              </F>
              <F label="Strømprisvekst (hovedscenario)" help="Antatt endring i fremtidige strømpriser. Et scenario, ikke en garanti – endrer ikke de historiske prisene." more="Eksempel: 3,5 % per år. Det forsiktige scenarioet har ingen vekst.">
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
              </F>
              <F label="Vekst i nettleie" help="Antatt fremtidig endring i nettleien, fra året etter analyseåret. Faktiske historiske tariffendringer håndteres som egne perioder.">
                <NumField value={st.economy.growth.nettleiePct} width={60} suffix="%/år" onCommit={(v) => eco({ growth: { ...st.economy.growth, nettleiePct: v ?? 0 } })} />
              </F>
              <F label="Vekst i avgifter" help="En antakelse for fremtidige avgifter. Historiske avgifter hentes fra reglene som gjaldt da.">
                <NumField value={st.economy.growth.avgiftPct} width={60} suffix="%/år" onCommit={(v) => eco({ growth: { ...st.economy.growth, avgiftPct: v ?? 0 } })} />
              </F>
              <F label="Vekst i driftskostnader" help="Forventet endring i service og andre løpende kostnader.">
                <NumField value={st.economy.growth.driftPct} width={60} suffix="%/år" onCommit={(v) => eco({ growth: { ...st.economy.growth, driftPct: v ?? 0 } })} />
              </F>
              <F label="Paneldegradering" help="Forventet årlig fall i panelenes produksjon. Eksempel: 0,4 % per år. Batteriet har egne verdier.">
                <NumField value={st.economy.degradationPct} width={60} suffix="%/år" onCommit={(v) => eco({ degradationPct: v ?? 0.4 })} />
              </F>
              <F
                label="Inverterbytte"
                help="Mulig utskifting av inverteren. «Fra tilbudets inverter» = inverterprisen × faktoren i Beregningsregler (inkl. arbeid)."
                more="Beløpet er nominelt, utbetalt i utskiftingsåret. Prosjektspesifikke beløp gjenbrukes ikke i andre tilbud."
                hint={
                  st.economy.replacementSource === "kalkyle"
                    ? run?.quote
                      ? run.quote.inverterNok
                        ? `${kr(run.quote.inverterNok * run.quote.replacementFactor)} i år ${run.quote.replacementYear} (inverter ${kr(run.quote.inverterNok)} × ${nf(run.quote.replacementFactor, 2)})`
                        : "Tilbudet har ingen inverter med pris – legg inn eget anslag"
                      : "Regnes ut ved beregning"
                    : undefined
                }
              >
                <select className={s.input} value={st.economy.replacementSource} onChange={(e) => eco({ replacementSource: e.target.value as BusinessSettings["economy"]["replacementSource"] })}>
                  <option value="kalkyle">Fra tilbudets inverter</option>
                  <option value="manuell">Eget anslag</option>
                  <option value="ingen">Ikke med</option>
                </select>
              </F>
              {st.economy.replacementSource === "manuell" && (
                <>
                  <F label="Inverterbytte, år" help="Året vi legger inn en mulig utskifting. Eksempel: år 15.">
                    <NumField value={st.economy.replacements[0]?.year ?? 15} width={50} onCommit={(v) => eco({ replacements: [{ name: st.economy.replacements[0]?.name ?? "Inverterbytte (anslag)", year: Math.round(v ?? 15), nok: st.economy.replacements[0]?.nok ?? 0 }] })} />
                  </F>
                  <F label="Inverterbytte, kostnad" help="Forventet utstyr og arbeid ved bytte, som utbetaling i utskiftingsåret (nominelt).">
                    <NumField value={st.economy.replacements[0]?.nok ?? null} width={100} placeholder="anslag" suffix="kr" onCommit={(v) => eco({ replacements: [{ name: st.economy.replacements[0]?.name ?? "Inverterbytte (anslag)", year: st.economy.replacements[0]?.year ?? 15, nok: v ?? 0 }] })} />
                  </F>
                </>
              )}
              <F
                label="Mva."
                help="Kundens fradragsrett for mva. Med fradragsrett vises alle beløp eks. mva."
                more="Uten fradragsrett regnes investering og kostnader inkl. 25 % mva. (salg av overskudd er uten mva.). Ukjent regnes eks. mva. og merkes."
              >
                <select className={s.input} value={st.economy.vatDeductible} onChange={(e) => eco({ vatDeductible: e.target.value as BusinessSettings["economy"]["vatDeductible"] })}>
                  <option value="ukjent">Ukjent (eks. mva., merkes)</option>
                  <option value="ja">Har fradragsrett (eks. mva.)</option>
                  <option value="nei">Ikke fradragsrett (inkl. mva.)</option>
                </select>
              </F>
            </div>
          }
        >
          <div className={s.fields2}>
            <F
              label="Investering i solcelleanlegget"
              help="Kostnaden for utstyr og arbeid i det valgte tilbudsalternativet, eks. mva. Hentes fra tilbudet."
              more="Når tilbudet også har batteri, vises batteriets del separat i batterikortet."
              hint={
                st.economy.investment.source === "kalkyle"
                  ? run?.quote.investmentNok != null
                    ? `Hentet fra tilbudet: ${kr(run.quote.investmentNok)}${run.quote.investmentNote ? ` (${run.quote.investmentNote})` : ""}`
                    : investmentOre != null
                      ? `Hentet fra tilbudet: ${kr(investmentOre / 100)}`
                      : "Tilbudet har ingen sum ennå"
                  : st.economy.investment.source === "uavklart"
                    ? "Uavklart: høyeste investering som gir positiv nåverdi vises i stedet."
                    : undefined
              }
            >
              <span className={s.inline}>
                <select className={s.input} value={st.economy.investment.source} onChange={(e) => eco({ investment: { ...st.economy.investment, source: e.target.value as BusinessSettings["economy"]["investment"]["source"] } })}>
                  <option value="kalkyle">Fra tilbudet</option>
                  <option value="manuell">Annet beløp</option>
                  <option value="uavklart">Uavklart</option>
                </select>
                {st.economy.investment.source === "manuell" && <NumField value={st.economy.investment.nok} width={110} suffix="kr" onCommit={(v) => eco({ investment: { ...st.economy.investment, nok: v } })} />}
              </span>
            </F>
            <F label="Analyseperiode" help="Hvor mange år fremover økonomien beregnes. Betyr ikke at alle komponentene varer like lenge." more="Eksempel: 20 eller 30 år. Inverter og batteri byttes underveis etter forutsetningene.">
              <select className={s.input} value={st.economy.years} onChange={(e) => eco({ years: Number(e.target.value) })}>
                {[10, 15, 20, 25, 30, 35, 40].map((y) => (
                  <option key={y} value={y}>
                    {y} år
                  </option>
                ))}
              </select>
            </F>
            <F
              label="Service og drift per år"
              help="Kundens årlige kostnad for dette anlegget: service, overvåking o.l. Trekkes fra netto gevinst."
              more="Bruk avtalt beløp eller et merket anslag. Er ikke automatisk samme beløp for alle prosjekter. Tomt = standardverdien i Beregningsregler hvis den finnes."
            >
              <NumField
                value={st.economy.opex[0]?.nokPerYear ?? null}
                width={90}
                placeholder="ikke oppgitt"
                suffix="kr/år"
                onCommit={(v) => eco({ opex: v == null ? st.economy.opex.slice(1) : [{ name: st.economy.opex[0]?.name ?? "Service og drift", nokPerYear: v }, ...st.economy.opex.slice(1)] })}
              />
            </F>
          </div>
          <p className={`${s.small} ${s.muted}`} style={{ marginBottom: 0 }}>
            Nominelle kroner, før skatt og finansiering. Hvert år regnes energiflyten på nytt med degradert produksjon. Forsiktig scenario: ingen strømprisvekst.
          </p>
        </Group>

        {/* ================= 5 Kontroll og resultat */}
        <Group
          n={5}
          title="Kontroll og beregning"
          open={open.kontroll}
          onToggle={() => setOpen((o) => ({ ...o, kontroll: !o.kontroll }))}
          issues={groupIssues("kontroll")}
          summary={run ? `Beregnet ${new Date(run.summary.calculatedAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}` : "Ikke beregnet"}
        >
          <ul className={s.basislist}>
            <li>
              <SourcePill type={st.consumption.level === 3 ? "måledata" : "antatt"} /> Forbruk: {consumptionLabel}
              {st.otherMeters.length ? ` + ${st.otherMeters.length} målere` : ""}
              {st.charging.enabled && st.charging.chargers.length && !st.charging.inConsumption ? " + lading (anslag)" : ""}
            </li>
            <li>
              <SourcePill type={st.production.source === "pvgis" ? "simulert" : "oppgitt"} /> Solproduksjon: {st.production.source === "pvgis" ? "PVGIS-simulering" : "leverandørens fil"}
              {st.production.surfaces.some((f) => f.assumed) ? " med eksempel-takflate" : ""}
            </li>
            <li>
              <SourcePill type="markedspriser" /> Spotpriser {st.location.priceArea ?? "(prisområde fra adresse)"} {periodText}
            </li>
            <li>
              <SourcePill type={tariff ? (tariff.isManual ? "oppgitt" : "tariffregister") : "antatt"} confirmed={st.meteringPoint.tariffConfirmed} /> Nettleie: {tariff ? tariff.name : "ingen tariff valgt"}
            </li>
            <li>
              <SourcePill type={st.meteringPoint.elavgift.taxStatus === "ukjent" ? "antatt" : "oppgitt"} /> Elavgift: {st.meteringPoint.elavgift.taxStatus}
            </li>
            {batteryOn && (
              <li>
                <SourcePill type={qb ? "oppgitt" : "antatt"} /> Batteri: {qb?.label ?? "fra tilbudet / manuelle verdier"} – grunnstyring og smart prisstyring
              </li>
            )}
          </ul>
          <div className={s.footerbar} style={{ margin: "10px -12px -12px", borderRadius: 0, flexWrap: "wrap" }}>
            <span className={`${s.small} ${s.muted}`} style={{ flex: 1, minWidth: 260 }}>
              {phase ? (
                <strong role="status">{phase} …</strong>
              ) : stale && run ? (
                <strong role="status" className={s.issuewarn}>
                  Grunnlaget er endret – beregn på nytt.
                </strong>
              ) : (
                <>
                  «Beregn analyse» lagrer skjemaet og regner med verdiene som vises og tilbudet slik det står nå. «Oppdater kildedata» henter spotpriser og
                  PVGIS på nytt – ikke tariffregisteret. Sendte tilbud endres aldri.
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
        </Group>
      </div>

      {runError && (
        <div className={s.panelbody}>
          <div className={`${s.notice} ${s.error}`} style={{ margin: 0 }}>
            <strong>Analysen ble ikke beregnet.</strong> {friendlyError(runError)}
            <details style={{ marginTop: 6 }}>
              <summary>Vis feildetaljer</summary>
              <code className={s.small}>{runError}</code>
            </details>
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
          onSelect={(id) => mp({ tariffId: id, tariffConfirmed: false, tariffScenario: false })}
        />
      )}
    </section>
  );
}

/** En kort, forståelig forklaring på vanlige feil. Teksten fra tjenesten vises under «Vis feildetaljer». */
function friendlyError(msg: string) {
  if (/Fikk ikke kontakt/.test(msg)) return "Får ikke kontakt med beregningstjenesten. Prøv igjen om litt – vedvarer det, sjekk tjenesteadressen i feildetaljene.";
  if (/PVGIS/.test(msg)) return "Solsimuleringen (PVGIS) svarte ikke som forventet. Prøv «Oppdater kildedata», eller velg et annet værår.";
  if (/spotpris/i.test(msg)) return "Spotprisene for perioden mangler. Prøv igjen senere, eller velg et annet år.";
  return msg;
}

// ---------------------------------------------------------------- filopplasting og datakontroll

function SeriesBlock({
  kind,
  analysisId,
  meteringPointId,
  active,
  all,
  onChanged,
  onMeter,
}: {
  kind: "forbruk" | "produksjon";
  analysisId: string;
  meteringPointId: string;
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
        meteringPointId,
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
  if (p.kind === "egendefinert") return [p.from, p.to];
  return p.kind === "år" ? [`${p.year}-01-01`, `${p.year}-12-31`] : [`${p.year}-01-01`, `${p.year}-${pad(p.toMonth)}-${pad(p.toDay)}`];
};
const validity = (t: Tariff) => `${t.validFrom} – ${t.validTo ?? "inntil videre"}`;
const OWNER_LABEL: Record<Tariff["owner"], string> = { felles: "Felles register", egen: "Teamets egen", annen: "Annet team" };

function tariffRates(d: TariffDefinition) {
  return [
    `Fastledd ${nf(d.fixedNokPerYear)} kr/år`,
    `energiledd ${nf(d.energyOrePerKwh, 2)} øre/kWh`,
    d.power
      ? `effektledd ${nf(d.power.summerNokPerKwMonth, 2)} / ${nf(d.power.winterNokPerKwMonth, 2)} kr/kW/mnd (sommer/vinter), høyeste ${d.power.resolution === "kvarter" ? "kvarter" : "time"} hverdager kl. ${d.power.window.fromHour}–${d.power.window.toHour}`
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

type TariffFormValues = {
  gridOwner: string;
  name: string;
  validFrom: string;
  validTo: string;
  fixed: string;
  energy: string;
  summer: string;
  winter: string;
  from: string;
  to: string;
  sourceUrl: string;
  resolution: "time" | "kvarter";
  changes: { from: string; energy: string; summer: string; winter: string }[];
};

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
    resolution: d?.power?.resolution ?? "time",
    changes: (d?.rateChanges ?? []).map((c) => ({ from: c.from, energy: str(c.energyOrePerKwh), summer: str(c.summerNokPerKwMonth), winter: str(c.winterNokPerKwMonth) })),
  };
};

/** Skjema for tariff fra nettleiefakturaen (ny) eller redigering av teamets egen tariff. */
function TariffForm({ installerGroupId, existing, onSaved, onCancel }: { installerGroupId: string; existing?: Tariff; onSaved: (t: Tariff) => void; onCancel: () => void }) {
  const [f, setF] = useState<TariffFormValues>(() => toForm(existing));
  const [saving, setSaving] = useState(false);
  const num = (x: string) => Number(x.replace(",", ".").replace(/\s/g, ""));
  const bad = (x: string) => x.trim() !== "" && !Number.isFinite(num(x));
  const isDate = (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x);
  const invalid =
    !f.gridOwner.trim() ||
    !f.name.trim() ||
    !isDate(f.validFrom) ||
    (f.validTo !== "" && !isDate(f.validTo)) ||
    [f.fixed, f.energy, f.summer, f.winter, f.from, f.to].some(bad) ||
    f.changes.some((c) => !isDate(c.from) || [c.energy, c.summer, c.winter].some(bad));
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
              resolution: f.resolution,
            }
          : null,
        // Satsendringer i løpet av gyldighetsperioden (egne tariffperioder)
        rateChanges: f.changes.map((c) => ({
          from: c.from,
          ...(c.energy.trim() ? { energyOrePerKwh: num(c.energy) } : {}),
          ...(c.summer.trim() ? { summerNokPerKwMonth: num(c.summer) } : {}),
          ...(c.winter.trim() ? { winterNokPerKwMonth: num(c.winter) } : {}),
          source: "Fra nettleiefaktura / tariffark (registrert manuelt)",
          status: "antatt" as const,
        })),
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
  const field = (k: Exclude<keyof TariffFormValues, "changes" | "resolution">, label: string, w = 90, placeholder?: string) => (
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
      <label>
        Effekt måles per
        <select className={s.input} value={f.resolution} onChange={(e) => setF({ ...f, resolution: e.target.value as "time" | "kvarter" })}>
          <option value="time">time (høyeste time)</option>
          <option value="kvarter">kvarter (høyeste kvarter)</option>
        </select>
      </label>
      <div style={{ width: "100%" }}>
        <span className={s.small} style={{ fontWeight: 600 }}>Satsendringer i perioden</span>
        {f.changes.map((c, i) => {
          const setC = (patch: Partial<typeof c>) => setF({ ...f, changes: f.changes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div key={i} className={s.inline} style={{ flexWrap: "wrap", marginTop: 4 }}>
              <input className={s.input} style={{ width: 110 }} aria-label="Fra dato" placeholder="ÅÅÅÅ-MM-DD" value={c.from} onChange={(e) => setC({ from: e.target.value })} />
              <input className={s.input} style={{ width: 80 }} aria-label="Energiledd" placeholder="energiledd" value={c.energy} onChange={(e) => setC({ energy: e.target.value })} />
              <input className={s.input} style={{ width: 80 }} aria-label="Effekt sommer" placeholder="eff. sommer" value={c.summer} onChange={(e) => setC({ summer: e.target.value })} />
              <input className={s.input} style={{ width: 80 }} aria-label="Effekt vinter" placeholder="eff. vinter" value={c.winter} onChange={(e) => setC({ winter: e.target.value })} />
              <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} onClick={() => setF({ ...f, changes: f.changes.filter((_, j) => j !== i) })}>
                Fjern
              </button>
            </div>
          );
        })}
        <button type="button" className={`${s.btn} ${s.ghost} ${s.small2}`} onClick={() => setF({ ...f, changes: [...f.changes, { from: "", energy: "", summer: "", winter: "" }] })}>
          Legg til satsendring
        </button>
        <span className={s.hint}>Satser som endres midt i perioden (f.eks. fra 1.7.) blir egne tariffperioder. Tomt felt = uendret sats.</span>
      </div>
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

/** Skriv ut / lagre som PDF: resultatet alene i et eget vindu, med alle detaljer åpne og samme stil. */
function printResult(root: HTMLElement | null) {
  if (!root) return;
  const w = window.open("", "_blank");
  if (!w) return toast.error("Nettleseren blokkerte utskriftsvinduet. Tillat sprettoppvinduer og prøv igjen.");
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("details").forEach((d) => (d.open = true));
  clone.querySelectorAll(`.${s.noprint}`).forEach((n) => n.remove());
  clone.style.opacity = "1";
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join("");
  w.document.write(
    `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>Næringsanalyse</title>${styles}<style>body{background:#fff;margin:16px}.${s.tablewrap}{overflow:visible}tr{page-break-inside:avoid}</style></head><body><div class="${s.calc} ${s.embedded}">${clone.outerHTML}</div></body></html>`,
  );
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function Result({ r, quote, stale }: { r: BusinessSummary; quote: QuoteContext; stale: boolean }) {
  const [scenario, setScenario] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
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
    <div ref={rootRef} className={s.panelbody} style={{ borderTop: "1px solid var(--line)", opacity: stale ? 0.6 : 1 }}>
      <div className={s.noprint} style={{ float: "right" }}>
        <button type="button" className={`${s.btn} ${s.small2}`} onClick={() => printResult(rootRef.current)} title="Åpner utskrift. Velg «Lagre som PDF» for en PDF.">
          Skriv ut / PDF
        </button>
      </div>
      {stale && (
        <div className={`${s.notice} ${s.info}`} role="status">
          <strong>Grunnlaget er endret – beregn på nytt.</strong> Resultatet under gjelder skjemaet og tilbudet slik de var {calculated}.
        </div>
      )}

      <div className={s.resulthead}>
        <strong>Beregnet {calculated}</strong>
        {r.offerLabel && <span>{r.offerLabel}</span>}
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
      {r.scope?.batteryOffered && !r.battery && (
        <div className={`${s.notice} ${s.info}`}>Tilbudet har batteri, men batteriet er ikke med i denne analysen. Resultatet gjelder solcelleanlegget alene.</div>
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
          <h3 className={s.grouphead}>Netto energikostnad per måned (kr)</h3>
          <div className={s.bars} role="img" aria-label="Netto energikostnad per måned uten og med solceller. Tallene står i tabellen under.">
            {r.months.map((m) => {
              const up = m.costAfter > m.costBefore + 0.5;
              return (
                <div key={m.month} tabIndex={0} title={`${m.month}: ${kr(m.costBefore)} → ${kr(m.costAfter)} (${up ? "økt" : "spart"} ${kr(Math.abs(m.costBefore - m.costAfter))})`}>
                  <span style={{ height: `${(Math.max(0, m.costBefore) / maxCost) * 100}%` }} className={s.barbefore} />
                  <span style={{ height: `${(Math.max(0, m.costAfter) / maxCost) * 100}%` }} className={`${s.barafter} ${up ? s.barup : ""}`} />
                  <em>{MONTHS[Number(m.month.slice(5)) - 1]}</em>
                  <i className={s.barval}>{up ? "+" : "−"}{nf(Math.abs(m.costBefore - m.costAfter) / 1000, 0)}k</i>
                </div>
              );
            })}
          </div>
          <div className={`${s.small} ${s.muted}`}>
            <span className={`${s.legend} ${s.barbefore}`} /> uten tiltak <span className={`${s.legend} ${s.barafter}`} /> med solceller
            <span className={`${s.legend} ${s.barafter} ${s.barup}`} /> måned med økt kostnad · tall over månedene = endring i tusen kr. Salgsinntekten er trukket fra
            (netto energikostnad); faste ledd er med i begge.
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
                <th className={s.num}>Netto før</th>
                <th className={s.num}>Netto etter</th>
                <th className={s.num}>Endring</th>
              </tr>
            </thead>
            <tbody>
              {r.months.map((m) => (
                <tr key={m.month} className={m.costAfter > m.costBefore + 0.5 ? s.uprow : undefined}>
                  <td>{m.month}</td>
                  <td className={s.num}>{nf(m.loadKwh)}</td>
                  <td className={s.num}>{nf(m.pvKwh)}</td>
                  <td className={s.num}>{nf(m.selfKwh)}</td>
                  <td className={s.num}>{nf(m.exportKwh)}</td>
                  <td className={s.num}>{nf(m.peakBeforeKw, 1)} kW</td>
                  <td className={s.num}>{nf(m.peakAfterKw, 1)} kW</td>
                  <td className={s.num}>{kr(m.costBefore)}</td>
                  <td className={s.num}>{kr(m.costAfter)}</td>
                  <td className={s.num}>{m.costAfter > m.costBefore ? "+" : "−"}{kr(Math.abs(m.costBefore - m.costAfter))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {r.charging && (
        <p className={s.small}>
          <strong>Lading:</strong> {kwh(r.charging.kwh)} lagt til forbruket (anslag), hvorav ca. {kwh(r.charging.solarKwh)} kan dekkes av solstrøm. Ladingen øker
          effektleddet med {kr(r.charging.effektleddIncrease)} i året uten tiltak.
        </p>
      )}

      {r.meters && r.meters.length > 1 && (
        <details className={s.details} open>
          <summary>Per målepunkt</summary>
          <div className={s.tablewrap}>
            <table>
              <thead>
                <tr>
                  <th>Måler</th>
                  <th>Tariff</th>
                  <th className={s.num}>Forbruk</th>
                  <th className={s.num}>Sol</th>
                  <th className={s.num}>Netto før</th>
                  <th className={s.num}>Netto etter</th>
                  <th className={s.num}>Lavere kostnad</th>
                </tr>
              </thead>
              <tbody>
                {r.meters.map((m) => (
                  <tr key={m.id}>
                    <td>{m.label}</td>
                    <td className={s.small}>{m.tariff}</td>
                    <td className={s.num}>{kwh(m.before.loadKwh)}</td>
                    <td className={s.num}>{kwh(m.after.pvKwh)}</td>
                    <td className={s.num}>{kr(m.before.netto)}</td>
                    <td className={s.num}>{kr(m.after.netto)}</td>
                    <td className={`${s.num} ${s.strong}`}>{kr(m.saving)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {r.battery && <BatteryResult b={r.battery} years={r.assumptions.years} discountRatePct={r.assumptions.discountRatePct} priceYear={priceYear} valid={valid} />}

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
            {r.warnings.map((w, i) => (
              <li key={i} className={s.issuewarn}>
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


// ---------------------------------------------------------------- batteri

/** Batteriets resultat: tre alternativer side om side, merverdien og batteritall. */
function BatteryResult({ b, years, discountRatePct, priceYear, valid }: { b: BatterySummary; years: number; discountRatePct: number; priceYear: number; valid: boolean }) {
  const [scenario, setScenario] = useState(0);
  const alts = b.alternatives;
  const ecoOf = (i: number) => alts[i].economy?.[scenario] ?? null;
  const smart = alts.find((a) => a.key === "smart")!;
  const st = smart.battery;
  const scenarioName = alts[0].economy?.[scenario]?.name;
  const row = (label: string, f: (a: (typeof alts)[number], i: number) => ReactNode, strong = false, help?: string) => (
    <tr>
      <td className={strong ? s.strong : undefined}>
        {label}
        {help && <Help text={help} />}
      </td>
      {alts.map((a, i) => (
        <td key={a.key} className={`${s.num} ${strong ? s.strong : ""}`}>
          {f(a, i)}
        </td>
      ))}
    </tr>
  );
  return (
    <div className={s.batteryresult} style={{ opacity: valid ? 1 : 0.6 }}>
      <h3 className={s.grouphead} style={{ marginTop: 16 }}>
        Batteri: {b.label}
      </h3>
      <p className={s.small} style={{ marginTop: 0 }}>
        Samme bygg, samme år og samme priser. Alternativene sammenlignes med «uten tiltak». Brukbar kapasitet {nf(b.config.usableKwh, 1)} kWh, effekt {nf(b.config.powerKw, 1)} kW
        {b.config.dischargeKw != null && b.config.dischargeKw !== b.config.powerKw ? ` lading / ${nf(b.config.dischargeKw, 1)} kW utlading` : ""}
        {b.config.sharedAcKw ? ` (hybridinverter ${nf(b.config.sharedAcKw, 1)} kW delt med solcellene)` : ""},
        virkningsgrad {pct(b.config.roundTrip)} tur-retur{b.config.reserveShare ? `, nødstrømsreserve ${pct(b.config.reserveShare)}` : ""}. Lading fra nett {b.config.gridCharge ? "tillatt" : "ikke tillatt"}, salg fra
        batteri {b.config.gridExport ? "tillatt" : "ikke tillatt"}.
      </p>
      <div className={s.tablewrap}>
        <table>
          <thead>
            <tr>
              <th>I {priceYear}</th>
              {alts.map((a) => (
                <th key={a.key} className={s.num}>
                  {a.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {row("Lavere netto energikostnad", (a) => kr(a.energySaving), false, "Kjøp av strøm (også ladestrøm fra nettet), nettleie og elavgift før minus etter, pluss salg. Batteriets tap og hjelpelast er med.")}
            {row("Løpende kostnader", (a) => `−${kr(a.opex)}`, false, "Service og drift. For smartstyring også styringsgebyret.")}
            {row("Netto gevinst", (a) => kr(a.net), true)}
            {row("Kjøpt fra nett", (a) => kwh(a.importKwh))}
            {row("Solgt til nett", (a) => kwh(a.exportKwh))}
            {row("Solstrøm brukt i bygget", (a) => kwh(a.selfKwh), false, "Nettstrøm som går via batteriet regnes ikke som egen solproduksjon.")}
          </tbody>
        </table>
      </div>
      <ul className={`${s.small} ${s.plainlist}`}>
        <li>
          <strong>Batteriets merverdi med grunnstyring: {kr(b.value.grunn)} i {priceYear}</strong> (sol + batteri minus sol alene).
        </li>
        <li>
          <strong>Smartstyringens merverdi: {kr(b.value.smart)}</strong> utover grunnstyring, etter styringsgebyr {kr(b.value.smartFee)}.
        </li>
        <li className={s.muted}>
          Samme styring med fasit for forbruk og sol (referanse, ikke oppnåelig i praksis): {kr(b.perfectForesightNet)} netto. Smartstyringen bruker bare priser som var kjent
          dagen før og en enkel prognose – en representativ strategi, ikke leverandørens algoritme.
        </li>
      </ul>

      {alts.some((a) => a.economy) && (
        <>
          <h3 className={s.grouphead} style={{ marginTop: 14 }}>
            Økonomi over {years} år per alternativ
          </h3>
          {(alts[0].economy?.length ?? 0) > 1 && (
            <div className={s.chips}>
              {alts[0].economy!.map((e, i) => (
                <button key={e.name} type="button" className={`${s.chip} ${i === scenario ? s.chipon : ""}`} onClick={() => setScenario(i)}>
                  {e.name}
                </button>
              ))}
            </div>
          )}
          <div className={s.tablewrap}>
            <table>
              <thead>
                <tr>
                  <th>{scenarioName}</th>
                  {alts.map((a) => (
                    <th key={a.key} className={s.num}>
                      {a.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {row("Investering", (a) => (a.investmentNok == null ? "uavklart" : kr(a.investmentNok)))}
                {row("Netto gevinst år 1", (_, i) => kr(ecoOf(i)?.firstYearNet))}
                {row("Tilbakebetaling", (a, i) => (ecoOf(i)?.paybackYears != null ? `${nf(ecoOf(i)!.paybackYears!, 1)} år` : a.investmentNok == null ? "—" : `ikke innen ${years} år`), true)}
                {row(`Nåverdi (${nf(discountRatePct, 2)} %)`, (_, i) => (ecoOf(i)?.npv != null ? kr(ecoOf(i)!.npv) : "—"), true)}
                {row("Internrente", (_, i) => (ecoOf(i)?.irr != null ? `${nf(ecoOf(i)!.irr! * 100, 1)} %` : "—"))}
                {row("Utskifting i perioden", (_, i) => kr(ecoOf(i)?.rows.reduce((s2, x) => s2 + x.utskifting, 0) ?? 0), false, "Inverterbytte og batteribytte ved endt levetid, nominelt.")}
              </tbody>
            </table>
          </div>
        </>
      )}

      {st && (
        <details className={s.details}>
          <summary>Batteriet i smartstyring: lading, tap og handel</summary>
          <p className={s.small}>
            Ladet {kwh(st.chargeKwh)} ({kwh(st.solarChargeKwh)} fra sol, {kwh(st.gridChargeKwh)} fra nett) · utladet {kwh(st.dischargeKwh)} ({kwh(st.toLoadKwh)} til bygget, {kwh(st.toGridKwh)} solgt) · tap{" "}
            {kwh(st.lossKwh)}
            {st.auxKwh ? ` · hjelpelast ${kwh(st.auxKwh)}` : ""} · {nf(st.cycles, 0)} fulle sykluser
            {st.avgChargePrice != null ? ` · snitt kjøpspris ladestrøm ${nf(st.avgChargePrice, 2)} kr/kWh (inkl. nettleie og avgift)` : ""}
            {st.avgSellPrice != null ? ` · snitt salgspris ${nf(st.avgSellPrice, 2)} kr/kWh` : ""}.
          </p>
          <div className={s.tablewrap}>
            <table>
              <thead>
                <tr>
                  <th>Måned</th>
                  <th className={s.num}>Gevinst vs. sol alene</th>
                  <th className={s.num}>Ladet</th>
                  <th className={s.num}>Fra nett</th>
                  <th className={s.num}>Utladet</th>
                  <th className={s.num}>Solgt</th>
                  <th className={s.num}>Tap</th>
                  <th className={s.num}>Sykluser</th>
                  <th className={s.num}>Topp sol alene</th>
                  <th className={s.num}>Topp med batteri</th>
                </tr>
              </thead>
              <tbody>
                {b.months.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td className={s.num}>{kr(m.gain)}</td>
                    <td className={s.num}>{nf(m.chargeKwh)}</td>
                    <td className={s.num}>{nf(m.gridChargeKwh)}</td>
                    <td className={s.num}>{nf(m.dischargeKwh)}</td>
                    <td className={s.num}>{nf(m.toGridKwh)}</td>
                    <td className={s.num}>{nf(m.lossKwh)}</td>
                    <td className={s.num}>{nf(m.cycles, 1)}</td>
                    <td className={s.num}>{nf(m.peakBeforeKw, 1)} kW</td>
                    <td className={s.num}>{nf(m.peakAfterKw, 1)} kW</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {b.day && <DayChart day={b.day} usable={b.config.usableKwh} />}
        </details>
      )}
    </div>
  );
}

/** Døgnutsnitt: spotpris (linje), batterinivå (flate) og lading/utlading (stolper). */
function DayChart({ day, usable }: { day: NonNullable<BatterySummary["day"]>; usable: number }) {
  const W = 640, H = 180, P = { l: 36, r: 36, t: 10, b: 22 };
  const n = day.hours.length;
  const x = (i: number) => P.l + ((i + 0.5) / n) * (W - P.l - P.r);
  const maxP = Math.max(...day.hours.map((h) => h.price), 0.01);
  const minP = Math.min(0, ...day.hours.map((h) => h.price));
  const yP = (v: number) => P.t + ((maxP - v) / (maxP - minP || 1)) * (H - P.t - P.b);
  const yS = (v: number) => P.t + (1 - v / (usable || 1)) * (H - P.t - P.b);
  const maxB = Math.max(...day.hours.map((h) => Math.abs(h.battery)), 0.01);
  const mid = (H - P.b + P.t) / 2;
  const bw = ((W - P.l - P.r) / n) * 0.5;
  return (
    <figure className={s.daychart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Døgnutsnitt ${day.date}: spotpris, batterinivå og lading`}>
        <path d={`M${x(0)} ${yS(0)} ${day.hours.map((h, i) => `L${x(i)} ${yS(h.soc)}`).join(" ")} L${x(n - 1)} ${yS(0)} Z`} className={s.daysoc} />
        {day.hours.map((h, i) => (
          <rect key={i} x={x(i) - bw / 2} width={bw} y={h.battery > 0 ? mid - (h.battery / maxB) * (mid - P.t) * 0.9 : mid} height={(Math.abs(h.battery) / maxB) * (mid - P.t) * 0.9} className={h.battery > 0 ? s.daydis : s.daycha}>
            <title>{`kl. ${h.hour}: ${h.battery > 0 ? "utlading" : h.battery < 0 ? "lading" : "hvile"} ${nf(Math.abs(h.battery), 1)} kW · pris ${nf(h.price, 2)} kr/kWh · nivå ${nf(h.soc, 1)} kWh`}</title>
          </rect>
        ))}
        <path d={day.hours.map((h, i) => `${i ? "L" : "M"}${x(i)} ${yP(h.price)}`).join(" ")} className={s.dayprice} />
        {day.hours.map((h, i) => (i % 3 === 0 ? <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{h.hour}</text> : null))}
        <text x={4} y={P.t + 8}>{nf(maxP, 2)} kr</text>
        <text x={W - 4} y={P.t + 8} textAnchor="end">{nf(usable, 0)} kWh</text>
      </svg>
      <figcaption className={`${s.small} ${s.muted}`}>
        {day.date}: dagen med mest batteribruk. <span className={`${s.legend} ${s.daycha}`} /> lading <span className={`${s.legend} ${s.daydis}`} /> utlading
        <span className={`${s.legend} ${s.daysoc}`} /> batterinivå · linje = spotpris.
      </figcaption>
    </figure>
  );
}
