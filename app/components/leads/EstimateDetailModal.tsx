"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FileText, Lock, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { Estimate } from "@/lib/types";
import { PriceLineItem, PriceOverview } from "@/types/price_table";
import { updateEstimate } from "@/lib/api";
import { getQuoteVersion } from "@/lib/calcApi";
import SignedBreakdownPanel from "./SignedBreakdownPanel";
import { supabase } from "@/lib/supabase";

/**
 * Detaljert visning av et estimat, som et linjeskjema.
 *
 * Alle priser står i ett skjema i samme stil som totalsummen: én rad per
 * post med antall, kostnad, påslag og sum. Alt som kunne endres før kan
 * endres her også (navn, produkt, antall, sum, produktark, rader), så lenge
 * tilbudet ikke er signert. Lagring skriver tilbake til estimates-raden.
 *
 * Kostnad og påslag ligger ikke i price_data. De hentes fra den låste
 * kalkyleversjonen (price_data.quoteVersionId) når estimatet er laget med
 * den nye kalkulatoren; eldre estimater viser «—» i de kolonnene.
 */

type Props = {
  estimate: Estimate;
  onClose: () => void;
  onSaved: (updated: Estimate) => void;
};

type RoofRow = NonNullable<Estimate["checked_roof_data"]>[number];
type LineItem = PriceLineItem;
type AdditionalCost = PriceOverview["installation"]["additionalCosts"][number];

/** Kostnad fra kalkylen, i kroner eks. mva. */
type LineCost = { baseUnit: number; base: number; markupPercent: number; unit?: string };
type GroupCost = { base: number };

const ENOVA_RATE_PER_KWP = 2500;
const ENOVA_MAX_KWP = 15;
const VAT_MULTIPLIER = 1.25;

