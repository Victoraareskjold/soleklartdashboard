"use client";

// Prisberegning (prototypens «Kalkulator»-fane). Regner via kalkulator-API-et ved hver endring.
// «Lagre tilbudsgrunnlag» lagrer en låst versjon; serveren regner på nytt fra databasen.
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  calculatePreview,
  createCalculation,
  getCalculation,
  saveQuoteVersion,
  type CalcCatalog,
  type CalcResult,
  type CalcVersionSummary,
  type LineKind,
} from "@/lib/calcApi";
import { Dialog } from "./Dialog";
import {
  customLine,
  mountLine,
  newDraft,
  panelCountOf,
  productLine,
  toEngineInput,
  workLine,
  type Adjustment,
  type QuoteDraft,
  type QuoteLine,
  type Scenario,
} from "./quote";
import { WORK_GROUP_LABELS } from "./Agreements";
import s from "./kalkulator.module.css";

const money = (ore: number, decimals = 0) =>
  `${new Intl.NumberFormat("nb-NO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(ore / 100)} kr`;

const GROUPS: { kind: LineKind; title: string; desc: string; add: string }[] = [
  { kind: "product", title: "Materiell og leveranser", desc: "Utstyr, stillas og frakt", add: "Legg til produkt" },
  { kind: "mount", title: "Montering", desc: "Pris per takflate og festesystem", add: "Legg til montering" },
  { kind: "work", title: "Arbeid og tillegg", desc: "Elektriker, søknad, kabling, grøft og annet", add: "Legg til arbeid" },
];

interface Saved {
  calculationId: string;
  lockVersion: number;
  versions: CalcVersionSummary[];
}

interface KalkulatorProps {
  catalog: CalcCatalog;
  leadId?: string | null;
  estimateId?: string | null;
  /** Fra solkartet: antall paneler og taktype (navn) å starte kalkylen med */
  initialPanels?: number;
  initialRoofName?: string;
  /** Overstyrer lagring (f.eks. «Opprett estimat» på leaden). Ellers lagres en låst versjon. */
  onSave?: (draft: QuoteDraft, result: CalcResult) => Promise<void>;
  saveLabel?: string;
}

/**
 * Installatøren bestemmes av dashboardet (catalog er hentet for den).
 * leadId/estimateId settes når kalkulatoren åpnes fra en lead; da skrives price_data til estimatet ved lagring.
 */
