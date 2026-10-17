"use client";

// Prisberegning. Utkastet regnes i kalkulator-API-et ved hver endring (samme regler som ved lagring).
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  createCalculation,
  getCalculation,
  listCalculations,
  previewDraft,
  updateCalculation,
  type CalcCatalog,
  type CalcDraftSummary,
  type CalcProduct,
  type BatteryOfferConfig,
  type BatteryOfferResult,
  type CalcResult,
  type Economy,
  type LineKind,
} from "@/lib/calcApi";
import { Dialog } from "./Dialog";
import { Help } from "./fields";
import {
  alternativesFor,
  applyRules,
  customLine,
  inverterGroups,
  inverterNeed,
  kwpOf,
  mountLine,
  newDraft,
  normalizeDraft,
  panelCountOf,
  productLine,
  refreshPrices,
  setPanelCount,
  specsOf,
  suggestInverter,
  swapProduct,
  workLine,
  type Adjustment,
  type Grid,
  type InverterNeed,
  type QuoteDraft,
  type QuoteLine,
  type Scenario,
} from "./quote";
import { WORK_GROUP_LABELS } from "./Agreements";
import s from "./kalkulator.module.css";

const money = (ore: number, decimals = 0) =>
  `${new Intl.NumberFormat("nb-NO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(ore / 100)} kr`;
const fmt = (n: number, max = 2) => n.toLocaleString("nb-NO", { maximumFractionDigits: max });

const GROUPS: { kind: LineKind; title: string; desc: string; add: string }[] = [
  { kind: "product", title: "Materiell og leveranser", desc: "Utstyr, stillas og frakt", add: "Legg til produkt" },
  { kind: "mount", title: "Montering", desc: "Pris per panel for takflate og festesystem", add: "Legg til montering" },
  { kind: "work", title: "Arbeid og tillegg", desc: "Elektriker, søknad, kabling, grøft og annet", add: "Legg til arbeid" },
];

interface Saved {
  calculationId: string;
  lockVersion: number;
  savedAt: Date;
}

interface KalkulatorProps {
  catalog: CalcCatalog;
  leadId?: string | null;
  /** Fra solkartet: antall paneler og taktype (navn) å starte kalkylen med */
  initialPanels?: number;
  initialRoofName?: string;
  /** Overstyrer lagring (f.eks. «Opprett estimat» på leaden). Ellers lagres et utkast. */
  onSave?: (draft: QuoteDraft, result: CalcResult) => Promise<void>;
  saveLabel?: string;
  /** Bruk hele bredden (estimat på leaden) i stedet for maks 1240 px */
  fullWidth?: boolean;
  /** Estimat: Sum og Kundepris kan skrives inn direkte per linje (blir fast salgsbeløp) */
  editableTotals?: boolean;
  /** Kundens strømnett fra leaden (230/400 V) */
  initialGrid?: Grid;
  /** Kundetype fra leaden (firma = næring) */
  initialCustomerType?: QuoteDraft["customerType"];
  /** Batteri/hybrid-tillegg (estimat). Sendes med til beregning og lagring. */
  batteryOffer?: BatteryOfferConfig;
  /** Kalles hver gang kalkylen er regnet på nytt */
  onResult?: (draft: QuoteDraft, result: CalcResult | null, extra: PreviewExtra) => void;
}

export interface PreviewExtra {
  kwp: number | null;
  batteryOffer: BatteryOfferResult | null;
  economy: Economy | null;
}

