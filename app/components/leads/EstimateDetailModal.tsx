"use client";

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { FileText, Plus, Trash2, Upload, X } from "lucide-react";
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
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type={type}
          step={type === "number" ? "any" : undefined}
          className="w-full border rounded-md px-2 py-1.5 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-500"
          value={value ?? ""}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffix && (
          <span className="text-xs text-gray-500 whitespace-nowrap">
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
    <div className="flex items-center justify-between border-b pb-1 mb-3">
      <h3 className="font-semibold text-gray-700">{title}</h3>
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
    <section className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />

      <div className="relative bg-white w-4/5 h-4/5 rounded-lg shadow-lg flex flex-col">
        {/* Topplinje */}
        <div className="flex justify-between items-center gap-4 px-4 py-3 border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">
              Detaljert estimat
            </h2>
            <p className="text-xs text-gray-500 truncate">{estimate.id}</p>
          </div>

          <div className="flex items-center gap-2">
            {locked ? (
              <span className="text-sm px-3 py-1.5 rounded-md bg-green-100 text-green-900 font-medium">
                Signert{" "}
                {new Date(estimate.signed_at as string).toLocaleDateString(
                  "nb-NO",
                )}{" "}
                — låst
              </span>
            ) : (
              <button
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Lagrer…" : "Lagre og oppdater tilbudet"}
              </button>
            )}
            <button
              className="px-3 py-1.5 bg-gray-200 rounded-md text-sm"
              onClick={onClose}
            >
              Lukk
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 text-sm space-y-7">
          {locked && (
            <p className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3">
              Tilbudet er signert. Innholdet er låst slik at den signerte
              versjonen ikke endres. Opprett et nytt estimat for å gjøre
              endringer.
            </p>
          )}

          {/* ── Anleggsdata ─────────────────────────────────────────────── */}
          <div>
            <SectionHeading title="Anlegget" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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

            <div className="flex flex-wrap gap-6 mt-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(draft.private)}
                  disabled={locked}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, private: e.target.checked }))
                  }
                />
                <span className="text-xs font-medium text-gray-600">
                  Næringskunde (vis eks. mva, uten Enova)
                </span>
              </label>
              <label className="flex items-center gap-2">
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
                <span className="text-xs font-medium text-gray-600">
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {draft.checked_roof_data.map((roof, i) => (
                    <div
                      key={`${roof.roof_id}-${i}`}
                      className="bg-slate-50 rounded-lg p-3 border"
                    >
                      <p className="font-medium text-gray-800 mb-2">
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
                        className="flex items-center gap-1 text-xs font-medium text-blue-700"
                        onClick={() => addLine(key)}
                      >
                        <Plus className="w-3.5 h-3.5" /> Legg til rad
                      </button>
                    )
                  }
                />

                {items.length === 0 ? (
                  <p className="text-sm text-gray-500 bg-slate-50 border rounded-lg p-3">
                    Ingen rader.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {items.map((item, i) => (
                      <div
                        key={`${item.id}-${i}`}
                        className="bg-slate-50 rounded-lg p-3 border flex flex-col gap-3"
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
                            <span className="text-xs font-medium text-gray-600">
                              Produktark (valgfritt)
                            </span>
                            {item.attachmentUrl ? (
                              <div className="flex items-center gap-2 min-w-0">
                                <a
                                  href={item.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 text-sm text-blue-700 underline truncate"
                                >
                                  <FileText className="w-4 h-4 flex-shrink-0" />
                                  <span className="truncate">
                                    Se produktark
                                  </span>
                                </a>
                                {!locked && (
                                  <button
                                    className="p-1 text-gray-500 hover:text-red-700"
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
                              <span className="text-sm text-gray-500">
                                Ingen fil
                              </span>
                            ) : (
                              <label className="flex items-center gap-1.5 text-sm text-blue-700 cursor-pointer w-fit">
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
                              className="p-2 text-red-700 rounded-md bg-red-500/10 h-fit"
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
                      className="flex items-center gap-1 text-xs font-medium text-blue-700"
                      onClick={addAdditionalCost}
                    >
                      <Plus className="w-3.5 h-3.5" /> Legg til tilleggskostnad
                    </button>
                  )
                }
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                <div className="space-y-3 mt-3">
                  {priceData.installation.additionalCosts.map((cost, i) => (
                    <div
                      key={`${cost.id}-${i}`}
                      className="bg-slate-50 rounded-lg p-3 border grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end"
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
                          className="p-2 text-red-700 rounded-md bg-red-500/10 h-fit"
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
              <div className="bg-green-50 rounded-lg p-3 border border-green-200 space-y-1">
                <div className="flex justify-between text-gray-700">
                  <span>
                    {Math.min(
                      Number(draft.kwp || 0),
                      ENOVA_MAX_KWP,
                    ).toFixed(2)}{" "}
                    kWp × {nok(ENOVA_RATE_PER_KWP)} kr
                  </span>
                  <span className="font-semibold text-green-700">
                    -{nok(enovaSupport)} kr
                  </span>
                </div>
                <div className="flex justify-between font-medium text-gray-800 border-t border-green-200 pt-1">
                  <span>Pris etter Enova-støtte (inkl. mva)</span>
                  <span>{nok(effectiveTotalInclVat - enovaSupport)} kr</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Totaler ─────────────────────────────────────────────────── */}
          <div className="bg-gray-800 text-white rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-gray-300">
              <span>Sum av linjene eks. mva</span>
              <span className="font-semibold tabular-nums">
                {nok(lineTotal)} kr
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label
                className="text-gray-300"
                htmlFor="estimate-commission"
              >
                Soleklart salgsprovisjon
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="estimate-commission"
                  type="number"
                  step="any"
                  className="border border-gray-600 bg-gray-700 rounded-md px-2 py-1 text-sm w-36 text-right tabular-nums disabled:opacity-60"
                  value={Math.round(Number(commission || 0))}
                  disabled={locked}
                  onChange={(e) =>
                    setCommission(toNumberOrNull(e.target.value) ?? 0)
                  }
                />
                <span className="text-xs text-gray-400">kr</span>
              </div>
            </div>

            <div className="flex justify-between text-gray-300 border-t border-gray-700 pt-2">
              <span>Sum inkl. provisjon</span>
              <span className="font-semibold tabular-nums">
                {nok(subTotal)} kr
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-300">
                Manuell tilbudspris eks. mva (tom = bruk summen over)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  className="border border-gray-600 bg-gray-700 rounded-md px-2 py-1.5 text-sm w-48 disabled:opacity-60"
                  value={hasOverride ? Math.round(Number(override)) : ""}
                  placeholder={String(Math.round(subTotal))}
                  disabled={locked}
                  onChange={(e) =>
                    setPriceData({ totalOverride: toNumberOrNull(e.target.value) })
                  }
                />
                {hasOverride && !locked && (
                  <button
                    className="text-xs underline text-gray-300"
                    onClick={() => setPriceData({ totalOverride: null })}
                  >
                    Fjern overstyring
                  </button>
                )}
              </div>
              {hasOverride && (
                <p className="text-xs text-amber-300">
                  Overstyrt: {nok(Number(override) - subTotal)} kr i forhold
                  til summen inkl. provisjon.
                </p>
              )}
            </div>

            <div className="flex justify-between border-t border-gray-600 pt-2">
              <span>Total eks. mva</span>
              <span className="font-semibold tabular-nums">
                {nok(effectiveTotal)} kr
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold">
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
