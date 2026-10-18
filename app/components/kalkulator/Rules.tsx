"use client";

// Sentrale beregningsregler: invertervalg, støtte (Enova), Soleklart-provisjon og mva.
// Gjelder alle installatører i teamet. Kun admin kan endre.
import { toast } from "react-toastify";
import { updateSettings, type CalcCatalog } from "@/lib/calcApi";
import { MoneyField, NumberField, PercentField, fmtPct } from "./fields";
import { TierEditor } from "./TierEditor";
import { MapPanels } from "./MapPanels";
import { Preferences } from "./Preferences";
import s from "./kalkulator.module.css";

export function Rules({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const st = catalog.settings;
  const save = (patch: Parameters<typeof updateSettings>[0], ok = "Regel lagret") =>
    updateSettings(patch)
      .then(() => toast.success(ok))
      .then(reload);
  const supportCategories = catalog.categories.filter((c) => !c.parentId && c.supportEligible).map((c) => c.name);
  const supportWork = catalog.workTypes.filter((w) => w.active && w.supportEligible).length;
  const kr = (ore: number) => `${(ore / 100).toLocaleString("nb-NO")} kr`;

  return (
    <div className={s.container}>
      <div className={s.pagehead}>
        <div>
          <h1>Beregningsregler</h1>
          <p>Felles regler for alle installatører. Endringer gjelder nye beregninger; lagrede tilbud beholder reglene de ble regnet med.</p>
        </div>
      </div>
      {!edit && <div className={`${s.notice} ${s.info}`}>Du kan se reglene, men bare admin kan endre dem.</div>}

      <div className={s.grid}>
        <div>
          <section className={s.panel}>
            <div className={s.panelhead}>
              <h2>Invertervalg</h2>
            </div>
            <div className={s.panelbody}>
              <p className={s.rulehelp}>
                Grunnpakken får alltid en vanlig 3-fase stringinverter: blant inverterne som passer strømnettet (230/400 V) og har AC-effekt fra måleffekten opp til det doble, velges laveste innkjøpspris (på tvers av leverandører). Er maks PV-effekt oppgitt, må anlegget være innenfor. Hybrid i grunnpakken velges bare manuelt; ellers tilbys hybrid som tillegg i batteridelen.
              </p>
              <div className={s.formula}>
                Anleggseffekt (kWp) = paneler × Wp / 1000
                <br />
                Måleffekt (kW) = kWp ÷ dimensjoneringsfaktor
              </div>
              <label className={s.inlinefield}>
                Dimensjoneringsfaktor
                <NumberField label="Dimensjoneringsfaktor" value={st.inverterSizingFactor} editable={edit} min={0.5} max={3} onSave={(v) => save({ inverterSizingFactor: v })} />
              </label>
              <p className={`${s.small} ${s.muted}`}>
                Eksempel: 36 × 460 Wp = 16,56 kWp ÷ {fmtPct(st.inverterSizingFactor)} = {fmtPct(16.56 / st.inverterSizingFactor)} kW. Faktoren er en kalkulatorinnstilling, ikke en produsentgrense; produsentens grenser for DC-spenning, strøm og MPPT må fortsatt kontrolleres.
              </p>
            </div>
          </section>

          <section className={s.panel}>
            <div className={s.panelhead}>
              <h2>Soleklart-provisjon</h2>
            </div>
            <TierEditor tiers={catalog.commissionTiers} editable={edit} minStart={1} onSave={(tiers) => save({ commissionTiers: tiers }, "Provisjon lagret")} />
            <table>
              <tbody>
                <tr>
                  <td className={s.small}>Uten paneler (batteri, lader o.l.)</td>
                  <td className={s.num}>
                    <PercentField label="Provisjon uten paneler" value={st.noPanelCommissionPercent} editable={edit} onSave={(v) => (v == null ? Promise.reject(new Error("Må fylles inn")) : save({ noPanelCommissionPercent: v }))} />
                  </td>
                </tr>
                <tr>
                  <td className={s.small}>Standard mva.</td>
                  <td className={s.num}>
                    <PercentField label="Mva." value={st.vatPercent} editable={edit} onSave={(v) => (v == null ? Promise.reject(new Error("Må fylles inn")) : save({ vatPercent: v }))} />
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        <div>
          <section className={s.panel}>
            <div className={s.panelhead}>
              <h2>Støtte for privatkunder</h2>
              {edit ? (
                <label className={s.check}>
                  <input type="checkbox" checked={st.supportEnabled} onChange={(e) => save({ supportEnabled: e.target.checked })} /> Beregn automatisk
                </label>
              ) : (
                <span className={s.small}>{st.supportEnabled ? "Beregnes automatisk" : "Av"}</span>
              )}
            </div>
            <div className={s.panelbody}>
              <div className={s.formula}>
                Forventet støtte = laveste av
                <br />· støtteberettiget kostnad inkl. mva. × {fmtPct(st.supportPercent)} %
                <br />· min(faktisk kWp, {fmtPct(st.supportMaxKwp)}) × {kr(st.supportPerKwpOre)}
                <br />· {kr(st.supportMaxOre)}
              </div>
              <table>
                <tbody>
                  <tr>
                    <td className={s.small}>Navn på ordningen</td>
                    <td className={s.num}>
                      {edit ? <TextSave value={st.supportName} onSave={(v) => save({ supportName: v })} /> : st.supportName}
                    </td>
                  </tr>
                  <tr>
                    <td className={s.small}>Andel av støtteberettiget kostnad</td>
                    <td className={s.num}>
                      <PercentField label="Støtteprosent" value={st.supportPercent} editable={edit} onSave={(v) => (v == null ? Promise.reject(new Error("Må fylles inn")) : save({ supportPercent: v }))} />
                    </td>
                  </tr>
                  <tr>
                    <td className={s.small}>Sats per kWp</td>
                    <td className={s.num}>
                      <MoneyField label="Sats per kWp" value={st.supportPerKwpOre} editable={edit} allowEmpty={false} onSave={(ore) => save({ supportPerKwp: (ore ?? 0) / 100 })} />
                    </td>
                  </tr>
                  <tr>
                    <td className={s.small}>Maks kWp som gir støtte</td>
                    <td className={s.num}>
                      <NumberField label="Maks kWp" value={st.supportMaxKwp} unit="kWp" editable={edit} onSave={(v) => save({ supportMaxKwp: v })} />
                    </td>
                  </tr>
                  <tr>
                    <td className={s.small}>Maks støttebeløp</td>
                    <td className={s.num}>
                      <MoneyField label="Maks støtte" value={st.supportMaxOre} editable={edit} allowEmpty={false} onSave={(ore) => save({ supportMax: (ore ?? 0) / 100 })} />
                    </td>
                  </tr>
                  <tr>
                    <td className={s.small}>Montering med i grunnlaget</td>
                    <td className={s.num}>
                      {edit ? (
                        <input type="checkbox" checked={st.mountSupportEligible} onChange={(e) => save({ mountSupportEligible: e.target.checked })} aria-label="Montering med i støttegrunnlaget" />
                      ) : st.mountSupportEligible ? (
                        "Ja"
                      ) : (
                        "Nei"
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className={s.rulehelp} style={{ marginTop: 12 }}>
                <strong>Hvilke kostnader som er med:</strong> kategoriene {supportCategories.join(", ") || "—"} (settes per kategori i Produktkatalog → Kategorier), {supportWork} arbeidstyper (kolonnen «Støtte» i Prisavtaler) og {st.mountSupportEligible ? "montering" : "ikke montering"}. Batteri er ikke med. Hver linje kan overstyres under «Detaljer» i kalkylen.
              </p>
              <p className={`${s.small} ${s.muted}`}>
                Gjelder bare privatkunder. Næringskunder får aldri automatisk støtte, men kan få et manuelt anslag i kalkylen. Faktisk kWp er paneler × Wp etter avrunding til hele paneler. Støtten endrer ikke fakturapris, mva. eller kommisjon.
              </p>
            </div>
          </section>

          <section className={s.panel}>
            <div className={s.panelhead}>
              <h2>Batteri og hybrid på tilbudet</h2>
            </div>
            <div className={s.panelbody}>
              <p className={s.rulehelp}>
                Hybridalternativet velges automatisk: hybridinvertere for kundens strømnett og valgt batteritype som tåler anleggets PV-effekt, helst ikke større enn stringinverteren, laveste innkjøpspris først. Har inverteren ikke oppgitt maks PV-effekt, brukes AC-effekt × DC/AC-forhold. Kunden betaler mellomlegget (hybrid − stringinverter) med installatørens påslag og Soleklart-satsen.
              </p>
              <table>
                <tbody>
                  <tr>
                    <td className={s.small}>Standard batteritype</td>
                    <td className={s.num}>
                      {edit ? (
                        <select className={s.input} value={st.defaultBatteryClass} onChange={(e) => save({ defaultBatteryClass: e.target.value as "HV" | "LV" })} aria-label="Standard batteritype">
                          <option value="HV">HV (høyvolt)</option>
                          <option value="LV">LV (lavvolt)</option>
                        </select>
                      ) : (
                        st.defaultBatteryClass
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className={s.small}>DC/AC-forhold for hybrid uten oppgitt maks PV</td>
                    <td className={s.num}>
                      <NumberField label="DC/AC-forhold" value={st.hybridDcRatio} editable={edit} min={0.5} max={5} onSave={(v) => save({ hybridDcRatio: v })} />
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className={`${s.small} ${s.muted}`}>Batteritypen kan endres per tilbud.</p>
            </div>
          </section>

          <section className={s.panel}>
            <div className={s.panelhead}>
              <h2>Standardverdier for økonomi</h2>
            </div>
            <div className={s.panelbody}>
              <p className={s.rulehelp}>
                Startverdier for strømpris, nettleie og prisvekst i lønnsomhetsberegningen på tilbudet. Nye tilbud får verdiene som gjelder når de opprettes; signerte og tidligere tilbud endres ikke. Kunden kan justere dem på tilbudssiden.
              </p>
              <table>
                <tbody>
                  <tr>
                    <td className={s.small}>Strømpris privat</td>
                    <td className={s.num}>
                      <NumberField label="Strømpris privat" value={st.economy.private.elPrice} unit="kr/kWh" editable={edit} max={20} onSave={(v) => save({ economyElPricePrivate: v })} />
                    </td>
                  </tr>
                  <tr>
                    <td className={s.small}>Nettleie privat</td>
                    <td className={s.num}>
                      <NumberField label="Nettleie privat" value={st.economy.private.netPrice} unit="kr/kWh" editable={edit} max={20} onSave={(v) => save({ economyNetPricePrivate: v })} />
                    </td>
                  </tr>
                  <tr>
                    <td className={s.small}>Strømpris næring</td>
                    <td className={s.num}>
                      <NumberField label="Strømpris næring" value={st.economy.business.elPrice} unit="kr/kWh" editable={edit} max={20} onSave={(v) => save({ economyElPriceBusiness: v })} />
                    </td>
                  </tr>
                  <tr>
                    <td className={s.small}>Nettleie næring</td>
                    <td className={s.num}>
                      <NumberField label="Nettleie næring" value={st.economy.business.netPrice} unit="kr/kWh" editable={edit} max={20} onSave={(v) => save({ economyNetPriceBusiness: v })} />
                    </td>
                  </tr>
                  <tr>
                    <td className={s.small}>Forventet prisvekst per år</td>
                    <td className={s.num}>
                      <NumberField label="Prisvekst" value={st.economy.priceGrowthPercent} unit="%" editable={edit} max={20} onSave={(v) => save({ economyPriceGrowthPercent: v })} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <Preferences catalog={catalog} reload={reload} />

          <MapPanels editable={edit} />
        </div>
      </div>
    </div>
  );
}

function TextSave({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  return (
    <input
      className={s.input}
      defaultValue={value}
      onBlur={(e) => e.target.value.trim() && e.target.value !== value && onSave(e.target.value.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
