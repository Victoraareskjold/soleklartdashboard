"use client";

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FileText, Lock, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { Estimate } from "@/lib/types";
import { PriceLineItem, PriceOverview } from "@/types/price_table";
import { updateEstimate } from "@/lib/api";
import { supabase } from "@/lib/supabase";

/**
 * Detaljert visning av et estimat — redigerbar så lenge tilbudet ikke er
 * signert. Lagring skriver tilbake til estimates-raden, slik at kundens
 * tilbudslenke viser de oppdaterte verdiene umiddelbart.
 *
 * Produkt- og monteringslinjer kan legges til og fjernes på samme måte som
 * når estimatet opprettes i priskalkulatoren. Et batteri er bare en rad med
 * kategori "batteri", med kWh og produktark som valgfrie felter.
 */

type Props = {
  estimate: Estimate;
  onClose: () => void;
  onSaved: (updated: Estimate) => void;
};

type RoofRow = NonNullable<Estimate["checked_roof_data"]>[number];
type LineItem = PriceLineItem;
type AdditionalCost = PriceOverview["installation"]["additionalCosts"][number];

const ENOVA_RATE_PER_KWP = 2500;
const ENOVA_MAX_KWP = 15;
const VAT_MULTIPLIER = 1.25;

const nok = (value: number) =>
  Number(value || 0).toLocaleString("nb-NO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

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
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
};