const nok = (value: number) =>
  Number(value || 0).toLocaleString("nb-NO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const pctText = (value: number) =>
  `${Number(value || 0).toLocaleString("nb-NO", { maximumFractionDigits: 1 })} %`;

/** Summen av alle prislinjer i et prissnapshot, uten provisjon. */
function sumPriceData(priceData: PriceOverview): number {
  const sum = (items: { priceWithMarkup: number }[] = []) =>
    items.reduce((acc, item) => acc + Number(item.priceWithMarkup || 0), 0);

  return (
    sum(priceData.suppliers) +
    sum(priceData.mounting) +
    Number(priceData.installation?.søknad?.priceWithMarkup || 0) +
    Number(priceData.installation?.solcelleAnlegg?.priceWithMarkup || 0) +
    Number(priceData.installation?.battery?.priceWithMarkup || 0) +
    sum(priceData.installation?.additionalCosts)
  );
}

/** Samme filnavnrens som priskalkulatoren bruker ved opplasting. */
function sanitizeFileName(value: string): string {
  return value
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "aa")
    .replace(/Æ/g, "Ae")
    .replace(/Ø/g, "O")
    .replace(/Å/g, "Aa")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Tom streng → null, slik at tomme tallfelt ikke blir lagret som 0. */
const toNumberOrNull = (raw: string): number | null => {
  if (raw.trim() === "") return null;
  const value = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : null;
};

// ── Felt i skjemaet ─────────────────────────────────────────────────────────
// Ser ut som tekst til man peker på dem, slik at skjemaet er lett å lese.
const sheetInput =
  "h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-white placeholder:text-white/35 hover:border-white/20 hover:bg-white/5 focus:border-white/40 focus:bg-white/10 disabled:hover:border-transparent disabled:hover:bg-transparent";
const sheetNum = `${sheetInput} text-right tabular-nums`;
const sheetSub =
  "h-6 w-full min-w-0 rounded border border-transparent bg-transparent px-2 text-xs text-white/55 placeholder:text-white/30 hover:border-white/15 hover:bg-white/5 focus:border-white/30 focus:bg-white/10 focus:text-white";

/** Tallfelt som lagres når man forlater feltet, slik at et tomt felt ikke hopper tilbake mens man skriver. */
function CommitNumber({
  value,
  onCommit,
  disabled,
  className,
  ariaLabel,
}: {
  value: number;
  onCommit: (value: number | null) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const shown = String(Math.round(value));
  const [text, setText] = useState(shown);
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      value={focused ? text : nok(value)}
      onFocus={() => {
        setText(shown);
        setFocused(true);
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        if (text.trim() === shown) return;
        onCommit(toNumberOrNull(text));
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Lys nøkkeltall-rad øverst (anlegget). */
function InfoField({
  label,
  value,
  onChange,
  suffix,
  disabled,
  type = "number",
}: {
  label: string;
  value: string | number | null | undefined;
  onChange: (raw: string) => void;
  suffix?: string;
  disabled?: boolean;
  type?: "text" | "number";
}) {
  return (
    <label className="flex min-w-0 flex-col gap-0.5 border-b border-line px-3 py-2">
      <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <input
          type={type}
          step={type === "number" ? "any" : undefined}
          className={`h-7 w-full min-w-0 rounded border border-transparent bg-transparent px-1 text-sm font-semibold text-ink hover:border-line focus:border-gray-300 focus:bg-white ${type === "number" ? "tabular-nums" : ""}`}
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && <span className="shrink-0 text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

/** Kostnad / påslag-cellene for en rad. sale = radens sum eks. mva. */
function CostCells({ cost, sale, quantity }: { cost?: { base: number; baseUnit?: number }; sale: number; quantity: number }) {
  const perUnit = quantity > 0 ? sale / quantity : null;
  if (!cost) {
    return (
      <>
        <td className="px-2 py-1.5 text-right tabular-nums text-white/35">—</td>
        <td className="px-2 py-1.5 text-right tabular-nums text-white/35">—</td>
        <td className="px-2 py-1.5 text-right tabular-nums text-white/70">{perUnit == null ? "—" : nok(perUnit)}</td>
      </>
    );
  }
  const markup = sale - cost.base;
  const markupPct = cost.base > 0 ? (markup / cost.base) * 100 : 0;
  const unitCost = cost.baseUnit ?? (quantity > 0 ? cost.base / quantity : 0);
  return (
    <>
      <td className="px-2 py-1.5 text-right tabular-nums text-white/80">
        {nok(unitCost)}
        {quantity !== 1 && <span className="block text-[11px] text-white/45">{nok(cost.base)} totalt</span>}
      </td>
      <td className={`px-2 py-1.5 text-right tabular-nums ${markup < 0 ? "text-red-300" : "text-white/80"}`}>
        {pctText(markupPct)}
        <span className="block text-[11px] text-white/45">{nok(markup)} kr</span>
      </td>
      <td className="px-2 py-1.5 text-right tabular-nums text-white/70">{perUnit == null ? "—" : nok(perUnit)}</td>
    </>
  );
}

function GroupRow({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={9} className="px-2 pb-1.5 pt-5">
        <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
            {title}
            {count != null && <span className="ml-2 font-normal normal-case tracking-normal text-white/40">{count} rader</span>}
          </span>
          {action}
        </div>
      </td>
    </tr>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white" onClick={onClick}>
      <Plus className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export default function EstimateDetailModal({
  estimate,
  onClose,
  onSaved,
}: Props) {
  const locked = Boolean(estimate.signed_at);

  // Dyp kopi, slik at avbrutt redigering ikke påvirker listen bak modalen.
  const [draft, setDraft] = useState<Estimate>(() =>
    JSON.parse(JSON.stringify(estimate)) as Estimate,
  );
  const [saving, setSaving] = useState(false);

  const priceData = draft.price_data;

  /**
   * Soleklarts salgsprovisjon er ikke en egen linje i price_data — den er
   * differansen mellom lagret total og summen av linjene. Vi leser den ut én
   * gang når visningen åpnes, slik at den ikke forsvinner når totalen regnes
   * om fra linjene ved lagring.
   */
  const [commission, setCommission] = useState(() => {
    const original = estimate.price_data;
    if (!original) return 0;
    return Math.max(
      0,
      Number(original.total || 0) - sumPriceData(original),
    );
  });

  const setPriceData = (patch: Partial<PriceOverview>) =>
    setDraft((prev) => ({
      ...prev,
      price_data: { ...(prev.price_data as PriceOverview), ...patch },
    }));

  // ── Summering ───────────────────────────────────────────────────────────────
  // Totalen regnes alltid fra linjene. En eventuell manuell tilbudspris
  // (totalOverride) overstyrer den, og vises tydelig i oppsummeringen.
  const lineTotal = useMemo(
    () => (priceData ? sumPriceData(priceData) : 0),
    [priceData],
  );

  const subTotal = lineTotal + Number(commission || 0);

  const override = priceData?.totalOverride;
  const hasOverride = override !== null && override !== undefined;
  const effectiveTotal = hasOverride ? Number(override) : subTotal;
  const effectiveTotalInclVat = effectiveTotal * VAT_MULTIPLIER;

  const enovaSupport =
    Math.min(Number(draft.kwp || 0), ENOVA_MAX_KWP) * ENOVA_RATE_PER_KWP;

  // ── Oppdatering av lister ───────────────────────────────────────────────────
  const updateRoof = (index: number, patch: Partial<RoofRow>) =>
    setDraft((prev) => ({
      ...prev,
      checked_roof_data: (prev.checked_roof_data ?? []).map((roof, i) =>
        i === index ? { ...roof, ...patch } : roof,
      ),
    }));

  const updateLine = (
    key: "suppliers" | "mounting",
    index: number,
    patch: Partial<LineItem>,
  ) =>
    setPriceData({
      [key]: (priceData?.[key] ?? []).map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    } as Partial<PriceOverview>);

  const updateInstallation = (
    key: "søknad" | "solcelleAnlegg" | "battery",
    priceWithMarkup: number,
  ) =>
    setPriceData({
      installation: {
        ...(priceData!.installation),
        [key]: { ...priceData!.installation[key], priceWithMarkup },
      },
    });

  const updateAdditionalCost = (
    index: number,
    patch: Partial<AdditionalCost>,
  ) =>
    setPriceData({
      installation: {
        ...(priceData!.installation),
        additionalCosts: (priceData!.installation.additionalCosts ?? []).map(
          (item, i) => (i === index ? { ...item, ...patch } : item),
        ),
      },
    });

  const removeAdditionalCost = (index: number) =>
    setPriceData({
      installation: {
        ...(priceData!.installation),
        additionalCosts: (
          priceData!.installation.additionalCosts ?? []
        ).filter((_, i) => i !== index),
      },
    });

  const addAdditionalCost = () =>
    setPriceData({
      installation: {
        ...(priceData!.installation),
        additionalCosts: [
          ...(priceData!.installation.additionalCosts ?? []),
          {
            id: `manuell-${Date.now()}`,
            name: "",
            quantity: 1,
            priceWithMarkup: 0,
          },
        ],
      },
    });

  // ── Produktark ──────────────────────────────────────────────────────────────
  // Samme bøtte og samme filsti som priskalkulatoren bruker når estimatet
  // opprettes, slik at vedleggene ligger samlet per lead.
  const [uploading, setUploading] = useState<string | null>(null);

  const uploadAttachment = async (
    key: "suppliers" | "mounting",
    index: number,
    file: File,
  ) => {
    const rowKey = `${key}-${index}`;
    setUploading(rowKey);
    try {
      const filePath = `${estimate.lead_id}/attachments/${sanitizeFileName(
        `${key}-${index}`,
      )}-${Date.now()}-${sanitizeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from("estimate-attachments")
        .upload(filePath, file);

      if (uploadError) {
        toast.error(`Opplasting feilet: ${uploadError.message}`);
        return;
      }

      const { data } = supabase.storage
        .from("estimate-attachments")
        .getPublicUrl(filePath);

      if (!data?.publicUrl) {
        toast.error("Kunne ikke hente lenke til filen.");
        return;
      }

      updateLine(key, index, { attachmentUrl: data.publicUrl });
      toast.success(`${file.name} er lastet opp.`);
    } finally {
      setUploading(null);
    }
  };

  // ── Produkt- og monteringslinjer ────────────────────────────────────────────
  // Rader legges til og fjernes på samme måte som når estimatet opprettes i
  // priskalkulatoren. Et batteri er bare en rad med kategori "batteri".
  const addLine = (key: "suppliers" | "mounting") =>
    setPriceData({
      [key]: [
        ...(priceData?.[key] ?? []),
        {
          id: `manuell-${Date.now()}`,
          name: "",
          product: "",
          supplier: "",
          category: "",
          quantity: 1,
          priceWithMarkup: 0,
          capacityKwh: null,
        },
      ],
    } as Partial<PriceOverview>);

  const removeLine = (key: "suppliers" | "mounting", index: number) =>
    setPriceData({
      [key]: (priceData?.[key] ?? []).filter((_, i) => i !== index),
    } as Partial<PriceOverview>);

  // ── Lagring ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (locked) return;

    setSaving(true);
    try {
      const nextPriceData: PriceOverview | undefined = priceData
        ? {
            ...priceData,
            total: effectiveTotal,
            "total inkl. alt": effectiveTotalInclVat,
          }
        : undefined;

      const payload = {
        total_panels: draft.total_panels ?? null,
        kwp: draft.kwp ?? null,
        selected_panel_type: draft.selected_panel_type ?? null,
        selected_roof_type: draft.selected_roof_type ?? null,
        checked_roof_data: draft.checked_roof_data ?? null,
        selected_el_price: draft.selected_el_price ?? null,
        yearly_cost: draft.yearly_cost ?? null,
        yearly_cost2: draft.yearly_cost2 ?? null,
        yearly_prod: draft.yearly_prod ?? null,
        desired_kwh: draft.desired_kwh ?? null,
        coverage_percentage: draft.coverage_percentage ?? null,
        private: draft.private ?? false,
        finished: draft.finished ?? false,
        price_data: nextPriceData,
      };

      const updated = await updateEstimate(estimate.id, payload);

      onSaved({ ...draft, ...updated });
      toast.success("Tilbudet er oppdatert.");
      onClose();
    } catch (err) {
      console.error("Kunne ikke lagre estimat", err);
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Kunne ikke lagre tilbudet.",
      );
    } finally {
      setSaving(false);
    }
  };


  // ── Kostnad og påslag fra den låste kalkyleversjonen ───────────────────────
  const quoteVersionId =
    (estimate.price_data as { quoteVersionId?: string } | undefined)?.quoteVersionId ??
    (estimate as { quote_version_id?: string | null }).quote_version_id ??
    null;
  const [lineCosts, setLineCosts] = useState<Record<string, LineCost>>({});
  const [groupCosts, setGroupCosts] = useState<Record<string, GroupCost>>({});
  const [costState, setCostState] = useState<"none" | "loading" | "ok" | "error">(quoteVersionId ? "loading" : "none");

  useEffect(() => {
    if (!quoteVersionId) return;
    let cancelled = false;
    getQuoteVersion(quoteVersionId)
      .then((v) => {
        if (cancelled) return;
        const lines: Record<string, LineCost> = {};
        const groups: Record<string, GroupCost> = {};
        for (const l of v.result.lines) {
          const base = Number(l.reducedBase ?? l.base) / 100;
          lines[l.id] = { baseUnit: Number(l.baseUnit) / 100, base, markupPercent: Number(l.markupPercent), unit: l.unit };
          const group = (l.meta?.workGroup as string | undefined) ?? null;
          if (l.kind === "work" && group && group !== "tillegg") {
            groups[group] = { base: (groups[group]?.base ?? 0) + base };
          }
        }
        setLineCosts(lines);
        setGroupCosts(groups);
        setCostState("ok");
      })
      .catch(() => !cancelled && setCostState("error"));
    return () => {
      cancelled = true;
    };
  }, [quoteVersionId]);

  const totalCost = useMemo(() => {
    if (costState !== "ok") return null;
    const items = [
      ...(priceData?.suppliers ?? []),
      ...(priceData?.mounting ?? []),
      ...(priceData?.installation?.additionalCosts ?? []),
    ];
    const lineBase = items.reduce((sum, item) => sum + (lineCosts[item.id]?.base ?? 0), 0);
    const groupBase = Object.values(groupCosts).reduce((sum, g) => sum + g.base, 0);
    return lineBase + groupBase;
  }, [costState, lineCosts, groupCosts, priceData]);

  const lineRow = (key: "suppliers" | "mounting", item: LineItem, i: number, title: string) => {
    const sale = Number(item.priceWithMarkup || 0);
    const cost = lineCosts[item.id];
    return (
      <tr key={`${key}-${item.id}-${i}`} className="border-b border-white/5 align-top hover:bg-white/[0.03]">
        <td className="px-1 py-1.5">
          <input
            className={`${sheetInput} font-semibold`}
            value={item.name ?? ""}
            placeholder="Navn"
            disabled={locked}
            aria-label="Navn"
            onChange={(e) => updateLine(key, i, { name: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-1">
            <input className={sheetSub} value={item.product ?? ""} placeholder="Produkt" disabled={locked} aria-label="Produkt" onChange={(e) => updateLine(key, i, { product: e.target.value })} />
            <input className={sheetSub} value={item.supplier ?? ""} placeholder="Leverandør" disabled={locked} aria-label="Leverandør" onChange={(e) => updateLine(key, i, { supplier: e.target.value })} />
            <input className={sheetSub} value={item.category ?? ""} placeholder="Kategori" disabled={locked} aria-label="Kategori" onChange={(e) => updateLine(key, i, { category: e.target.value })} />
          </div>
        </td>
        <td className="px-1 py-1.5">
          <input
            type="number"
            step="any"
            className={sheetNum}
            value={item.quantity ?? ""}
            disabled={locked}
            aria-label="Antall"
            onChange={(e) => updateLine(key, i, { quantity: toNumberOrNull(e.target.value) ?? 0 })}
          />
          {cost?.unit && <span className="block pr-2 text-right text-[11px] text-white/40">{cost.unit}</span>}
        </td>
        <CostCells cost={cost} sale={sale} quantity={Number(item.quantity || 0)} />
        <td className="px-1 py-1.5">
          <CommitNumber className={`${sheetNum} font-semibold`} value={sale} disabled={locked} ariaLabel="Sum eks. mva" onCommit={(v) => updateLine(key, i, { priceWithMarkup: v ?? 0 })} />
        </td>
        <td className="px-1 py-1.5">
          <CommitNumber
            className={sheetNum}
            value={sale * VAT_MULTIPLIER}
            disabled={locked}
            ariaLabel="Sum inkl. mva"
            onCommit={(v) => updateLine(key, i, { priceWithMarkup: (v ?? 0) / VAT_MULTIPLIER })}
          />
        </td>
        <td className="px-1 py-1.5">
          <div className="flex items-center justify-end gap-1">
            <input
              type="number"
              step="any"
              className={`${sheetNum} w-16`}
              value={item.capacityKwh ?? ""}
              placeholder="kWh"
              title="Kapasitet i kWh (batteri)"
              disabled={locked}
              aria-label="Kapasitet kWh"
              onChange={(e) => updateLine(key, i, { capacityKwh: toNumberOrNull(e.target.value) })}
            />
            {item.attachmentUrl ? (
              <>
                <a href={item.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex size-7 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white" title="Se produktark">
                  <FileText className="h-4 w-4" />
                </a>
                {!locked && (
                  <button className="inline-flex size-7 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white" onClick={() => updateLine(key, i, { attachmentUrl: undefined })} aria-label="Fjern produktark" title="Fjern produktark">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            ) : (
              !locked && (
                <label className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white" title={uploading === `${key}-${i}` ? "Laster opp…" : "Last opp produktark"}>
                  <Upload className="h-4 w-4" />
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploading === `${key}-${i}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadAttachment(key, i, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )
            )}
            {!locked && (
              <button className="inline-flex size-7 items-center justify-center rounded-md text-red-300 hover:bg-red-500/15 hover:text-red-200" onClick={() => removeLine(key, i)} aria-label={`Fjern rad fra ${title}`} title="Fjern rad">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const installationRows: { key: "søknad" | "solcelleAnlegg" | "battery"; label: string; group: string }[] = [
    { key: "søknad", label: "Søknad", group: "søknad" },
    { key: "solcelleAnlegg", label: "Elektrisk installasjon solcelleanlegg", group: "solcelleanlegg" },
    { key: "battery", label: "Batteriarbeid", group: "batteri" },
  ];

  return (
    <section className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center p-2 sm:p-3">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[3px]" onClick={onClose} />

      <div className="relative flex h-[96vh] w-full max-w-[1700px] animate-pop-in flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
        {/* Topplinje */}
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold text-ink">Linjeskjema</h2>
            <p className="truncate font-mono text-[11px] text-muted">{estimate.id}</p>
          </div>

          <div className="flex items-center gap-2">
            {locked ? (
              <span className="sk-badge sk-badge-success px-2.5 py-1 text-xs">
                <Lock size={12} />
                Signert {new Date(estimate.signed_at as string).toLocaleDateString("nb-NO")} — låst
              </span>
            ) : (
              <button className="sk-btn sk-btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={15} />
                {saving ? "Lagrer…" : "Lagre og oppdater tilbudet"}
              </button>
            )}
            <button className="sk-icon-btn" onClick={onClose} aria-label="Lukk" title="Lukk">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-auto bg-gray-50/60 px-5 py-4 text-sm">
          {locked && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <Lock size={15} className="mt-0.5 shrink-0" />
              Tilbudet er signert. Innholdet er låst slik at den signerte versjonen ikke endres. Opprett et nytt estimat for å gjøre endringer.
            </p>
          )}

          {locked && quoteVersionId && <SignedBreakdownPanel estimateId={estimate.id} />}

          {/* ── Anlegget ──────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10">
              <InfoField label="Paneler" value={draft.total_panels} disabled={locked} onChange={(raw) => setDraft((p) => ({ ...p, total_panels: toNumberOrNull(raw) ?? undefined }))} />
              <InfoField label="Effekt" suffix="kWp" value={draft.kwp} disabled={locked} onChange={(raw) => setDraft((p) => ({ ...p, kwp: toNumberOrNull(raw) ?? undefined }))} />
              <InfoField label="Årsproduksjon" suffix="kWh" value={draft.yearly_prod} disabled={locked} onChange={(raw) => setDraft((p) => ({ ...p, yearly_prod: toNumberOrNull(raw) ?? undefined }))} />
              <InfoField label="Paneltype" type="text" value={draft.selected_panel_type} disabled={locked} onChange={(raw) => setDraft((p) => ({ ...p, selected_panel_type: raw }))} />
              <InfoField label="Taktype" type="text" value={draft.selected_roof_type} disabled={locked} onChange={(raw) => setDraft((p) => ({ ...p, selected_roof_type: raw }))} />
              <InfoField label="Strømpris" suffix="kr/kWh" value={draft.selected_el_price} disabled={locked} onChange={(raw) => setDraft((p) => ({ ...p, selected_el_price: toNumberOrNull(raw) ?? undefined }))} />
              <InfoField label="Ønsket forbruk" suffix="kWh" value={draft.desired_kwh} disabled={locked} onChange={(raw) => setDraft((p) => ({ ...p, desired_kwh: toNumberOrNull(raw) ?? undefined }))} />
              <InfoField label="Dekningsgrad" suffix="%" value={draft.coverage_percentage} disabled={locked} onChange={(raw) => setDraft((p) => ({ ...p, coverage_percentage: toNumberOrNull(raw) ?? undefined }))} />
              <InfoField label="Årskostnad strøm" suffix="kr" value={draft.yearly_cost} disabled={locked} onChange={(raw) => setDraft((p) => ({ ...p, yearly_cost: toNumberOrNull(raw) ?? undefined }))} />
              <InfoField label="Årskostnad (alt. 2)" suffix="kr" value={draft.yearly_cost2} disabled={locked} onChange={(raw) => setDraft((p) => ({ ...p, yearly_cost2: toNumberOrNull(raw) ?? undefined }))} />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2 text-xs">
              <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-ink">
                <input type="checkbox" checked={Boolean(draft.private)} disabled={locked} onChange={(e) => setDraft((p) => ({ ...p, private: e.target.checked }))} />
                Næringskunde (vis eks. mva, uten Enova)
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-ink">
                <input type="checkbox" checked={Boolean(draft.finished)} disabled={locked} onChange={(e) => setDraft((p) => ({ ...p, finished: e.target.checked }))} />
                Ferdigstilt tilbud (klart for signering)
              </label>
            </div>
          </div>

          {/* ── Takflater ─────────────────────────────────────────────── */}
          {Array.isArray(draft.checked_roof_data) && draft.checked_roof_data.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <tr className="border-b border-line">
                    <th className="px-3 py-2">Takflate</th>
                    <th className="px-3 py-2 text-right">Vinkel °</th>
                    <th className="px-3 py-2 text-right">Retning °</th>
                    <th className="px-3 py-2 text-right">Maks paneler</th>
                    <th className="px-3 py-2 text-right">Justerte paneler</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.checked_roof_data.map((roof, i) => {
                    const roofCell = "h-7 w-24 rounded border border-transparent bg-transparent px-1 text-right tabular-nums hover:border-line focus:border-gray-300 focus:bg-white";
                    return (
                      <tr key={`${roof.roof_id}-${i}`} className="border-b border-gray-100 last:border-0">
                        <td className="px-3 py-1 font-semibold text-ink">Tak {roof.roof_id}</td>
                        <td className="px-3 py-1 text-right"><input type="number" step="any" className={roofCell} value={roof.angle ?? ""} disabled={locked} aria-label="Vinkel" onChange={(e) => updateRoof(i, { angle: toNumberOrNull(e.target.value) ?? 0 })} /></td>
                        <td className="px-3 py-1 text-right"><input className={roofCell} value={roof.direction ?? ""} disabled={locked} aria-label="Retning" onChange={(e) => updateRoof(i, { direction: e.target.value })} /></td>
                        <td className="px-3 py-1 text-right"><input type="number" step="any" className={roofCell} value={roof.max_panels ?? ""} disabled={locked} aria-label="Maks paneler" onChange={(e) => updateRoof(i, { max_panels: toNumberOrNull(e.target.value) ?? 0 })} /></td>
                        <td className="px-3 py-1 text-right"><input type="number" step="any" className={roofCell} value={roof.adjusted_panel_count ?? ""} disabled={locked} aria-label="Justerte paneler" onChange={(e) => updateRoof(i, { adjusted_panel_count: toNumberOrNull(e.target.value) ?? 0 })} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Linjeskjema ───────────────────────────────────────────── */}
          <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-blue-800 p-4 text-white shadow-pop sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-base font-semibold">Priser</h3>
              <span className="text-xs text-white/55">
                Alle beløp i kr eks. mva der ikke annet står.
                {costState === "loading" && " Henter kostnad og påslag fra kalkylen …"}
                {costState === "none" && " Kostnad og påslag finnes bare for estimater laget med den nye kalkulatoren."}
                {costState === "error" && " Fikk ikke hentet kostnad og påslag fra kalkylen."}
              </span>
            </div>

            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
                  <tr>
                    <th className="px-2 py-2 text-left">Post</th>
                    <th className="w-20 px-2 py-2 text-right">Antall</th>
                    <th className="w-28 px-2 py-2 text-right" title="Innkjøp eller avtalt sats per enhet">Kostnad / stk</th>
                    <th className="w-24 px-2 py-2 text-right" title="Påslag på kostnaden (installatør/elektriker)">Påslag</th>
                    <th className="w-24 px-2 py-2 text-right">Pris / stk</th>
                    <th className="w-32 px-2 py-2 text-right">Sum eks. mva</th>
                    <th className="w-32 px-2 py-2 text-right">Sum inkl. mva</th>
                    <th className="w-40 px-2 py-2 text-right">kWh · ark</th>
                    <th className="w-0 p-0" />
                  </tr>
                </thead>
                <tbody>
                  {(["suppliers", "mounting"] as const).map((key) => {
                    const items = priceData?.[key] ?? [];
                    const title = key === "suppliers" ? "Produkter" : "Montering";
                    return [
                      <GroupRow key={`${key}-head`} title={title} count={items.length} action={!locked && <AddButton onClick={() => addLine(key)} label="Legg til rad" />} />,
                      ...(items.length === 0
                        ? [
                            <tr key={`${key}-empty`}>
                              <td colSpan={9} className="px-3 py-2 text-xs text-white/40">Ingen rader.</td>
                            </tr>,
                          ]
                        : items.map((item, i) => lineRow(key, item, i, title))),
                    ];
                  })}

                  {priceData?.installation && (
                    <>
                      <GroupRow title="Installasjon og arbeid" action={!locked && <AddButton onClick={addAdditionalCost} label="Legg til tilleggskostnad" />} />
                      {installationRows.map(({ key, label, group }) => {
                        const sale = Number(priceData.installation[key]?.priceWithMarkup || 0);
                        if (key === "battery" && sale === 0 && !groupCosts[group]) return null;
                        return (
                          <tr key={key} className="border-b border-white/5 hover:bg-white/[0.03]">
                            <td className="px-3 py-1.5 font-semibold">{label}</td>
                            <td className="px-2 py-1.5 text-right text-white/40">—</td>
                            <CostCells cost={groupCosts[group]} sale={sale} quantity={1} />
                            <td className="px-1 py-1.5">
                              <CommitNumber className={`${sheetNum} font-semibold`} value={sale} disabled={locked} ariaLabel={`${label} eks. mva`} onCommit={(v) => updateInstallation(key, v ?? 0)} />
                            </td>
                            <td className="px-1 py-1.5">
                              <CommitNumber className={sheetNum} value={sale * VAT_MULTIPLIER} disabled={locked} ariaLabel={`${label} inkl. mva`} onCommit={(v) => updateInstallation(key, (v ?? 0) / VAT_MULTIPLIER)} />
                            </td>
                            <td />
                            <td />
                          </tr>
                        );
                      })}
                      {(priceData.installation.additionalCosts ?? []).map((cost, i) => {
                        const sale = Number(cost.priceWithMarkup || 0);
                        return (
                          <tr key={`add-${cost.id}-${i}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                            <td className="px-1 py-1.5">
                              <input className={`${sheetInput} font-semibold`} value={cost.name ?? ""} placeholder="Tilleggskostnad" disabled={locked} aria-label="Tilleggskostnad" onChange={(e) => updateAdditionalCost(i, { name: e.target.value })} />
                            </td>
                            <td className="px-1 py-1.5">
                              <input type="number" step="any" className={sheetNum} value={cost.quantity ?? ""} disabled={locked} aria-label="Antall" onChange={(e) => updateAdditionalCost(i, { quantity: toNumberOrNull(e.target.value) ?? 0 })} />
                            </td>
                            <CostCells cost={lineCosts[cost.id]} sale={sale} quantity={Number(cost.quantity || 0)} />
                            <td className="px-1 py-1.5">
                              <CommitNumber className={`${sheetNum} font-semibold`} value={sale} disabled={locked} ariaLabel="Sum eks. mva" onCommit={(v) => updateAdditionalCost(i, { priceWithMarkup: v ?? 0 })} />
                            </td>
                            <td className="px-1 py-1.5">
                              <CommitNumber className={sheetNum} value={sale * VAT_MULTIPLIER} disabled={locked} ariaLabel="Sum inkl. mva" onCommit={(v) => updateAdditionalCost(i, { priceWithMarkup: (v ?? 0) / VAT_MULTIPLIER })} />
                            </td>
                            <td className="px-1 py-1.5 text-right">
                              {!locked && (
                                <button className="inline-flex size-7 items-center justify-center rounded-md text-red-300 hover:bg-red-500/15 hover:text-red-200" onClick={() => removeAdditionalCost(i)} aria-label="Fjern tilleggskostnad" title="Fjern rad">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                            <td />
                          </tr>
                        );
                      })}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Totaler ─────────────────────────────────────────────── */}
            <div className="mt-5 grid gap-x-10 gap-y-1 border-t border-white/20 pt-4 lg:grid-cols-2">
              <div className="space-y-1.5">
                {totalCost != null && (
                  <div className="flex justify-between text-white/70">
                    <span>Kostnad (innkjøp og avtalte satser)</span>
                    <span className="font-semibold tabular-nums">{nok(totalCost)} kr</span>
                  </div>
                )}
                {totalCost != null && (
                  <div className="flex justify-between text-white/70">
                    <span>Påslag</span>
                    <span className="font-semibold tabular-nums">
                      {nok(lineTotal - totalCost)} kr
                      {totalCost > 0 && <span className="ml-1.5 text-white/45">({pctText(((lineTotal - totalCost) / totalCost) * 100)})</span>}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-white/70">
                  <span>Sum av linjene</span>
                  <span className="font-semibold tabular-nums">{nok(lineTotal)} kr</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <label className="text-white/70" htmlFor="estimate-commission">Soleklart salgsprovisjon</label>
                  <div className="flex items-center gap-1">
                    <input
                      id="estimate-commission"
                      type="number"
                      step="any"
                      className="h-8 w-36 rounded-lg border border-white/15 !bg-white/10 px-3 text-right text-sm tabular-nums !text-white disabled:opacity-60"
                      value={Math.round(Number(commission || 0))}
                      disabled={locked}
                      onChange={(e) => setCommission(toNumberOrNull(e.target.value) ?? 0)}
                    />
                    <span className="text-xs text-white/50">kr</span>
                  </div>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1.5 text-white/70">
                  <span>Sum inkl. provisjon</span>
                  <span className="font-semibold tabular-nums">{nok(subTotal)} kr</span>
                </div>
                {!draft.private && Number(draft.kwp || 0) > 0 && (
                  <div className="flex justify-between text-emerald-300">
                    <span>
                      Enova-støtte ({Math.min(Number(draft.kwp || 0), ENOVA_MAX_KWP).toFixed(2)} kWp × {nok(ENOVA_RATE_PER_KWP)} kr)
                    </span>
                    <span className="font-semibold tabular-nums">−{nok(enovaSupport)} kr</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span>Total eks. mva</span>
                  <div className="flex items-center gap-1">
                    <CommitNumber
                      className="h-9 w-40 rounded-lg border border-white/15 !bg-white/10 px-3 text-right text-sm font-semibold tabular-nums !text-white disabled:opacity-60"
                      value={effectiveTotal}
                      disabled={locked}
                      ariaLabel="Total eks. mva"
                      onCommit={(v) => setPriceData({ totalOverride: v })}
                    />
                    <span className="text-xs text-white/50">kr</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 font-display text-lg font-semibold">
                  <span>Kundepris inkl. mva</span>
                  <div className="flex items-center gap-1">
                    <CommitNumber
                      className="h-10 w-44 rounded-lg border border-white/15 !bg-white/10 px-3 text-right text-lg font-semibold tabular-nums !text-white disabled:opacity-60"
                      value={effectiveTotalInclVat}
                      disabled={locked}
                      ariaLabel="Kundepris inkl. mva"
                      onCommit={(v) => setPriceData({ totalOverride: v === null ? null : v / VAT_MULTIPLIER })}
                    />
                    <span className="font-sans text-xs font-normal text-white/50">kr</span>
                  </div>
                </div>
                {!draft.private && Number(draft.kwp || 0) > 0 && (
                  <div className="flex justify-between text-sm text-white/70">
                    <span>Etter Enova-støtte (inkl. mva)</span>
                    <span className="font-semibold tabular-nums">{nok(effectiveTotalInclVat - enovaSupport)} kr</span>
                  </div>
                )}
                {hasOverride ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-orange-300">Overstyrt: {nok(Number(override) - subTotal)} kr i forhold til summen inkl. provisjon.</p>
                    {!locked && (
                      <button className="text-xs font-medium text-white/70 underline hover:text-white" onClick={() => setPriceData({ totalOverride: null })}>
                        Fjern overstyring
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-white/50">Skriv inn total eks. eller inkl. mva for å overstyre summen. Tomt felt = bruk summen.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