/** Installatøren bestemmes av dashboardet (catalog er hentet for den). */
export default function Kalkulator({
  catalog,
  leadId = null,
  initialPanels,
  initialRoofName,
  initialGrid,
  initialCustomerType,
  batteryOffer,
  onSave,
  saveLabel,
  fullWidth = false,
  editableTotals = false,
  onResult,
}: KalkulatorProps) {
  const startDraft = (): QuoteDraft => {
    const roofId = catalog.mountRates.find((m) => m.priceOre != null && m.roofTypeName === initialRoofName)?.roofTypeId;
    const d = newDraft(catalog, "solar", initialPanels && initialPanels > 0 ? initialPanels : 36, roofId, initialGrid ?? "230");
    // Næring: priser eks. mva. og ingen automatisk støtte
    return initialCustomerType === "business" ? { ...d, customerType: "business", support: { mode: "off", amount: "0", provider: "" } } : d;
  };
  const [draft, setDraft] = useState<QuoteDraft>(startDraft);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [extra, setExtra] = useState<PreviewExtra>({ kwp: null, batteryOffer: null, economy: null });
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    null | { type: "add"; kind: LineKind } | { type: "edit"; id: string } | { type: "new" } | { type: "preview" } | { type: "drafts" }
  >(null);

  // Ny installatør, eller nye data fra solkartet = ny kalkyle
  const startKey = `${catalog.installer.id}|${initialPanels ?? ""}|${initialRoofName ?? ""}|${initialGrid ?? ""}|${initialCustomerType ?? ""}`;
  const startRef = useRef(startKey);
  useEffect(() => {
    if (startRef.current !== startKey) {
      startRef.current = startKey;
      setDraft(startDraft());
      setSaved(null);
      setNotice(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey]);

  // Regn på nytt (via API) når utkastet endres
  const fullDraft = useMemo<QuoteDraft>(() => (batteryOffer ? { ...draft, batteryOffer } : draft), [draft, batteryOffer]);
  const draftJson = useMemo(() => JSON.stringify(fullDraft), [fullDraft]);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      previewDraft(catalog.installer.id, JSON.parse(draftJson))
        .then((r) => {
          if (cancelled) return;
          setExtra({ kwp: r.kwp, batteryOffer: r.batteryOffer, economy: r.economy });
          setResult(r.result);
          setError(null);
        })
        .catch((e: Error) => !cancelled && (setResult(null), setError(e.message)));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draftJson, catalog]);

  // Gi beskjed oppover (f.eks. inverterpris til batterioppsettet på estimatet)
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });
  useEffect(() => {
    onResultRef.current?.(draft, result, extra);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, extra]);

  /** Endrer utkastet. rules = kjør regler for batteri/inverter etterpå og vis eventuell melding. */
  const change = (fn: (d: QuoteDraft) => QuoteDraft, rules = false) => {
    setDirty(true);
    setDraft((d) => {
      const next = fn(d);
      if (!rules) return next;
      const r = applyRules(catalog, next);
      if (r.notice) setNotice(r.notice);
      return r.draft;
    });
  };
  const update = (patch: Partial<QuoteDraft>, rules = false) => change((d) => ({ ...d, ...patch }), rules);
  const updateLine = (id: string, patch: Partial<QuoteLine>, rules = false) =>
    change((d) => ({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch, edited: true } : l)) }), rules);
  const removeLine = (id: string) => change((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== id) }), true);

  const panelCount = panelCountOf(draft.lines);
  const kwp = kwpOf(catalog, draft.lines);
  const panelLines = draft.lines.filter((l) => l.productKind === "panel");
  const panelWp = panelLines.length === 1 ? specsOf(catalog, panelLines[0]).wp : undefined;
  const need = inverterNeed(catalog, draft);
  const suggestion = need ? suggestInverter(catalog, need) : null;
  const inverterLine = draft.lines.find((l) => l.productKind === "inverter");

  const commitPanels = (n: number) => {
    if (!Number.isInteger(n) || n < 0) return toast.error("Panelantall må være et helt tall.");
    if (panelLines.length > 1) return toast.info("Flere paneltyper: juster antall på hver panellinje.");
    change((d) => setPanelCount(catalog, d, n), true);
  };
  const commitKwp = (value: number) => {
    if (!panelWp) return toast.info("Velg én paneltype med effekt (Wp) for å regne om fra kWp.");
    if (!(value > 0)) return toast.error("Oppgi kWp større enn 0.");
    // Rund opp, så anlegget minst får ønsket effekt
    commitPanels(Math.ceil((value * 1000) / panelWp - 1e-9));
  };

  const pricedRoofs = catalog.mountRates.filter((m) => m.priceOre != null);
  const isPrivate = draft.customerType === "private";
  const t = result?.totals;
  const resultLine = (id: string) => result?.lines.find((l) => l.id === id);
  /** Linjens andel av kundeprisen (inkl. kommisjon, og mva. for privat) */
  const customerShare = (sale: number) =>
    t && t.subtotal > 0 ? Math.round((sale / t.subtotal) * (isPrivate ? t.totalIncVat : t.totalExVat)) : 0;
  /**
   * Motsatt vei: ønsket kundepris for en linje → salgsbeløp før Soleklart (eks. mva.).
   * Bruker dagens forhold mellom kundepris og sum. Eksakt med prosentkommisjon;
   * ved fast kronebeløp i kommisjon kan resultatet avvike med noen kroner.
   */
  const saleFromCustomer = (customerOre: number) => {
    if (!t || t.subtotal <= 0) return null;
    const ratio = (isPrivate ? t.totalIncVat : t.totalExVat) / t.subtotal;
    return ratio > 0 ? Math.round(customerOre / ratio) : null;
  };

  // --- Lagring ---
  const saveDraft = async () => {
    setSaving(true);
    try {
      if (onSave) {
        if (result) await onSave(fullDraft, result);
        return;
      }
      if (!draft.projectName.trim()) throw new Error("Gi utkastet et navn (Prosjektnavn) før du lagrer.");
      const res = saved
        ? await updateCalculation(saved.calculationId, { lockVersion: saved.lockVersion, draft: fullDraft })
        : await createCalculation({ installerGroupId: catalog.installer.id, leadId, draft: fullDraft });
      setSaved({ calculationId: res.id, lockVersion: res.lockVersion, savedAt: new Date() });
      setDirty(false);
      toast.success(`Utkast «${draft.projectName}» lagret. Du finner det under «Utkast».`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openDraft = async (summary: CalcDraftSummary) => {
    try {
      const calc = await getCalculation(summary.id);
      setDraft(normalizeDraft(catalog, calc.draft));
      setSaved({ calculationId: calc.id, lockVersion: calc.lockVersion, savedAt: new Date(summary.updatedAt) });
      setDirty(false);
      setNotice(`Åpnet utkast «${summary.title}». Prisene er slik de ble lagret. Trykk «Oppdater priser» for å hente gjeldende katalogpriser.`);
      setDialog(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const status = saved ? (dirty ? "Utkast · ulagrede endringer" : `Utkast lagret ${saved.savedAt.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}`) : "Ikke lagret";

  return (
    <div className={`${s.container} ${fullWidth ? s.full : ""}`}>
      <div className={s.pagehead}>
        <div>
          <h1>Prisberegning</h1>
          <p>
            {catalog.installer.name} · <span className={s.muted}>{onSave ? "Nytt estimat" : status}</span>
          </p>
        </div>
        <div className={s.actions}>
          {!onSave && (
            <button className={s.btn} onClick={() => setDialog({ type: "drafts" })}>
              Utkast
            </button>
          )}
          <button className={s.btn} onClick={() => setDialog({ type: "new" })}>
            Ny kalkyle
          </button>
          {!onSave && saved && (
            <button
              className={s.btn}
              title="Henter gjeldende katalogpriser og påslag på linjer du ikke har justert"
              onClick={() => {
                const r = refreshPrices(catalog, draft);
                setDraft(r.draft);
                setDirty(true);
                toast.info(r.changed ? `${r.changed} linjer oppdatert til gjeldende priser.` : "Prisene er allerede gjeldende.");
              }}
            >
              Oppdater priser
            </button>
          )}
          <button
            className={`${s.btn} ${s.primary}`}
            disabled={saving || (onSave ? !result?.ready : false)}
            title={onSave ? "Serveren regner på nytt og lagrer en låst versjon" : "Lagrer kalkylen som utkast for installatøren"}
            onClick={saveDraft}
          >
            {saving ? "Lagrer …" : (saveLabel ?? "Lagre utkast")}
          </button>
        </div>
      </div>

      {notice && (
        <div className={`${s.notice} ${s.info} ${s.dismiss}`}>
          <span>{notice}</span>
          <button className={`${s.btn} ${s.ghost}`} onClick={() => setNotice(null)} aria-label="Lukk melding">
            Lukk
          </button>
        </div>
      )}

      <div className={s.layout}>
        <div>
          <div className={s.panel}>
            <div className={s.panelhead}>
              <h2>Anleggsgrunnlag</h2>
            </div>
            <div className={s.panelbody}>
              <div className={s.fields}>
                <label>
                  Prosjektnavn
                  <input className={s.input} value={draft.projectName} onChange={(e) => update({ projectName: e.target.value })} />
                </label>
                <label>
                  Kundetype
                  <select
                    className={s.input}
                    value={draft.customerType}
                    onChange={(e) => {
                      const customerType = e.target.value as QuoteDraft["customerType"];
                      // Automatisk privatstøtte følger ikke med til næring; næring starter uten støtte
                      update({ customerType, support: { mode: customerType === "private" ? "auto" : "off", amount: "0", provider: "" } });
                    }}
                  >
                    <option value="private">Privatkunde · priser inkl. mva.</option>
                    <option value="business">Næringskunde · priser eks. mva.</option>
                  </select>
                </label>
                <label>
                  Taktype
                  <select className={s.input} value={draft.roofTypeId} onChange={(e) => update({ roofTypeId: e.target.value })}>
                    {pricedRoofs.map((m) => (
                      <option key={m.roofTypeId} value={m.roofTypeId}>{m.roofTypeName}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>
                    Strømnett <Help text="Velger hvilke invertere som passer. 230 V = IT/TT, 400 V = TN." />
                  </span>
                  <select className={s.input} value={draft.grid} onChange={(e) => update({ grid: e.target.value as QuoteDraft["grid"] }, true)}>
                    <option value="230">230 V (IT/TT)</option>
                    <option value="400">400 V (TN)</option>
                  </select>
                </label>
                <label>
                  Antall paneler
                  <CommitInput key={`p${panelCount}`} value={String(panelCount)} inputMode="numeric" onCommit={(v) => commitPanels(Number(v))} />
                </label>
                <label>
                  <span>
                    Anleggseffekt (kWp) <Help text="Paneler × panelets effekt (Wp) / 1000. Skriv inn ønsket kWp, så regnes antall paneler ut (rundes opp til hele paneler)." />
                  </span>
                  <CommitInput
                    key={`k${kwp}`}
                    value={kwp == null ? "" : String(kwp).replace(".", ",")}
                    placeholder={kwp == null ? "Wp mangler" : ""}
                    inputMode="decimal"
                    onCommit={(v) => commitKwp(Number(v.replace(",", ".")))}
                  />
                </label>
              </div>
              {need && (
                <div className={s.inverterinfo}>
                  <strong>Inverter:</strong> {fmt(need.kwp)} kWp ÷ {fmt(catalog.settings.inverterSizingFactor)} ={" "}
                  <strong>{fmt(need.targetKw)} kW</strong> måleffekt · {need.grid} V. Forslag (rimeligste egnede stringinverter):{" "}
                  <strong>{suggestion?.name ?? "ingen kompatibel modell"}</strong>
                  {inverterLine && draft.inverterMode === "manual" && (
                    <>
                      {" "}· <span className={`${s.pill} ${s.manual}`}>manuelt valgt</span>{" "}
                      {suggestion && suggestion.id !== inverterLine.sourceId && (
                        <button className={s.linkbtn} onClick={() => update({ inverterMode: "auto" }, true)}>
                          Bruk forslaget
                        </button>
                      )}
                    </>
                  )}
                  <div className={`${s.small} ${s.muted}`}>
                    Grunnpakken bruker vanlig stringinverter. Hybrid velges manuelt her, eller tilbys som tillegg i batteridelen.
                  </div>
                </div>
              )}
            </div>
          </div>

          {GROUPS.map((g) => {
            const lines = draft.lines.filter((l) => l.kind === g.kind);
            const groupSum = result?.lines.filter((l) => l.kind === g.kind).reduce((sum, l) => sum + l.sale, 0);
            return (
              <section key={g.kind} className={s.panel}>
                <div className={s.panelhead}>
                  <div>
                    <h2>{g.title}</h2>
                    <span className={`${s.small} ${s.muted}`}>{g.desc}</span>
                  </div>
                  <span className={s.step}>{lines.length} poster</span>
                </div>
                {lines.length ? (
                  <div className={s.tablewrap}>
                    <table className={s.pricing}>
                      <thead>
                        <tr>
                          <th>Post</th>
                          <th className={s.num}>Mengde</th>
                          <th className={s.num} title="Innkjøpspris eller avtalt sats per enhet, eks. mva.">Grunnlag/enhet<br /><span className={s.thsub}>eks. mva.</span></th>
                          <th className={s.num}>Påslag</th>
                          <th className={s.num} title="Grunnlag + påslag, før Soleklart-kommisjon. Internt tall.">Sum<br /><span className={s.thsub}>eks. mva., før Soleklart</span></th>
                          <th className={s.num} title="Linjens andel av kundeprisen, inkl. kommisjon">Kundepris<br /><span className={s.thsub}>{isPrivate ? "inkl. mva." : "eks. mva."}</span></th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l) => (
                          <LineRow
                            key={l.id}
                            line={l}
                            catalog={catalog}
                            draft={draft}
                            sale={resultLine(l.id)?.sale}
                            customer={resultLine(l.id) ? customerShare(resultLine(l.id)!.sale) : undefined}
                            isAuto={l.productKind === "inverter" && draft.inverterMode === "auto"}
                            editable={editableTotals}
                            saleFromCustomer={saleFromCustomer}
                            onChange={(patch) => updateLine(l.id, patch, l.productKind === "panel")}
                            onSwap={(p) =>
                              change(
                                (d) => ({
                                  ...d,
                                  inverterMode: l.productKind === "inverter" ? "manual" : d.inverterMode,
                                  lines: d.lines.map((x) => (x.id === l.id ? swapProduct(catalog, x, p) : x)),
                                }),
                                true,
                              )
                            }
                            onDetails={() => setDialog({ type: "edit", id: l.id })}
                            onRemove={() => removeLine(l.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={s.empty}>Ingen poster lagt til</div>
                )}
                <div className={s.footerbar}>
                  <button className={s.btn} onClick={() => setDialog({ type: "add", kind: g.kind })}>
                    + {g.add}
                  </button>
                  <span className={`${s.small} ${s.muted}`}>{groupSum != null && `Sum ${money(groupSum, 2)} eks. mva., før Soleklart`}</span>
                </div>
              </section>
            );
          })}

          {error && <div className={`${s.notice} ${s.error}`} role="alert">{error}</div>}
          {result?.warnings.map((w) => (
            <div key={w.code + w.message} className={`${s.notice} ${w.blocking ? s.error : ""}`}>{w.message}</div>
          ))}
        </div>

        <aside className={s.side}>
          <Summary
            result={result}
            isPrivate={isPrivate}
            vatPercent={Number(draft.vatPercent.replace(",", ".")) || 0}
            agreed={draft.commission.mode === "total"}
            onAgreedExVat={(ore) => update({ commission: { mode: "total", value: (ore / 100).toFixed(2) } })}
            onResetAgreed={() => update({ commission: { mode: "auto", value: "" } })}
            onPreview={() => setDialog({ type: "preview" })}
          />
          <SupportCard draft={draft} result={result} catalog={catalog} onChange={(support) => update({ support })} />
          <ModeCard
            title="Soleklart-kommisjon"
            value={draft.commission}
            modes={[["auto", "Automatisk sats (trinn)"], ["percent", "Manuell prosent"], ["amount", "Fast kronebeløp"], ["total", "Avtalt sluttsum"]]}
            onChange={(commission) => update({ commission })}
            current={result ? { percent: result.commission.percent, amount: result.commission.amount, total: result.totals.totalExVat } : null}
            detail={result ? `${result.commission.percent === null ? "Fast beløp" : `${result.commission.percent} % av ${money(result.commission.base)}`} = ${money(result.commission.amount, 2)} eks. mva.` : ""}
          />
          <ModeCard
            title="Volumreduksjon"
            value={draft.reduction}
            modes={[["auto", "Installatørens trinn"], ["percent", "Manuell prosent"], ["amount", "Fast kronebeløp"]]}
            onChange={(reduction) => update({ reduction })}
            current={result ? { percent: result.reduction.percent, amount: result.reduction.amount } : null}
            detail={result ? `${result.reduction.percent === null ? "Fast reduksjon" : `${result.reduction.percent} %`} = ${money(result.reduction.amount, 2)} trukket fra montering før påslag` : ""}
          />
          <div className={s.panel}>
            <div className={s.panelhead}>
              <h2>Mva.</h2>
            </div>
            <div className={s.panelbody}>
              <label className={s.inlinefield}>
                Mva.-sats %
                <input className={`${s.input} ${s.percent}`} inputMode="decimal" value={draft.vatPercent} onChange={(e) => update({ vatPercent: e.target.value })} />
              </label>
              <p className={`${s.small} ${s.muted}`}>
                Mva. beregnes alltid. For næring vises bare prisene eks. mva.
              </p>
            </div>
          </div>
          <div className={s.sidenote}>
            «Til installatør etter materiell og Soleklart» skal dekke arbeid, øvrige kostnader og fortjeneste. Arbeidsgrunnlaget er avtalte priser, ikke dokumenterte interne kostnader.
          </div>
        </aside>
      </div>

      {dialog?.type === "add" && (
        <AddLineDialog
          catalog={catalog}
          kind={dialog.kind}
          panelCount={panelCount}
          onAdd={(line) => {
            change(
              (d) => ({ ...d, inverterMode: line.productKind === "inverter" ? "manual" : d.inverterMode, lines: [...d.lines, line] }),
              line.productKind === "batteri" || line.productKind === "panel" || line.productKind === "inverter",
            );
            setDialog(null);
            if (line.markupPercent === "") toast.warn("Denne kategorien mangler avtalt påslag. Fyll inn påslaget på linjen.");
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "edit" && (
        <EditLineDialog
          line={draft.lines.find((l) => l.id === dialog.id)!}
          currentSale={resultLine(dialog.id)?.sale}
          onSave={(patch) => {
            updateLine(dialog.id, patch);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "new" && (
        <NewQuoteDialog
          onCreate={(scenario, panels) => {
            setDraft(newDraft(catalog, scenario, panels, draft.roofTypeId));
            setSaved(null);
            setDirty(false);
            setNotice(null);
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "drafts" && <DraftsDialog catalog={catalog} currentId={saved?.calculationId} onOpen={openDraft} onClose={() => setDialog(null)} />}
      {dialog?.type === "preview" && result && (
        <Dialog title={`Tilbudsgrunnlag · ${draft.projectName}`} onClose={() => setDialog(null)}>
          <p className={`${s.small} ${s.muted}`}>
            {catalog.installer.name} · {isPrivate ? "Privatkunde" : "Næringskunde"} · forhåndsvisning
          </p>
          <div className={s.snapshotlines}>
            <table>
              <thead>
                <tr>
                  <th>Leveranse</th>
                  <th>Mengde</th>
                </tr>
              </thead>
              <tbody>
                {result.lines.map((l) => (
                  <tr key={l.id}>
                    <td className={s.small}>{l.name}</td>
                    <td className={s.small}>{l.quantity} {l.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={s.totalsbox}>
            Pris eks. mva.: <strong>{money(result.totals.totalExVat, 2)}</strong>
            <br />
            Mva.: {money(result.totals.vat, 2)}
            <br />
            Pris inkl. mva.: <strong>{money(result.totals.totalIncVat, 2)}</strong>
            {result.totals.support > 0 && (
              <>
                <br />
                Forventet støtte{result.support.provider ? ` (${result.support.provider})` : ""}: {money(result.totals.support, 2)}
                <br />
                Anslått kostnad etter støtte: {money(isPrivate ? result.totals.afterSupport : result.totals.totalExVat - result.totals.support, 2)}
              </>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}

// --- Produktlinje ---

function LineRow({
  line: l,
  catalog,
  draft,
  sale,
  customer,
  isAuto,
  editable = false,
  saleFromCustomer,
  onChange,
  onSwap,
  onDetails,
  onRemove,
}: {
  line: QuoteLine;
  catalog: CalcCatalog;
  draft: QuoteDraft;
  sale?: number;
  customer?: number;
  isAuto: boolean;
  editable?: boolean;
  saleFromCustomer?: (customerOre: number) => number | null;
  onChange: (patch: Partial<QuoteLine>) => void;
  onSwap: (product: CalcProduct) => void;
  onDetails: () => void;
  onRemove: () => void;
}) {
  const isInverter = l.productKind === "inverter";
  const alternatives = l.kind === "product" && !isInverter ? alternativesFor(catalog, l) : [];
  const [picking, setPicking] = useState(false);
  const current = isInverter ? catalog.products.find((p) => p.id === l.sourceId) : undefined;

  /** Fast salgsbeløp for linjen (kr eks. mva., før Soleklart) */
  const setFixedSale = (saleOre: number) => onChange({ priceMode: "fixed", fixedSale: String(Math.max(0, saleOre) / 100) });
  /** Grunnlag eller påslag endret: et overstyrt beløp skal da regnes automatisk igjen */
  const priceInput = (patch: Partial<QuoteLine>) =>
    onChange(editable && l.priceMode === "fixed" ? { ...patch, priceMode: "auto" } : patch);

  return (
    <tr>
      <td>
        {isInverter ? (
          <button
            type="button"
            className={`${s.input} ${s.productselect} ${s.pickbtn}`}
            title="Velg inverter fra katalogen (søk, gruppert etter leverandør og type)"
            onClick={() => setPicking(true)}
          >
            {current ? `${current.name} · ${current.specs.acKw ?? "?"} kW${current.specs.hybrid ? " hybrid" : ""}` : l.name || "Velg inverter"} ▾
          </button>
        ) : alternatives.length > 1 ? (
          <select
            className={`${s.input} ${s.productselect}`}
            value={l.sourceId}
            aria-label={`Bytt produkt for ${l.name}`}
            title="Bytt til et annet produkt i samme kategori"
            onChange={(e) => {
              const p = alternatives.find((x) => x.id === e.target.value);
              if (p) onSwap(p);
            }}
          >
            {alternatives.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : editable ? (
          <input
            className={`${s.input} ${s.productselect}`}
            aria-label="Navn på post"
            value={l.name}
            placeholder="Uten navn"
            onChange={(e) => onChange({ name: e.target.value })}
          />
        ) : (
          <div className={s.productname}>{l.name || "Uten navn"}</div>
        )}
        <div className={s.productmeta}>
          {l.detail} · per {l.unit}
          {isInverter && <span className={`${s.pill} ${isAuto ? "" : s.manual}`}>{isAuto ? "automatisk forslag" : "manuelt valgt"}</span>}
          {l.priceMode === "fixed" &&
            (editable ? (
              <button
                type="button"
                className={`${s.pill} ${s.manual} ${s.pillbtn}`}
                title="Klikk for å regne beløpet automatisk igjen (grunnlag + påslag)"
                onClick={() => onChange({ priceMode: "auto" })}
              >
                fast salgsbeløp ✕
              </button>
            ) : (
              <span className={`${s.pill} ${s.manual}`}>fast salgsbeløp</span>
            ))}
          {l.edited && <span className={`${s.pill} ${s.manual}`}>justert</span>}
        </div>
        {picking && (
          <InverterPicker
            catalog={catalog}
            need={inverterNeed(catalog, draft)}
            grid={draft.grid}
            currentId={l.sourceId}
            onPick={(p) => {
              setPicking(false);
              if (p.id !== l.sourceId) onSwap(p);
            }}
            onClose={() => setPicking(false)}
          />
        )}
      </td>
      <td className={s.num}>
        <input className={`${s.input} ${s.quantity}`} inputMode="decimal" aria-label={`Mengde ${l.name}`} value={l.quantity} onChange={(e) => onChange({ quantity: e.target.value })} />
      </td>
      <td className={s.num}>
        <input className={`${s.input} ${s.money}`} inputMode="decimal" aria-label={`Grunnlag ${l.name}`} value={l.baseUnit} onChange={(e) => priceInput({ baseUnit: e.target.value })} />
      </td>
      <td className={s.num}>
        <span className={s.inputwrap}>
          <input className={`${s.input} ${s.percent}`} inputMode="decimal" aria-label={`Påslag ${l.name}`} value={l.markupPercent} onChange={(e) => priceInput({ markupPercent: e.target.value })} />
          <span className={s.suffix}>%</span>
        </span>
      </td>
      {editable ? (
        <>
          <td className={s.num}>
            <MoneyCommit
              ore={sale}
              label={`Sum ${l.name}`}
              title="Skriv inn ønsket sum eks. mva. før Soleklart. Linjen får da fast salgsbeløp."
              onCommit={setFixedSale}
            />
          </td>
          <td className={s.num}>
            <MoneyCommit
              ore={customer}
              label={`Kundepris ${l.name}`}
              title="Skriv inn ønsket kundepris for linjen. Sum regnes tilbake og linjen får fast salgsbeløp."
              onCommit={(ore) => {
                const target = saleFromCustomer?.(ore);
                if (target == null) return toast.info("Kundeprisen kan ikke regnes tilbake før kalkylen har en sum.");
                setFixedSale(target);
              }}
            />
          </td>
        </>
      ) : (
        <>
          <td className={`${s.num} ${s.computed}`}>{sale == null ? "—" : money(sale)}</td>
          <td className={`${s.num} ${s.computed}`}>{customer == null ? "—" : money(customer)}</td>
        </>
      )}
      <td className={s.rowactions2}>
        <button className={`${s.btn} ${s.small2}`} onClick={onDetails} title="Endre navn, enhet, fast salgsbeløp, støttegrunnlag">
          Detaljer
        </button>
        <button className={`${s.btn} ${s.small2} ${s.danger}`} onClick={onRemove} aria-label={`Fjern ${l.name}`}>
          Fjern
        </button>
      </td>
    </tr>
  );
}

/** Beløp i øre vist som hele kroner. Lagres når feltet forlates eller Enter trykkes. */
function MoneyCommit({ ore, onCommit, label, title }: { ore?: number; onCommit: (ore: number) => void; label: string; title?: string }) {
  const shown = ore == null ? "" : String(Math.round(ore / 100));
  const [text, setText] = useState(shown);
  const [focused, setFocused] = useState(false);
  const commit = () => {
    setFocused(false);
    const kr = Number(text.replace(/\s/g, "").replace(",", "."));
    if (text.trim() === "" || !Number.isFinite(kr) || kr < 0) return setText(shown);
    if (String(Math.round(kr)) !== shown) onCommit(Math.round(kr * 100));
  };
  return (
    <span className={s.inputwrap}>
      <input
        className={`${s.input} ${s.editnum}`}
        inputMode="decimal"
        aria-label={label}
        title={title}
        value={focused ? text : ore == null ? "—" : new Intl.NumberFormat("nb-NO").format(Math.round(ore / 100))}
        onFocus={() => {
          setText(shown);
          setFocused(true);
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <span className={s.suffix}>kr</span>
    </span>
  );
}

function CommitInput({ value, onCommit, placeholder, inputMode }: { value: string; onCommit: (v: string) => void; placeholder?: string; inputMode: "numeric" | "decimal" }) {
  const [text, setText] = useState(value);
  return (
    <input
      className={s.input}
      inputMode={inputMode}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onCommit(text)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Stort beløpsfelt for kundens sluttsum. Lagres ved Enter eller når feltet forlates. */
function SumField({ label, ore, onCommit }: { label: string; ore?: number; onCommit: (ore: number) => void }) {
  const shown = ore == null ? "" : (ore / 100).toFixed(0);
  const [text, setText] = useState(shown);
  const [focused, setFocused] = useState(false);
  const commit = () => {
    setFocused(false);
    const kr = Number(text.replace(/\s/g, "").replace(",", "."));
    if (text.trim() === "" || !Number.isFinite(kr) || kr <= 0) return;
    if (Math.round(kr) !== Math.round((ore ?? 0) / 100)) onCommit(Math.round(kr * 100));
  };
  return (
    <label className={s.sumfield}>
      <span className={`${s.small} ${s.summarymuted}`}>{label}</span>
      <span className={s.sumwrap}>
        <input
          inputMode="decimal"
          aria-label={label}
          value={focused ? text : ore == null ? "—" : new Intl.NumberFormat("nb-NO").format(Math.round(ore / 100))}
          onFocus={() => {
            setText(shown);
            setFocused(true);
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <span>kr</span>
      </span>
    </label>
  );
}

/** Manuelt valg av inverter: søkbar liste gruppert etter leverandør og type. */
function InverterPicker({
  catalog,
  need,
  grid,
  currentId,
  onPick,
  onClose,
}: {
  catalog: CalcCatalog;
  need: InverterNeed | null;
  grid: Grid;
  currentId?: string;
  onPick: (p: CalcProduct) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyFitting, setOnlyFitting] = useState(true);
  const groups = inverterGroups(catalog, need, grid, query)
    .map((g) => ({ ...g, items: onlyFitting ? g.items.filter((i) => i.fits || i.product.id === currentId) : g.items }))
    .filter((g) => g.items.length);
  return (
    <Dialog title="Velg inverter" onClose={onClose}>
      <p className={`${s.small} ${s.muted}`}>
        {need
          ? `Anlegget: ${fmt(need.kwp)} kWp, ${grid} V, måleffekt ${fmt(need.targetKw)} kW. Egnede vises først, deretter laveste innkjøpspris.`
          : `${grid} V. Legg inn paneler for å se hvilke størrelser som passer.`}
      </p>
      <div className={s.toolbar}>
        <input className={s.input} autoFocus placeholder="Søk: navn, leverandør, kW, hybrid …" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className={s.check}>
          <input type="checkbox" checked={onlyFitting} onChange={(e) => setOnlyFitting(e.target.checked)} /> Bare de som passer {grid} V
        </label>
      </div>
      <div className={s.list}>
        {groups.map((g) => (
          <div key={g.label}>
            <div className={s.grouphead}>{g.label}</div>
            {g.items.map(({ product: p, fits, sized }) => (
              <button
                key={p.id}
                className={`${s.btn} ${p.id === currentId ? s.selected : ""}`}
                onClick={() => onPick(p)}
                title={!fits ? `Passer ikke ${grid} V eller anleggets PV-effekt` : !sized ? "Under anbefalt måleffekt" : "Velg"}
              >
                <span>
                  <strong>{p.name}</strong>
                  <br />
                  <span className={`${s.small} ${s.muted}`}>
                    {p.specs.acKw ?? "?"} kW AC
                    {p.specs.maxPvKwp ? ` · maks ${fmt(p.specs.maxPvKwp)} kWp PV` : ""}
                    {p.specs.grid ? ` · ${p.specs.grid === "begge" ? "230/400" : p.specs.grid} V` : " · nett mangler"}
                    {p.specs.phases === 1 ? " · 1-fase" : ""}
                    {!fits ? " · passer ikke" : !sized ? " · under måleffekt" : ""}
                    {p.id === currentId ? " · valgt nå" : ""}
                  </span>
                </span>
                <span className={s.price}>{money(p.priceOre)}</span>
              </button>
            ))}
          </div>
        ))}
        {!groups.length && <div className={s.empty}>Ingen treff</div>}
      </div>
    </Dialog>
  );
}

// --- Sidekolonne ---

function Summary({
  result,
  isPrivate,
  vatPercent,
  agreed,
  onAgreedExVat,
  onResetAgreed,
  onPreview,
}: {
  result: CalcResult | null;
  isPrivate: boolean;
  vatPercent: number;
  agreed: boolean;
  onAgreedExVat: (ore: number) => void;
  onResetAgreed: () => void;
  onPreview: () => void;
}) {
  const t = result?.totals;
  const supportAmount = t?.support ?? 0;
  const afterSupport = t ? (isPrivate ? t.afterSupport : t.totalExVat - supportAmount) : 0;
  const exField = (
    <SumField
      key="ex"
      label="Kundens sluttsum eks. mva."
      ore={t?.totalExVat}
      onCommit={onAgreedExVat}
    />
  );
  const incField = (
    <SumField
      key="inc"
      label="Kundens sluttsum inkl. mva."
      ore={t?.totalIncVat}
      onCommit={(inc) => onAgreedExVat(Math.round(inc / (1 + vatPercent / 100)))}
    />
  );
  return (
    <div className={s.summary}>
      {t ? (
        <div className={s.sumfields}>{isPrivate ? [incField, exField] : [exField, incField]}</div>
      ) : (
        <div className={s.total}>Må avklares</div>
      )}
      <div className={`${s.small} ${s.summarymuted}`}>
        {!t
          ? "Rett verdien før kalkylen kan lagres"
          : agreed
            ? (
              <>
                Avtalt sluttsum: Soleklart-kommisjonen justeres så summen stemmer.{" "}
                <button type="button" className={s.summarylink} onClick={onResetAgreed}>Tilbakestill til automatisk</button>
              </>
            )
            : "Skriv inn ny sluttsum (eks. eller inkl. mva.) for å avtale prisen. Differansen tas på Soleklart-kommisjonen."}
      </div>
      {t && result && (
        <dl>
          <div><dt>Sum før Soleklart (eks. mva.)</dt><dd>{money(t.subtotal)}</dd></div>
          <div><dt>Soleklart-kommisjon (eks. mva.)</dt><dd>{money(result.commission.amount)}</dd></div>
          <div><dt>Mva.</dt><dd>{money(t.vat)}</dd></div>
          {supportAmount > 0 && (
            <>
              <div><dt>Forventet støtte{result.support.provider ? ` (${result.support.provider})` : ""}</dt><dd>−{money(supportAmount)}</dd></div>
              <div className={s.strong}><dt>Anslått kostnad etter støtte {isPrivate ? "inkl." : "eks."} mva.</dt><dd>{money(afterSupport)}</dd></div>
            </>
          )}
          <div><dt>Til installatør etter materiell og Soleklart</dt><dd>{money(t.installerRemaining)}</dd></div>
        </dl>
      )}
      <button disabled={!result} onClick={onPreview}>
        Se tilbudsgrunnlag
      </button>
    </div>
  );
}

function SupportCard({ draft, result, catalog, onChange }: { draft: QuoteDraft; result: CalcResult | null; catalog: CalcCatalog; onChange: (s: QuoteDraft["support"]) => void }) {
  const sup = draft.support;
  const r = result?.support;
  const isPrivate = draft.customerType === "private";
  const set = (patch: Partial<QuoteDraft["support"]>) => onChange({ ...sup, ...patch });
  const st = catalog.settings;

  return (
    <div className={s.panel}>
      <div className={s.panelhead}>
        <h2>Støtte</h2>
        <span className={`${s.small} ${s.muted}`}>anslag, ikke innvilget</span>
      </div>
      <div className={s.panelbody}>
        <label>
          Beregning
          <select className={s.input} value={sup.mode} onChange={(e) => set({ mode: e.target.value as QuoteDraft["support"]["mode"] })}>
            {isPrivate && <option value="auto">Automatisk ({st.supportName})</option>}
            <option value="off">Ingen støtte</option>
            <option value="manual">Manuelt anslag</option>
          </select>
        </label>

        {sup.mode === "auto" && isPrivate && r?.mode === "auto" && (
          <div className={s.supportcalc}>
            <div><span>Støtteberettiget kostnad inkl. mva.</span><span>{money(r.eligibleBaseIncVat ?? 0)}</span></div>
            <div><span>{fmt(st.supportPercent)} % av kostnaden</span><span>{money(r.byPercent ?? 0)}</span></div>
            <div><span>{fmt(Math.min(r.kwp ?? 0, st.supportMaxKwp))} kWp × {money(st.supportPerKwpOre)}</span><span>{money(r.byKwp ?? 0)}</span></div>
            <div><span>Maks støtte</span><span>{money(r.cap ?? 0)}</span></div>
            <div className={s.strong}><span>Forventet støtte (laveste)</span><span>{money(r.amount)}</span></div>
          </div>
        )}
        {sup.mode === "auto" && isPrivate && !st.supportEnabled && (
          <p className={`${s.small} ${s.muted}`}>Automatisk støtte er slått av under Beregningsregler.</p>
        )}

        {sup.mode === "manual" && (
          <div className={`${s.fields} ${s.two}`}>
            <label>
              Anslått støtte, kr
              <input className={s.input} inputMode="decimal" value={sup.amount} onChange={(e) => set({ amount: e.target.value })} />
            </label>
            <label>
              Støttegiver / ordning
              <input className={s.input} placeholder="F.eks. Enova, Innovasjon Norge" value={sup.provider} onChange={(e) => set({ provider: e.target.value })} />
            </label>
          </div>
        )}
        <p className={`${s.small} ${s.muted}`}>
          {isPrivate
            ? `Privatkunder får forventet ${st.supportName}-støtte beregnet automatisk ut fra faktisk kWp og solcellekostnadene (batteri er ikke med). `
            : "Næringskunder har normalt ingen støtte. Legg inn et manuelt anslag hvis det er aktuelt. "}
          Støtten endrer ikke fakturapris, mva. eller kommisjon.
        </p>
      </div>
    </div>
  );
}

function ModeCard({
  title,
  value,
  modes,
  onChange,
  current,
  detail,
}: {
  title: string;
  value: Adjustment;
  modes: [Adjustment["mode"], string][];
  onChange: (a: Adjustment) => void;
  current: { percent: number | null; amount: number; total?: number } | null;
  detail: string;
}) {
  return (
    <div className={s.panel}>
      <div className={s.panelhead}>
        <h2>{title}</h2>
      </div>
      <div className={s.panelbody}>
        <div className={`${s.fields} ${s.two}`}>
          <label className={value.mode === "auto" ? s.wide : ""}>
            Beregningsmåte
            <select
              className={s.input}
              value={value.mode}
              onChange={(e) => {
                const mode = e.target.value as Adjustment["mode"];
                const start =
                  mode === "amount"
                    ? String((current?.amount ?? 0) / 100)
                    : mode === "percent"
                      ? String(current?.percent ?? 0)
                      : mode === "total"
                        ? ((current?.total ?? 0) / 100).toFixed(2)
                        : "";
                onChange({ mode, value: start });
              }}
            >
              {modes.map(([m, label]) => (
                <option key={m} value={m}>{label}</option>
              ))}
            </select>
          </label>
          {value.mode !== "auto" && (
            <label>
              {value.mode === "amount" ? "Beløp eks. mva., kr" : value.mode === "total" ? "Sluttsum eks. mva., kr" : "Prosent"}
              <input className={s.input} inputMode="decimal" value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value })} />
            </label>
          )}
        </div>
        <div className={`${s.small} ${s.muted}`} style={{ marginTop: 10 }}>{detail}</div>
      </div>
    </div>
  );
}

// --- Dialoger ---

function DraftsDialog({ catalog, currentId, onOpen, onClose }: { catalog: CalcCatalog; currentId?: string; onOpen: (d: CalcDraftSummary) => void; onClose: () => void }) {
  const [list, setList] = useState<CalcDraftSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    listCalculations(catalog.installer.id).then(setList).catch((e: Error) => setError(e.message));
  }, [catalog.installer.id]);
  const when = (d: string) => new Date(d).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });

  return (
    <Dialog title={`Utkast · ${catalog.installer.name}`} onClose={onClose}>
      <p className={`${s.small} ${s.muted}`}>
        Utkast lagres per installatør. Alle med tilgang til {catalog.installer.name} ser og kan åpne dem. Åpning henter verdiene slik de ble lagret.
      </p>
      {error && <div className={`${s.notice} ${s.error}`}>{error}</div>}
      {!list && !error && <div className={s.empty}>Laster …</div>}
      {list && !list.length && <div className={s.empty}>Ingen lagrede utkast ennå. Trykk «Lagre utkast» i kalkulatoren.</div>}
      {list && list.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Navn</th>
              <th>Sist endret</th>
              <th>Opprettet av</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id}>
                <td>
                  <strong className={s.productname}>{d.title}</strong>
                  <div className={s.productmeta}>
                    {d.customerType === "private" ? "Privat" : "Næring"}
                    {d.leadId ? " · fra lead" : ""}
                    {d.latestVersion ? ` · låst versjon ${d.latestVersion}` : ""}
                  </div>
                </td>
                <td className={s.small}>
                  {when(d.updatedAt)}
                  {d.updatedByName && <div className={s.muted}>{d.updatedByName}</div>}
                </td>
                <td className={s.small}>{d.createdByName ?? "—"}</td>
                <td className={s.num}>
                  <button className={`${s.btn} ${d.id === currentId ? "" : s.primary}`} disabled={d.id === currentId} onClick={() => onOpen(d)}>
                    {d.id === currentId ? "Åpen" : "Åpne"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  );
}

function AddLineDialog({
  catalog,
  kind,
  panelCount,
  onAdd,
  onClose,
}: {
  catalog: CalcCatalog;
  kind: LineKind;
  panelCount: number;
  onAdd: (line: QuoteLine) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const q = query.toLowerCase();
  const title = kind === "product" ? "Legg til produkt" : kind === "mount" ? "Legg til montering" : "Legg til arbeid";
  const tops = catalog.categories.filter((c) => !c.parentId);
  const topId = (p: CalcProduct) => {
    const c = catalog.categories.find((x) => x.id === p.categoryId);
    return c?.parentId ?? c?.id;
  };

  type Item = { key: string; name: string; sub: string; price: string; pick: () => void; disabled?: boolean };
  const items: Item[] =
    kind === "product"
      ? catalog.products
          .filter((p) => p.active && (!categoryId || topId(p) === categoryId))
          .map((p) => ({
            key: p.id,
            name: p.name,
            sub: `${p.supplierName} · ${tops.find((c) => c.id === topId(p))?.name ?? ""}`,
            price: money(p.priceOre),
            pick: () => {
              const c = catalog.categories.find((x) => x.id === p.categoryId);
              onAdd(productLine(catalog, p, c?.quantityRule === "per_panel" ? Math.max(1, panelCount) : 1));
            },
          }))
      : kind === "mount"
        ? catalog.mountRates
            .filter((m) => m.priceOre != null)
            .map((m) => ({
              key: m.roofTypeId,
              name: m.roofTypeName,
              sub: m.productName ?? "Festesystem ikke valgt",
              price: `${money(m.priceOre!)} per panel`,
              pick: () => onAdd(mountLine(catalog, m, Math.max(1, panelCount))),
            }))
        : catalog.workTypes
            .filter((w) => w.active)
            .map((w) => ({
              key: w.id,
              name: w.name,
              sub: WORK_GROUP_LABELS[w.group],
              price: w.priceOre == null ? "Sats må avtales" : `${money(w.priceOre)} per ${w.unit}`,
              disabled: w.priceOre == null,
              pick: () => onAdd(workLine(catalog, w)),
            }));
  const filtered = items.filter((i) => `${i.name} ${i.sub}`.toLowerCase().includes(q));

  return (
    <Dialog title={title} onClose={onClose}>
      <div className={s.toolbar}>
        <input className={s.input} autoFocus placeholder="Søk etter navn eller leverandør" value={query} onChange={(e) => setQuery(e.target.value)} />
        {kind === "product" && (
          <select className={s.input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Kategori">
            <option value="">Alle kategorier</option>
            {tops.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className={s.list}>
        {filtered.map((i) => (
          <button key={i.key} className={s.btn} disabled={i.disabled} onClick={i.pick} title={i.disabled ? "Sett satsen under Prisavtaler først" : "Legg til i kalkylen"}>
            <span>
              <strong>{i.name}</strong>
              <br />
              <span className={`${s.small} ${s.muted}`}>{i.sub}</span>
            </span>
            <span className={s.price}>{i.price}</span>
          </button>
        ))}
        {!filtered.length && <div className={s.empty}>Ingen treff</div>}
      </div>
      <hr className={s.subtleline} />
      <button className={s.btn} onClick={() => onAdd(customLine(catalog, kind))}>
        + Egendefinert post
      </button>
    </Dialog>
  );
}

function EditLineDialog({
  line,
  currentSale,
  onSave,
  onClose,
}: {
  line: QuoteLine;
  currentSale: number | undefined;
  onSave: (patch: Partial<QuoteLine>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(line.name);
  const [unit, setUnit] = useState(line.unit);
  const [priceMode, setPriceMode] = useState(line.priceMode);
  const [fixedSale, setFixedSale] = useState(line.priceMode === "fixed" ? line.fixedSale : String((currentSale ?? 0) / 100));
  const [reductionEligible, setReductionEligible] = useState(line.reductionEligible);
  const [supportEligible, setSupportEligible] = useState<"default" | "yes" | "no">(
    line.supportEligible === undefined ? "default" : line.supportEligible ? "yes" : "no",
  );

  return (
    <Dialog
      title="Detaljer for linjen"
      onClose={onClose}
      footer={
        <button
          className={`${s.btn} ${s.primary}`}
          disabled={!name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              unit,
              priceMode,
              fixedSale,
              reductionEligible,
              supportEligible: supportEligible === "default" ? undefined : supportEligible === "yes",
            })
          }
        >
          Bruk på denne kalkylen
        </button>
      }
    >
      <div className={`${s.fields} ${s.two}`}>
        <label>
          Beskrivelse
          <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Enhet
          <input className={s.input} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </label>
        <label>
          Salgspris
          <select className={s.input} value={priceMode} onChange={(e) => setPriceMode(e.target.value as QuoteLine["priceMode"])}>
            <option value="auto">Grunnlag + påslag</option>
            <option value="fixed">Fast salgsbeløp for hele linjen</option>
          </select>
        </label>
        <label>
          Fast salgsbeløp eks. mva.
          <input className={s.input} inputMode="decimal" value={fixedSale} disabled={priceMode !== "fixed"} onChange={(e) => setFixedSale(e.target.value)} />
        </label>
        <label>
          Med i støttegrunnlag
          <select className={s.input} value={supportEligible} onChange={(e) => setSupportEligible(e.target.value as typeof supportEligible)}>
            <option value="default">Som kategorien (standard)</option>
            <option value="yes">Ja</option>
            <option value="no">Nei</option>
          </select>
        </label>
        {line.kind === "mount" && (
          <label className={s.check}>
            <input type="checkbox" checked={reductionEligible} onChange={(e) => setReductionEligible(e.target.checked)} /> Omfattes av volumreduksjon
          </label>
        )}
      </div>
      <p className={`${s.small} ${s.muted}`}>Endringene gjelder bare denne kalkylen. Fast salgsbeløp endrer ikke innkjøps- eller arbeidsgrunnlaget.</p>
    </Dialog>
  );
}

function NewQuoteDialog({ onCreate, onClose }: { onCreate: (scenario: Scenario, panels: number) => void; onClose: () => void }) {
  const [scenario, setScenario] = useState<Scenario>("solar");
  const [panels, setPanels] = useState("36");
  return (
    <Dialog
      title="Ny kalkyle"
      onClose={onClose}
      footer={
        <button
          className={`${s.btn} ${s.primary}`}
          onClick={() => {
            const n = Number(panels);
            if (scenario === "solar" && (!Number.isInteger(n) || n < 1)) return toast.error("Oppgi antall paneler");
            onCreate(scenario, n);
          }}
        >
          Opprett kalkyle
        </button>
      }
    >
      <p className={s.muted}>Gjeldende kalkyle erstattes. Lagrede utkast påvirkes ikke.</p>
      <div className={`${s.fields} ${s.two}`}>
        <label>
          Startpunkt
          <select className={s.input} value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>
            <option value="solar">Solceller · standardoppsett</option>
            <option value="battery">Batteri · tom kalkyle</option>
            <option value="other">Lader / andre tjenester · tom kalkyle</option>
          </select>
        </label>
        {scenario === "solar" && (
          <label>
            Paneler
            <input className={s.input} inputMode="numeric" value={panels} onChange={(e) => setPanels(e.target.value)} />
          </label>
        )}
      </div>
    </Dialog>
  );
}
