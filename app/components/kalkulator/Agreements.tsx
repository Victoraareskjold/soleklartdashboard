"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import {
  createWorkType,
  setCommissionSettings,
  setMarkup,
  setMountRate,
  setVolumeTiers,
  setWorkRate,
  updateWorkType,
  type CalcCatalog,
  type CalcWorkType,
  type MarkupGroup,
} from "@/lib/calcApi";
import { MoneyField, PercentField } from "./fields";
import { TierEditor, tierProblems } from "./TierEditor";
import s from "./kalkulator.module.css";

const MARKUP_LABELS: Record<MarkupGroup, string> = {
  solcellemateriell: "Solcellemateriell",
  frakt: "Frakt",
  stillase: "Stillase",
  ballastein: "Ballastein",
  elektro: "Elektrisk installasjon",
  montering: "Montering",
};

export const WORK_GROUP_LABELS: Record<CalcWorkType["group"], string> = {
  søknad: "Søknad",
  solcelleanlegg: "Solcelleanlegg",
  batteri: "Batteri",
  tillegg: "Tilleggskostnader",
};

const UNITS = ["jobb", "system", "inverter", "panel", "m", "hull", "km", "time"];

export function Agreements({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const installerId = catalog.installer.id;
  const markupEntries = (Object.keys(MARKUP_LABELS) as MarkupGroup[]).map((g) => [g, catalog.markups[g] ?? null] as const);
  const missingMarkups = markupEntries.filter(([, v]) => v == null).length;
  const volumeProblems = tierProblems(catalog.volumeTiers);
  const festeProducts = catalog.products.filter((p) => catalog.categories.find((c) => c.id === p.categoryId)?.productKind === "feste");
  const after = <T,>(p: Promise<T>) => p.then(reload);

  return (
    <>
      {!edit && <div className={`${s.notice} ${s.info}`}>Du kan se satsene, men bare admin kan endre dem.</div>}
      {missingMarkups > 0 && (
        <div className={s.notice}>{catalog.installer.name} mangler {missingMarkups} påslag. Kalkyler kan ikke lages før de er satt.</div>
      )}
      {volumeProblems.length > 0 && <div className={s.notice}>Volumreduksjon: {volumeProblems.join(" · ")}.</div>}

      <div className={s.grid}>
        <div>
          <section className={s.panel}>
            <div className={s.panelhead}>
              <h2>Påslag per kategori</h2>
            </div>
            <table>
              <tbody>
                {markupEntries.map(([group, percent]) => (
                  <tr key={group}>
                    <td>{MARKUP_LABELS[group]}</td>
                    <td className={s.num}>
                      <PercentField
                        label={`Påslag ${MARKUP_LABELS[group]}`}
                        value={percent}
                        editable={edit}
                        max={1000}
                        onSave={(v) => after(setMarkup(installerId, group, v))}
                      />
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
              <h2>Montering</h2>
              <span className={`${s.small} ${s.muted}`}>per panel · {catalog.mountRates.filter((m) => m.priceOre != null).length} av {catalog.mountRates.length} taktyper</span>
            </div>
            <div className={s.tablewrap}>
              <table>
                <thead>
                  <tr>
                    <th>Taktype</th>
                    <th>Festesystem</th>
                    <th className={s.num}>Pris</th>
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
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
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
            </div>
            <TierEditor
              tiers={catalog.volumeTiers}
              editable={edit}
              onSave={(tiers) => after(setVolumeTiers(installerId, tiers)).then(() => toast.success("Volumtrinn lagret"))}
            />
          </section>

          <CommissionPanel catalog={catalog} reload={reload} />
        </div>
      </div>
    </>
  );
}

function WorkPanel({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const [adding, setAdding] = useState(false);
  const groups = Object.keys(WORK_GROUP_LABELS) as CalcWorkType["group"][];
  const after = <T,>(p: Promise<T>) => p.then(reload);

  return (
    <section className={s.panel}>
      <div className={s.panelhead}>
        <h2>Arbeidspriser</h2>
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
              <th className={s.num}>Grunnlag eks. mva.</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const items = catalog.workTypes.filter((w) => w.group === group);
              if (!items.length) return null;
              return [
                <tr key={group} className={s.subhead}>
                  <td colSpan={3}>{WORK_GROUP_LABELS[group]}</td>
                </tr>,
                ...items.map((w) => (
                  <tr key={w.id}>
                    <td className={s.small}>{w.name}</td>
                    <td className={s.small}>
                      {edit ? (
                        <span className={s.inline}>
                          <select
                            className={s.input}
                            value={w.unit}
                            aria-label={`Enhet ${w.name}`}
                            onChange={(e) => after(updateWorkType(w.id, { unit: e.target.value, unitConfirmed: true })).catch((err) => toast.error(err.message))}
                          >
                            {[...new Set([w.unit, ...UNITS])].map((u) => (
                              <option key={u}>{u}</option>
                            ))}
                          </select>
                          {!w.unitConfirmed && (
                            <button
                              className={`${s.pill} ${s.manual}`}
                              title="Enheten ble gjettet ved import. Klikk for å bekrefte."
                              onClick={() => after(updateWorkType(w.id, { unitConfirmed: true }))}
                            >
                              bekreft
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
                    <td className={s.num}>
                      <MoneyField
                        label={`Arbeidspris ${w.name}`}
                        value={w.priceOre}
                        editable={edit}
                        onSave={(ore) => after(setWorkRate(catalog.installer.id, w.id, ore == null ? null : ore / 100))}
                      />
                    </td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
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

function CommissionPanel({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const save = (patch: Partial<Parameters<typeof setCommissionSettings>[0]>) =>
    setCommissionSettings({
      commissionTiers: catalog.commissionTiers,
      noPanelCommissionPercent: catalog.settings.noPanelCommissionPercent,
      vatPercent: catalog.settings.vatPercent,
      ...patch,
    }).then(reload);

  return (
    <section className={s.panel}>
      <div className={s.panelhead}>
        <h2>Soleklart-provisjon</h2>
        <span className={`${s.small} ${s.muted}`}>gjelder alle installatører</span>
      </div>
      <TierEditor
        tiers={catalog.commissionTiers}
        editable={edit}
        minStart={1}
        onSave={(tiers) => save({ commissionTiers: tiers }).then(() => toast.success("Provisjon lagret"))}
      />
      <table>
        <tbody>
          <tr>
            <td className={s.small}>Uten paneler (batteri, lader o.l.)</td>
            <td className={s.num}>
              <PercentField
                label="Provisjon uten paneler"
                value={catalog.settings.noPanelCommissionPercent}
                editable={edit}
                onSave={(v) => (v == null ? Promise.reject(new Error("Må fylles inn")) : save({ noPanelCommissionPercent: v }))}
              />
            </td>
          </tr>
          <tr>
            <td className={s.small}>Mva.</td>
            <td className={s.num}>
              <PercentField
                label="Mva."
                value={catalog.settings.vatPercent}
                editable={edit}
                onSave={(v) => (v == null ? Promise.reject(new Error("Må fylles inn")) : save({ vatPercent: v }))}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