function Field({
  label,
  value,
  onChange,
  type = "text",
  suffix,
  disabled,
  placeholder,
}: {
  label: string;
  value: string | number | null | undefined;
  onChange: (raw: string) => void;
  type?: "text" | "number";
  suffix?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="truncate text-xs font-semibold text-gray-700">
        {label}
      </span>
      <div className="relative flex items-center">
        <input
          type={type}
          step={type === "number" ? "any" : undefined}
          className={`sk-input ${type === "number" ? "tabular-nums" : ""} ${suffix ? "pr-14" : ""}`}
          value={value ?? ""}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 whitespace-nowrap text-xs text-muted">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="sk-eyebrow">{title}</h3>
      {action}
    </div>
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

  return (
    <section className="fixed inset-0 z-[60] flex animate-fade-in items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <div className="relative flex h-[88vh] w-full max-w-6xl animate-pop-in flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
        {/* Topplinje */}
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg font-semibold text-ink">
              Detaljert estimat
            </h2>
            <p className="truncate font-mono text-[11px] text-muted">
              {estimate.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {locked ? (
              <span className="sk-badge sk-badge-success px-2.5 py-1 text-xs">
                <Lock size={12} />
                Signert{" "}
                {new Date(estimate.signed_at as string).toLocaleDateString(
                  "nb-NO",
                )}{" "}
                — låst
              </span>
            ) : (
              <button
                className="sk-btn sk-btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                <Save size={15} />
                {saving ? "Lagrer…" : "Lagre og oppdater tilbudet"}
              </button>
            )}
            <button
              className="sk-icon-btn"
              onClick={onClose}
              aria-label="Lukk"
              title="Lukk"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-8 overflow-auto bg-gray-50/50 px-6 py-5 text-sm">
          {locked && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <Lock size={15} className="mt-0.5 shrink-0" />
              Tilbudet er signert. Innholdet er låst slik at den signerte
              versjonen ikke endres. Opprett et nytt estimat for å gjøre
              endringer.
            </p>
          )}

          {/* ── Anleggsdata ─────────────────────────────────────────────── */}
          <div>
            <SectionHeading title="Anlegget" />
            <div className="sk-card-pad grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field
                label="Antall paneler"
                type="number"
                value={draft.total_panels}
                disabled={locked}
                onChange={(raw) =>
                  setDraft((prev) => ({
                    ...prev,
                    total_panels: toNumberOrNull(raw) ?? undefined,
                  }))
                }
              />
              <Field
                label="Installert effekt"
                type="number"
                suffix="kWp"
                value={draft.kwp}
                disabled={locked}
                onChange={(raw) =>
                  setDraft((prev) => ({
                    ...prev,
                    kwp: toNumberOrNull(raw) ?? undefined,
                  }))
                }
              />
              <Field
                label="Årsproduksjon"
                type="number"
                suffix="kWh"
                value={draft.yearly_prod}
                disabled={locked}
                onChange={(raw) =>
                  setDraft((prev) => ({
                    ...prev,
                    yearly_prod: toNumberOrNull(raw) ?? undefined,
                  }))
                }
              />
              <Field
                label="Paneltype"
                value={draft.selected_panel_type}
                disabled={locked}
                onChange={(raw) =>
                  setDraft((prev) => ({ ...prev, selected_panel_type: raw }))
                }
              />
              <Field
                label="Taktype"
                value={draft.selected_roof_type}
                disabled={locked}
                onChange={(raw) =>
                  setDraft((prev) => ({ ...prev, selected_roof_type: raw }))
                }
              />
              <Field
                label="Strømpris lagt til grunn"
                type="number"
                suffix="kr/kWh"
                value={draft.selected_el_price}
                disabled={locked}
                onChange={(raw) =>
                  setDraft((prev) => ({
                    ...prev,
                    selected_el_price: toNumberOrNull(raw) ?? undefined,
                  }))
                }
              />
              <Field
                label="Ønsket forbruk"
                type="number"
                suffix="kWh"
                value={draft.desired_kwh}
                disabled={locked}
                onChange={(raw) =>
                  setDraft((prev) => ({
                    ...prev,
                    desired_kwh: toNumberOrNull(raw) ?? undefined,
                  }))
                }
              />
              <Field
                label="Dekningsgrad"
                type="number"
                suffix="%"
                value={draft.coverage_percentage}
                disabled={locked}
                onChange={(raw) =>
                  setDraft((prev) => ({
                    ...prev,
                    coverage_percentage: toNumberOrNull(raw) ?? undefined,
                  }))
                }
              />
              <Field
                label="Årskostnad strøm"
                type="number"
                suffix="kr"
                value={draft.yearly_cost}
                disabled={locked}
                onChange={(raw) =>
                  setDraft((prev) => ({
                    ...prev,
                    yearly_cost: toNumberOrNull(raw) ?? undefined,
                  }))
                }
              />
              <Field
                label="Årskostnad strøm (alt. 2)"
                type="number"
                suffix="kr"
                value={draft.yearly_cost2}
                disabled={locked}
                onChange={(raw) =>
                  setDraft((prev) => ({
                    ...prev,
                    yearly_cost2: toNumberOrNull(raw) ?? undefined,
                  }))
                }
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={Boolean(draft.private)}
                  disabled={locked}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, private: e.target.checked }))
                  }
                />
                <span className="text-xs font-semibold text-ink">
                  Næringskunde (vis eks. mva, uten Enova)
                </span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={Boolean(draft.finished)}
                  disabled={locked}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      finished: e.target.checked,
                    }))
                  }
                />
                <span className="text-xs font-semibold text-ink">
                  Ferdigstilt tilbud (klart for signering)
                </span>
              </label>
            </div>
          </div>

          {/* ── Takflater ───────────────────────────────────────────────── */}
          {Array.isArray(draft.checked_roof_data) &&
            draft.checked_roof_data.length > 0 && (
              <div>
                <SectionHeading title="Takflater" />
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {draft.checked_roof_data.map((roof, i) => (
                    <div
                      key={`${roof.roof_id}-${i}`}
                      className="sk-card-pad p-4"
                    >
                      <p className="mb-3 text-sm font-semibold text-ink">
                        Tak {roof.roof_id}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Field
                          label="Vinkel"
                          type="number"
                          suffix="°"
                          value={roof.angle}
                          disabled={locked}
                          onChange={(raw) =>
                            updateRoof(i, {
                              angle: toNumberOrNull(raw) ?? 0,
                            })
                          }
                        />
                        <Field
                          label="Retning"
                          suffix="°"
                          value={roof.direction}
                          disabled={locked}
                          onChange={(raw) => updateRoof(i, { direction: raw })}
                        />
                        <Field
                          label="Maks paneler"
                          type="number"
                          value={roof.max_panels}
                          disabled={locked}
                          onChange={(raw) =>
                            updateRoof(i, {
                              max_panels: toNumberOrNull(raw) ?? 0,
                            })
                          }
                        />
                        <Field
                          label="Justerte paneler"
                          type="number"
                          value={roof.adjusted_panel_count}
                          disabled={locked}
                          onChange={(raw) =>
                            updateRoof(i, {
                              adjusted_panel_count: toNumberOrNull(raw) ?? 0,
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* ── Produkter og montering ──────────────────────────────────── */}
          {(["suppliers", "mounting"] as const).map((key) => {
            const items = priceData?.[key] ?? [];
            const title = key === "suppliers" ? "Produkter" : "Montering";

            return (
              <div key={key}>
                <SectionHeading
                  title={title}
                  action={
                    !locked && (
                      <button
                        className="sk-btn sk-btn-ghost sk-btn-sm text-brand hover:bg-brand-soft hover:text-brand"
                        onClick={() => addLine(key)}
                      >
                        <Plus className="w-3.5 h-3.5" /> Legg til rad
                      </button>
                    )
                  }
                />

                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-300 bg-surface p-4 text-center text-sm text-muted">
                    Ingen rader.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {items.map((item, i) => (
                      <div
                        key={`${item.id}-${i}`}
                        className="sk-card-pad flex flex-col gap-3 p-4"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                          <Field
                            label="Navn"
                            value={item.name}
                            disabled={locked}
                            onChange={(raw) => updateLine(key, i, { name: raw })}
                          />
                          <Field
                            label="Produkt"
                            value={item.product}
                            disabled={locked}
                            onChange={(raw) =>
                              updateLine(key, i, { product: raw })
                            }
                          />
                          <Field
                            label="Leverandør"
                            value={item.supplier}
                            disabled={locked}
                            onChange={(raw) =>
                              updateLine(key, i, { supplier: raw })
                            }
                          />
                          <Field
                            label="Kategori"
                            value={item.category}
                            placeholder="f.eks. batteri"
                            disabled={locked}
                            onChange={(raw) =>
                              updateLine(key, i, { category: raw })
                            }
                          />
                          <Field
                            label="Antall"
                            type="number"
                            value={item.quantity}
                            disabled={locked}
                            onChange={(raw) =>
                              updateLine(key, i, {
                                quantity: toNumberOrNull(raw) ?? 0,
                              })
                            }
                          />
                          <Field
                            label="Pris"
                            type="number"
                            suffix="kr"
                            value={Math.round(item.priceWithMarkup)}
                            disabled={locked}
                            onChange={(raw) =>
                              updateLine(key, i, {
                                priceWithMarkup: toNumberOrNull(raw) ?? 0,
                              })
                            }
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr_3fr_auto] gap-3 items-end">
                          <Field
                            label="Kapasitet (valgfritt)"
                            type="number"
                            suffix="kWh"
                            value={item.capacityKwh}
                            disabled={locked}
                            onChange={(raw) =>
                              updateLine(key, i, {
                                capacityKwh: toNumberOrNull(raw),
                              })
                            }
                          />
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs font-semibold text-gray-700">
                              Produktark (valgfritt)
                            </span>
                            {item.attachmentUrl ? (
                              <div className="flex items-center gap-2 min-w-0">
                                <a
                                  href={item.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex h-9 items-center gap-1.5 truncate rounded-lg bg-brand-soft px-3 text-sm font-medium text-brand hover:bg-blue-100"
                                >
                                  <FileText className="w-4 h-4 flex-shrink-0" />
                                  <span className="truncate">
                                    Se produktark
                                  </span>
                                </a>
                                {!locked && (
                                  <button
                                    className="sk-icon-btn size-8 hover:bg-red-50 hover:text-red-600"
                                    onClick={() =>
                                      updateLine(key, i, {
                                        attachmentUrl: undefined,
                                      })
                                    }
                                    aria-label="Fjern produktark"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ) : locked ? (
                              <span className="flex h-9 items-center text-sm text-muted">
                                Ingen fil
                              </span>
                            ) : (
                              <label className="sk-btn sk-btn-secondary w-fit cursor-pointer">
                                <Upload className="w-4 h-4" />
                                <span>
                                  {uploading === `${key}-${i}`
                                    ? "Laster opp…"
                                    : "Last opp fil"}
                                </span>
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
                            )}
                          </div>
                          {!locked && (
                            <button
                              className="sk-icon-btn text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => removeLine(key, i)}
                              aria-label={`Fjern rad fra ${title}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Installasjon ────────────────────────────────────────────── */}
          {priceData?.installation && (
            <div>
              <SectionHeading
                title="Installasjon"
                action={
                  !locked && (
                    <button
                      className="sk-btn sk-btn-ghost sk-btn-sm text-brand hover:bg-brand-soft hover:text-brand"
                      onClick={addAdditionalCost}
                    >
                      <Plus className="w-3.5 h-3.5" /> Legg til tilleggskostnad
                    </button>
                  )
                }
              />
              <div className="sk-card-pad grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field
                  label="Søknad"
                  type="number"
                  suffix="kr"
                  value={Math.round(
                    priceData.installation.søknad?.priceWithMarkup ?? 0,
                  )}
                  disabled={locked}
                  onChange={(raw) =>
                    updateInstallation("søknad", toNumberOrNull(raw) ?? 0)
                  }
                />
                <Field
                  label="Solcelleanlegg"
                  type="number"
                  suffix="kr"
                  value={Math.round(
                    priceData.installation.solcelleAnlegg?.priceWithMarkup ?? 0,
                  )}
                  disabled={locked}
                  onChange={(raw) =>
                    updateInstallation(
                      "solcelleAnlegg",
                      toNumberOrNull(raw) ?? 0,
                    )
                  }
                />
                <Field
                  label="Batteriarbeid"
                  type="number"
                  suffix="kr"
                  value={Math.round(
                    priceData.installation.battery?.priceWithMarkup ?? 0,
                  )}
                  disabled={locked}
                  onChange={(raw) =>
                    updateInstallation("battery", toNumberOrNull(raw) ?? 0)
                  }
                />
              </div>

              {(priceData.installation.additionalCosts ?? []).length > 0 && (
                <div className="mt-3 space-y-3">
                  {priceData.installation.additionalCosts.map((cost, i) => (
                    <div
                      key={`${cost.id}-${i}`}
                      className="sk-card-pad grid grid-cols-2 items-end gap-3 p-4 md:grid-cols-[2fr_1fr_1fr_auto]"
                    >
                      <Field
                        label="Tilleggskostnad"
                        value={cost.name}
                        disabled={locked}
                        onChange={(raw) =>
                          updateAdditionalCost(i, { name: raw })
                        }
                      />
                      <Field
                        label="Antall"
                        type="number"
                        value={cost.quantity}
                        disabled={locked}
                        onChange={(raw) =>
                          updateAdditionalCost(i, {
                            quantity: toNumberOrNull(raw) ?? 0,
                          })
                        }
                      />
                      <Field
                        label="Pris"
                        type="number"
                        suffix="kr"
                        value={Math.round(cost.priceWithMarkup)}
                        disabled={locked}
                        onChange={(raw) =>
                          updateAdditionalCost(i, {
                            priceWithMarkup: toNumberOrNull(raw) ?? 0,
                          })
                        }
                      />
                      {!locked && (
                        <button
                          className="sk-icon-btn text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => removeAdditionalCost(i)}
                          aria-label="Fjern tilleggskostnad"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Enova ───────────────────────────────────────────────────── */}
          {!draft.private && Number(draft.kwp || 0) > 0 && (
            <div>
              <SectionHeading title="Enova-støtte" />
              <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex justify-between tabular-nums text-body">
                  <span>
                    {Math.min(
                      Number(draft.kwp || 0),
                      ENOVA_MAX_KWP,
                    ).toFixed(2)}{" "}
                    kWp × {nok(ENOVA_RATE_PER_KWP)} kr
                  </span>
                  <span className="font-semibold text-emerald-700">
                    -{nok(enovaSupport)} kr
                  </span>
                </div>
                <div className="flex justify-between border-t border-emerald-200 pt-2 font-semibold text-ink">
                  <span>Pris etter Enova-støtte (inkl. mva)</span>
                  <span className="tabular-nums">{nok(effectiveTotalInclVat - enovaSupport)} kr</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Totaler ─────────────────────────────────────────────────── */}
          <div className="space-y-3 rounded-2xl bg-gradient-to-br from-blue-900 to-blue-800 p-5 text-white shadow-pop">
            <div className="flex justify-between text-white/70">
              <span>Sum av linjene eks. mva</span>
              <span className="font-semibold tabular-nums">
                {nok(lineTotal)} kr
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label
                className="text-white/70"
                htmlFor="estimate-commission"
              >
                Soleklart salgsprovisjon
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="estimate-commission"
                  type="number"
                  step="any"
                  className="h-9 w-36 rounded-lg border border-white/15 !bg-white/10 px-3 text-right text-sm tabular-nums !text-white disabled:opacity-60"
                  value={Math.round(Number(commission || 0))}
                  disabled={locked}
                  onChange={(e) =>
                    setCommission(toNumberOrNull(e.target.value) ?? 0)
                  }
                />
                <span className="text-xs text-white/50">kr</span>
              </div>
            </div>

            <div className="flex justify-between border-t border-white/10 pt-3 text-white/70">
              <span>Sum inkl. provisjon</span>
              <span className="font-semibold tabular-nums">
                {nok(subTotal)} kr
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/60">
                Manuell tilbudspris eks. mva (tom = bruk summen over)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  className="h-9 w-48 rounded-lg border border-white/15 !bg-white/10 px-3 text-sm tabular-nums !text-white placeholder:!text-white/40 disabled:opacity-60"
                  value={hasOverride ? Math.round(Number(override)) : ""}
                  placeholder={String(Math.round(subTotal))}
                  disabled={locked}
                  onChange={(e) =>
                    setPriceData({ totalOverride: toNumberOrNull(e.target.value) })
                  }
                />
                {hasOverride && !locked && (
                  <button
                    className="text-xs font-medium text-white/70 underline hover:text-white"
                    onClick={() => setPriceData({ totalOverride: null })}
                  >
                    Fjern overstyring
                  </button>
                )}
              </div>
              {hasOverride && (
                <p className="text-xs text-orange-300">
                  Overstyrt: {nok(Number(override) - subTotal)} kr i forhold
                  til summen inkl. provisjon.
                </p>
              )}
            </div>

            <div className="flex justify-between border-t border-white/15 pt-3">
              <span>Total eks. mva</span>
              <span className="font-semibold tabular-nums">
                {nok(effectiveTotal)} kr
              </span>
            </div>
            <div className="flex items-baseline justify-between font-display text-xl font-semibold">
              <span>Total inkl. mva</span>
              <span className="tabular-nums">
                {nok(effectiveTotalInclVat)} kr
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