export default function Kalkulator({ catalog, leadId = null, estimateId = null, initialPanels, initialRoofName, onSave, saveLabel }: KalkulatorProps) {
  const startDraft = () => {
    const roofId = catalog.mountRates.find((m) => m.priceOre != null && m.roofTypeName === initialRoofName)?.roofTypeId;
    return newDraft(catalog, "solar", initialPanels && initialPanels > 0 ? initialPanels : 36, roofId);
  };
  const [draft, setDraft] = useState<QuoteDraft>(startDraft);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { type: "add"; kind: LineKind } | { type: "edit"; id: string } | { type: "new" } | { type: "preview" }>(null);

  // Ny installatør, eller nye data fra solkartet = ny kalkyle
  const startKey = `${catalog.installer.id}|${initialPanels ?? ""}|${initialRoofName ?? ""}`;
  const startRef = useRef(startKey);
  useEffect(() => {
    if (startRef.current !== startKey) {
      startRef.current = startKey;
      setDraft(startDraft());
      setSaved(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey]);

  // Regn på nytt (via API) når utkastet endres
  const input = useMemo(() => toEngineInput(catalog, draft), [catalog, draft]);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      calculatePreview(input)
        .then((r) => !cancelled && (setResult(r), setError(null)))
        .catch((e: Error) => !cancelled && (setResult(null), setError(e.message)));
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input]);

  const update = (patch: Partial<QuoteDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const updateLine = (id: string, patch: Partial<QuoteLine>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch, edited: true } : l)) }));
  const addLine = (line: QuoteLine) => setDraft((d) => ({ ...d, lines: [...d.lines, line] }));
  const removeLine = (id: string) => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.id !== id) }));

  const panelCount = panelCountOf(draft.lines);
  const setPanelCount = (text: string) => {
    const n = Number(text);
    const panels = draft.lines.filter((l) => l.productKind === "panel");
    if (!Number.isInteger(n) || n < 0) return toast.error("Oppgi et helt panelantall.");
    if (panels.length !== 1) return toast.info("Juster antall på hver panellinje når det er flere takflater eller paneltyper.");
    const prev = panels[0].quantity;
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) =>
        l.id === panels[0].id || ((l.kind === "mount" || l.productKind === "feste") && l.quantity === prev) ? { ...l, quantity: String(n) } : l,
      ),
    }));
    toast.info("Paneler og tilhørende montering er oppdatert. Kontroller inverter og frakt.");
  };

  const saveVersion = async () => {
    setSaving(true);
    try {
      if (onSave) {
        if (result) await onSave(draft, result);
        return;
      }
      let current = saved;
      if (!current) {
        const created = await createCalculation({ installerGroupId: catalog.installer.id, leadId, estimateId, draft });
        current = { calculationId: created.id, lockVersion: created.lockVersion, versions: [] };
      }
      const res = await saveQuoteVersion(current.calculationId, { lockVersion: current.lockVersion, draft }, crypto.randomUUID());
      const fresh = await getCalculation(current.calculationId);
      setSaved({ calculationId: current.calculationId, lockVersion: res.lockVersion, versions: fresh.versions ?? [] });
      toast.success(res.estimateId ? `Lagret som versjon ${res.version} og oppdatert estimatet` : `Tilbudsgrunnlag lagret som versjon ${res.version}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const pricedRoofs = catalog.mountRates.filter((m) => m.priceOre != null);
  const isPrivate = draft.customerType === "private";
  const t = result?.totals;
  const saleOf = (id: string) => result?.lines.find((l) => l.id === id)?.sale;

  return (
    <>
      <div className={s.pagehead}>
        <div>
          <h1>Prisberegning</h1>
          <p>Materiell, arbeid og kommisjon i én kalkyle.</p>
        </div>
        <div className={s.actions}>
          <button className={s.btn} onClick={() => setDialog({ type: "new" })}>
            Ny kalkyle
          </button>
          <button
            className={`${s.btn} ${s.primary}`}
            disabled={!result?.ready || saving}
            title={!result?.ready ? "Rett avvikene før kalkylen kan lagres" : "Serveren regner på nytt og lagrer en låst versjon"}
            onClick={saveVersion}
          >
            {saving ? "Lagrer …" : (saveLabel ?? "Lagre tilbudsgrunnlag")}
          </button>
        </div>
      </div>

      <div className={s.layout}>
        <div>
          <div className={s.panel}>
            <div className={s.panelhead}>
              <h2>Anleggsgrunnlag</h2>
              <span className={s.tag}>
                {catalog.installer.name} · {saved?.versions.length ? `v${saved.versions[0].version} lagret` : "utkast"}
              </span>
            </div>
            <div className={s.panelbody}>
              <div className={s.fields}>
                <label>
                  Prosjektnavn
                  <input className={s.input} value={draft.projectName} onChange={(e) => update({ projectName: e.target.value })} />
                </label>
                <label>
                  Kundetype
                  <select className={s.input} value={draft.customerType} onChange={(e) => update({ customerType: e.target.value as QuoteDraft["customerType"] })}>
                    <option value="private">Privatkunde</option>
                    <option value="business">Næringskunde</option>
                  </select>
                </label>
                <label>
                  Taktype
                  <select
                    className={s.input}
                    value={draft.roofTypeId}
                    onChange={(e) => {
                      update({ roofTypeId: e.target.value });
                      toast.info("Taktype oppdatert. Eksisterende monteringslinjer beholdes; legg til eller endre riktig takflate.");
                    }}
                  >
                    {pricedRoofs.map((m) => (
                      <option key={m.roofTypeId} value={m.roofTypeId}>{m.roofTypeName}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Paneler i kalkylen
                  <PanelCountInput value={panelCount} onCommit={setPanelCount} />
                </label>
              </div>
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
                          <th className={s.num}>Grunnlag / enhet</th>
                          <th className={s.num}>Påslag %</th>
                          <th className={s.num}>Sum eks. mva.</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((l) => {
                          const sale = saleOf(l.id);
                          return (
                            <tr key={l.id}>
                              <td>
                                <div className={s.productname}>{l.name || "Uten navn"}</div>
                                <div className={s.productmeta}>
                                  {l.detail} · {l.unit}
                                </div>
                                <div className={s.rowtools}>
                                  <button className={`${s.btn} ${s.ghost}`} onClick={() => setDialog({ type: "edit", id: l.id })}>
                                    Detaljer
                                  </button>
                                  {l.priceMode === "fixed" && <span className={`${s.pill} ${s.manual}`}>Fast salgsbeløp</span>}
                                  {l.edited && <span className={`${s.pill} ${s.manual}`}>Justert</span>}
                                </div>
                              </td>
                              <td className={s.num}>
                                <input className={`${s.input} ${s.quantity}`} inputMode="decimal" aria-label={`Mengde ${l.name}`} value={l.quantity} onChange={(e) => updateLine(l.id, { quantity: e.target.value })} />
                              </td>
                              <td className={s.num}>
                                <input className={`${s.input} ${s.money}`} inputMode="decimal" aria-label={`Grunnlag ${l.name}`} value={l.baseUnit} onChange={(e) => updateLine(l.id, { baseUnit: e.target.value })} />
                              </td>
                              <td className={s.num}>
                                <input className={`${s.input} ${s.percent}`} inputMode="decimal" aria-label={`Påslag ${l.name}`} value={l.markupPercent} onChange={(e) => updateLine(l.id, { markupPercent: e.target.value })} />
                              </td>
                              <td className={s.num}>{sale == null ? "—" : money(sale, 2)}</td>
                              <td>
                                <button className={`${s.btn} ${s.ghost} ${s.danger}`} aria-label={`Fjern ${l.name}`} onClick={() => removeLine(l.id)}>
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })}
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
                  <span className={`${s.small} ${s.muted}`}>{groupSum != null && `${money(groupSum, 2)} eks. mva.`}</span>
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
          <div className={s.summary}>
            <div className={`${s.small} ${s.summarymuted}`}>KUNDEPRIS {isPrivate ? "INKL. MVA." : "EKSKL. MVA."}</div>
            <div className={s.total}>{t ? money(isPrivate ? t.totalIncVat : t.totalExVat) : "Må avklares"}</div>
            <div className={`${s.small} ${s.summarymuted}`}>
              {t ? `${money(isPrivate ? t.totalExVat : t.totalIncVat)} ${isPrivate ? "ekskl. mva." : "inkl. mva."}` : "Rett verdien før kalkylen kan lagres"}
            </div>
            {t && result && (
              <dl>
                {[
                  ["Sum før Soleklart", t.subtotal],
                  ["Soleklart-kommisjon", result.commission.amount],
                  ["Mva.", t.vat],
                  ...(t.support ? [["Anslått støtte", -t.support], ["Kostnad etter støtte inkl. mva.", t.afterSupport]] : []),
                  ["Til installatør etter materiell og Soleklart", t.installerRemaining],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt>{label}</dt>
                    <dd>{money(value as number)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <button disabled={!result} onClick={() => setDialog({ type: "preview" })}>
              Se tilbudsgrunnlag
            </button>
          </div>

          {saved && saved.versions.length > 0 && (
            <div className={s.panel}>
              <div className={s.panelhead}>
                <h2>Lagrede versjoner</h2>
              </div>
              <table>
                <tbody>
                  {saved.versions.map((v) => (
                    <tr key={v.id}>
                      <td className={s.small}>
                        <strong>v{v.version}</strong>
                        <div className={s.muted}>{new Date(v.createdAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}</div>
                      </td>
                      <td className={s.num}>{money(isPrivate ? v.totalIncVatOre : v.totalExVatOre)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={`${s.small} ${s.muted}`} style={{ padding: "10px 16px" }}>
                Lagrede versjoner er låst. Endringer i utkastet blir en ny versjon.
              </div>
            </div>
          )}

          <ModeCard
            title="Soleklart-kommisjon"
            value={draft.commission}
            modes={[["auto", "Automatisk sats"], ["percent", "Manuell prosent"], ["amount", "Fast kronebeløp"]]}
            onChange={(commission) => update({ commission })}
            current={result ? { percent: result.commission.percent, amount: result.commission.amount } : null}
            detail={result ? `${result.commission.percent === null ? "Fast beløp" : `${result.commission.percent} % av ${money(result.commission.base)}`} · ${money(result.commission.amount, 2)}` : ""}
          />
          <ModeCard
            title="Volumreduksjon"
            value={draft.reduction}
            modes={[["auto", "Installatørens trinn"], ["percent", "Manuell prosent"], ["amount", "Fast kronebeløp"]]}
            onChange={(reduction) => update({ reduction })}
            current={result ? { percent: result.reduction.percent, amount: result.reduction.amount } : null}
            detail={result ? `${result.reduction.percent === null ? "Fast reduksjon" : `${result.reduction.percent} %`} · ${money(result.reduction.amount, 2)} før monteringspåslag` : ""}
          />
          <div className={s.panel}>
            <div className={s.panelhead}>
              <h2>Støtte og avgift</h2>
            </div>
            <div className={s.panelbody}>
              <div className={`${s.fields} ${s.two}`}>
                <label>
                  Mva. %
                  <input className={s.input} inputMode="decimal" value={draft.vatPercent} onChange={(e) => update({ vatPercent: e.target.value })} />
                </label>
                <label>
                  Anslått støtte, kr
                  <input className={s.input} inputMode="decimal" value={draft.supportAmount} onChange={(e) => update({ supportAmount: e.target.value })} />
                </label>
              </div>
              <p className={`${s.small} ${s.muted}`}>Støtte legges inn manuelt og reduserer ikke fakturabeløpet. Ingen støtteordning er forhåndsberegnet.</p>
            </div>
          </div>
          <div className={s.sidenote}>
            Beløp etter materiell og Soleklart skal dekke arbeid, øvrige kostnader og fortjeneste. Arbeidsgrunnlaget er avtalte priser, ikke dokumenterte interne kostnader.
          </div>
        </aside>
      </div>

      {dialog?.type === "add" && (
        <AddLineDialog
          catalog={catalog}
          kind={dialog.kind}
          panelCount={panelCount}
          onAdd={(line) => {
            addLine(line);
            setDialog(null);
            if (line.markupPercent === "") toast.warn("Denne kategorien mangler avtalt påslag. Fyll inn påslaget på prislinjen.");
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === "edit" && (
        <EditLineDialog
          line={draft.lines.find((l) => l.id === dialog.id)!}
          currentSale={saleOf(dialog.id)}
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
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}
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
                    <td className={s.small}>
                      {l.quantity} {l.unit}
                    </td>
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
                Anslått støtte: {money(result.totals.support, 2)}
                <br />
                Kostnad etter støtte inkl. mva.: {money(result.totals.afterSupport, 2)}
              </>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}

function PanelCountInput({ value, onCommit }: { value: number; onCommit: (text: string) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      className={s.input}
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== String(value) && onCommit(text)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
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
  current: { percent: number | null; amount: number } | null;
  detail: string;
}) {
  return (
    <div className={s.panel}>
      <div className={s.panelhead}>
        <h2>{title}</h2>
      </div>
      <div className={s.panelbody}>
        <div className={`${s.fields} ${s.two}`}>
          <label className={s.wide}>
            Beregningsmåte
            <select
              className={s.input}
              value={value.mode}
              onChange={(e) => {
                const mode = e.target.value as Adjustment["mode"];
                // Start manuell verdi fra dagens beregnede verdi, som i prototypen
                const start = mode === "amount" ? String((current?.amount ?? 0) / 100) : mode === "percent" ? String(current?.percent ?? 0) : "";
                onChange({ mode, value: start });
              }}
            >
              {modes.map(([m, label]) => (
                <option key={m} value={m}>{label}</option>
              ))}
            </select>
          </label>
          {value.mode !== "auto" && (
            <label className={s.wide}>
              {value.mode === "amount" ? "Fast beløp eks. mva." : "Prosent"}
              <input className={s.input} inputMode="decimal" value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value })} />
            </label>
          )}
        </div>
        <div className={`${s.small} ${s.muted}`} style={{ marginTop: 12 }}>
          {detail}
        </div>
      </div>
    </div>
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
  const q = query.toLowerCase();
  const title = kind === "product" ? "Legg til produkt" : kind === "mount" ? "Legg til montering" : "Legg til arbeid";

  type Item = { key: string; name: string; sub: string; price: string; pick: () => void; disabled?: boolean };
  const items: Item[] =
    kind === "product"
      ? catalog.products.map((p) => ({ key: p.id, name: p.name, sub: p.supplierName, price: money(p.priceOre), pick: () => onAdd(productLine(catalog, p)) }))
      : kind === "mount"
        ? catalog.mountRates
            .filter((m) => m.priceOre != null)
            .map((m) => ({
              key: m.roofTypeId,
              name: m.roofTypeName,
              sub: m.productName ?? "Festesystem ikke valgt",
              price: money(m.priceOre!),
              pick: () => onAdd(mountLine(catalog, m, Math.max(1, panelCount))),
            }))
        : catalog.workTypes.map((w) => ({
            key: w.id,
            name: w.name,
            sub: WORK_GROUP_LABELS[w.group],
            price: w.priceOre == null ? "Sats må avtales" : money(w.priceOre),
            disabled: w.priceOre == null,
            pick: () => onAdd(workLine(catalog, w)),
          }));
  const filtered = items.filter((i) => `${i.name} ${i.sub}`.toLowerCase().includes(q));

  return (
    <Dialog title={title} onClose={onClose}>
      <div className={s.toolbar}>
        <input className={s.input} autoFocus placeholder="Søk etter navn eller leverandør" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className={s.list}>
        {filtered.map((i) => (
          <button key={i.key} className={s.btn} disabled={i.disabled} onClick={i.pick} title={i.disabled ? "Sett satsen under Prisavtaler først" : undefined}>
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

  return (
    <Dialog
      title="Prislinje"
      onClose={onClose}
      footer={
        <button
          className={`${s.btn} ${s.primary}`}
          disabled={!name.trim()}
          onClick={() => onSave({ name: name.trim(), unit, priceMode, fixedSale, reductionEligible })}
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
        {line.kind === "mount" && (
          <label className={s.check}>
            <input type="checkbox" checked={reductionEligible} onChange={(e) => setReductionEligible(e.target.checked)} /> Omfattes av volumreduksjon
          </label>
        )}
      </div>
      <p className={`${s.small} ${s.muted}`}>Fast salgsbeløp endrer ikke innkjøps- eller arbeidsgrunnlaget.</p>
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
      <p className={s.muted}>Gjeldende utkast erstattes.</p>
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
