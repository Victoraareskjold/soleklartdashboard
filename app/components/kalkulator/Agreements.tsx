"use client";

// Prisavtaler per installatør: påslag, arbeid, montering og volumreduksjon.
import { useState } from "react";
import { toast } from "react-toastify";
import {
  createWorkType,
  setMarkup,
  setMountRate,
  setVolumeTiers,
  setWorkRate,
  updateWorkType,
  type CalcCatalog,
  type CalcWorkType,
} from "@/lib/calcApi";
import { Help, MoneyField, PercentField } from "./fields";
import { TierEditor, tierProblems } from "./TierEditor";
import s from "./kalkulator.module.css";

export const WORK_GROUP_LABELS: Record<CalcWorkType["group"], string> = {
  søknad: "Søknad",
  solcelleanlegg: "Solcelleanlegg",
  batteri: "Batteri",
  tillegg: "Tilleggskostnader",
};

const UNITS = ["jobb", "system", "inverter", "panel", "m", "hull", "km", "time", "stk"];

export function Agreements({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const installerId = catalog.installer.id;
  const missingMarkups = catalog.markupGroups.filter((g) => catalog.markups[g.code] == null);
  const volumeProblems = tierProblems(catalog.volumeTiers);
  const festeProducts = catalog.products.filter((p) => p.active && catalog.categories.find((c) => c.id === p.categoryId)?.productKind === "feste");
  const after = <T,>(p: Promise<T>) => p.then(reload);

  return (
    <div className={s.container}>
      <div className={s.pagehead}>
        <div>
          <h1>Prisavtaler · {catalog.installer.name}</h1>
          <p>Avtalte satser for installatøren. Endringer gjelder nye kalkyler; lagrede utkast og tilbud beholder sine priser.</p>
        </div>
      </div>
      {!edit && <div className={`${s.notice} ${s.info}`}>Du kan se satsene, men bare admin kan endre dem.</div>}
      {missingMarkups.length > 0 && (
        <div className={s.notice}>
          Mangler påslag for: {missingMarkups.map((g) => g.name).join(", ")}. Produkter i disse gruppene får ikke påslag før det er satt.
        </div>
      )}
      {volumeProblems.length > 0 && <div className={s.notice}>Volumreduksjon: {volumeProblems.join(" · ")}.</div>}

      <div className={s.grid}>
        <div>
          <section className={s.panel}>
            <div className={s.panelhead}>
              <h2>Påslag per påslagsgruppe</h2>
              <Help text="Påslaget legges på innkjøpspris/avtalt sats. Hvilken gruppe et produkt hører til, settes på kategorien i Produktkatalog." />
            </div>
            <table>
              <tbody>
                {catalog.markupGroups.map((g) => (
                  <tr key={g.code}>
                    <td>{g.name}</td>
                    <td className={s.num}>
                      <PercentField label={`Påslag ${g.name}`} value={catalog.markups[g.code] ?? null} editable={edit} max={1000} onSave={(v) => after(setMarkup(installerId, g.code, v))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <WorkPanel catalog={catalog} reload={reload} />
        </div>

        <div>
          <section className={s.panel}>
            <div className={s.panelhead}>
              <h2>Montering per panel</h2>
              <span className={`${s.small} ${s.muted}`}>{catalog.mountRates.filter((m) => m.priceOre != null).length} av {catalog.mountRates.length} taktyper avtalt</span>
            </div>
            <div className={s.tablewrap}>
              <table>
                <thead>
                  <tr>
                    <th>Taktype</th>
                    <th>Festesystem</th>
                    <th className={s.num}>Pris eks. mva.</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.mountRates.map((m) => (
                    <tr key={m.roofTypeId}>
                      <td className={s.small}>{m.roofTypeName}</td>
                      <td className={s.small}>
                        {edit ? (
                          <select
                            className={s.input}
                            value={m.productId ?? ""}
                            aria-label={`Festesystem ${m.roofTypeName}`}
                            onChange={(e) => {
                              if (m.priceOre == null) return toast.info("Sett pris først");
                              after(setMountRate(installerId, m.roofTypeId, e.target.value || null, m.priceOre / 100)).catch((err) => toast.error(err.message));
                            }}
                          >
                            <option value="">Ikke valgt</option>
                            {festeProducts.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={s.muted}>{m.productName ?? "—"}</span>
                        )}
                      </td>
                      <td className={s.num}>
                        <MoneyField
                          label={`Monteringspris ${m.roofTypeName}`}
                          value={m.priceOre}
                          editable={edit}
                          onSave={(ore) => after(setMountRate(installerId, m.roofTypeId, m.productId, ore == null ? null : ore / 100))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={s.panel}>
            <div className={s.panelhead}>
              <h2>Volumreduksjon på montering</h2>
              <Help text="Trekkes fra monteringsgrunnlaget før påslag, etter antall paneler." />
            </div>
            <TierEditor tiers={catalog.volumeTiers} editable={edit} onSave={(tiers) => after(setVolumeTiers(installerId, tiers)).then(() => toast.success("Volumtrinn lagret"))} />
          </section>
        </div>
      </div>
    </div>
  );
}

function WorkPanel({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const [adding, setAdding] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const groups = Object.keys(WORK_GROUP_LABELS) as CalcWorkType["group"][];
  const after = <T,>(p: Promise<T>) => p.then(reload).catch((e: Error) => toast.error(e.message));
  const hiddenCount = catalog.workTypes.filter((w) => !w.active).length;

  return (
    <section className={s.panel}>
      <div className={s.panelhead}>
        <div>
          <h2>Arbeidspriser</h2>
          <span className={`${s.small} ${s.muted}`}>Arbeidstypene er felles; satsen gjelder {catalog.installer.name}.</span>
        </div>
        {edit && (
          <button className={s.btn} onClick={() => setAdding(!adding)}>
            + Felles arbeidstype
          </button>
        )}
      </div>
      {adding && <NewWorkType onDone={() => { setAdding(false); reload(); }} />}
      <div className={s.tablewrap}>
        <table>
          <thead>
            <tr>
              <th>Arbeid</th>
              <th>Enhet</th>
              <th title="Med i grunnlaget for solcellestøtte">Støtte</th>
              <th className={s.num}>Sats eks. mva.</th>
              {edit && <th />}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const items = catalog.workTypes.filter((w) => w.group === group && (w.active || showHidden));
              if (!items.length) return null;
              return [
                <tr key={group} className={s.subhead}>
                  <td colSpan={edit ? 5 : 4}>{WORK_GROUP_LABELS[group]}</td>
                </tr>,
                ...items.map((w) => (
                  <tr key={w.id} className={w.active ? "" : s.hiddenrow}>
                    <td className={s.small}>
                      {w.name}
                      {!w.active && <span className={s.pill}> skjult</span>}
                    </td>
                    <td className={s.small}>
                      {edit ? (
                        <span className={s.inputwrap}>
                          <select className={s.input} value={w.unit} aria-label={`Enhet ${w.name}`} onChange={(e) => after(updateWorkType(w.id, { unit: e.target.value, unitConfirmed: true }))}>
                            {[...new Set([w.unit, ...UNITS])].map((u) => (
                              <option key={u}>{u}</option>
                            ))}
                          </select>
                          {!w.unitConfirmed && (
                            <button className={`${s.btn} ${s.small2}`} title="Enheten ble gjettet ved import. Klikk når den er riktig." onClick={() => after(updateWorkType(w.id, { unitConfirmed: true }))}>
                              Bekreft
                            </button>
                          )}
                        </span>
                      ) : (
                        <>
                          {w.unit}
                          {!w.unitConfirmed && <span className={s.pill} title="Enheten må bekreftes">?</span>}
                        </>
                      )}
                    </td>
                    <td className={s.small}>
                      {edit ? (
                        <input type="checkbox" aria-label={`Med i støttegrunnlag: ${w.name}`} checked={w.supportEligible} onChange={(e) => after(updateWorkType(w.id, { supportEligible: e.target.checked }))} />
                      ) : w.supportEligible ? (
                        "Med"
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={s.num}>
                      <MoneyField
                        label={`Arbeidspris ${w.name}`}
                        value={w.priceOre}
                        editable={edit}
                        onSave={(ore) => after(setWorkRate(catalog.installer.id, w.id, ore == null ? null : ore / 100))}
                      />
                    </td>
                    {edit && (
                      <td className={s.rowactions2}>
                        <button
                          className={`${s.btn} ${s.small2} ${w.active ? s.danger : ""}`}
                          title={w.active ? "Skjuler arbeidstypen for alle installatører. Satsene slettes ikke." : "Vis arbeidstypen igjen"}
                          onClick={() => after(updateWorkType(w.id, { active: !w.active }))}
                        >
                          {w.active ? "Skjul" : "Vis igjen"}
                        </button>
                      </td>
                    )}
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 && (
        <div className={s.footerbar}>
          <label className={s.check}>
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Vis skjulte arbeidstyper ({hiddenCount})
          </label>
        </div>
      )}
    </section>
  );
}

function NewWorkType({ onDone }: { onDone: () => void }) {
  const [group, setGroup] = useState<CalcWorkType["group"]>("tillegg");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("jobb");
  const [saving, setSaving] = useState(false);
  return (
    <div className={`${s.panelbody} ${s.formrow}`}>
      <label>
        Gruppe
        <select className={s.input} value={group} onChange={(e) => setGroup(e.target.value as CalcWorkType["group"])}>
          {Object.entries(WORK_GROUP_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <label className={s.grow}>
        Navn
        <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Enhet
        <select className={s.input} value={unit} onChange={(e) => setUnit(e.target.value)}>
          {UNITS.map((u) => <option key={u}>{u}</option>)}
        </select>
      </label>
      <button
        className={`${s.btn} ${s.primary}`}
        disabled={saving || !name.trim()}
        onClick={async () => {
          setSaving(true);
          try {
            await createWorkType({ group, name, unit });
            toast.success("Arbeidstype lagt til for alle installatører. Sett satsen per installatør.");
            onDone();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        Legg til
      </button>
    </div>
  );
}
