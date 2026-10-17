"use client";

// Panelvalgene i solkartet (pvmap). Kunden velger mellom disse i kartet; navn, effekt og
// omtrentlig pris per panel brukes til produksjon og prisestimatet der.
// Felles for alle nettsidene (public.solarpanels). Bare admin kan endre.
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getMapPanels, MAP_PANEL_STEPS, updateMapPanel, type MapPanel } from "@/lib/calcApi";
import { NumberField } from "./fields";
import s from "./kalkulator.module.css";

const STEP_LABEL: Record<(typeof MAP_PANEL_STEPS)[number], string> = {
  "0-72": "0–72",
  "72-150": "72–150",
  "150-300": "150–300",
  "300-600": "300–600",
  "600-1000": "600–1000",
  "1000+": "1000+",
};

function TextCommit({ value, onSave, label, wide = false }: { value: string; onSave: (v: string) => void; label: string; wide?: boolean }) {
  return (
    <input
      key={value}
      className={s.input}
      style={wide ? { width: "100%" } : undefined}
      aria-label={label}
      defaultValue={value}
      onBlur={(e) => e.target.value.trim() !== value && onSave(e.target.value.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function MapPanels({ editable }: { editable: boolean }) {
  const [panels, setPanels] = useState<MapPanel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => getMapPanels().then(setPanels).catch((e: Error) => setError(e.message)), []);
  useEffect(() => {
    void load();
  }, [load]);

  const save = (id: string, patch: Parameters<typeof updateMapPanel>[1]) =>
    updateMapPanel(id, patch)
      .then((p) => {
        setPanels((list) => list?.map((x) => (x.id === p.id ? p : x)) ?? null);
        toast.success("Panelvalget er lagret. Solkartet bruker det med en gang.");
      })
      .catch((e: Error) => {
        toast.error(e.message);
        throw e;
      });

  return (
    <section className={s.panel}>
      <div className={s.panelhead}>
        <h2>Panelvalg i solkartet</h2>
      </div>
      <div className={s.panelbody}>
        <p className={s.rulehelp}>
          Alternativene kunden velger mellom i solkartet. Effekten (W) styrer anleggets kWp og årsproduksjonen i kartet. Prisen er omtrentlig innkjøpspris per panel, etter hvor mange paneler anlegget har, og brukes bare i kartets prisestimat. Tilbudene regnes fortsatt i kalkulatoren. Gjelder alle nettsidene.
        </p>
        {error && <div className={`${s.notice} ${s.error}`}>{error}</div>}
        {!panels && !error && <div className={s.empty}>Laster …</div>}
        {panels?.map((p) => (
          <div key={p.id} className={s.panel} style={{ marginTop: 12 }}>
            <div className={s.panelbody}>
              <div className={`${s.fields} ${s.two}`}>
                <label>
                  Navn
                  {editable ? <TextCommit label="Navn" value={p.name} onSave={(v) => v && void save(p.id, { name: v })} /> : <strong>{p.name}</strong>}
                </label>
                <label>
                  Effekt per panel (W)
                  <NumberField label="Effekt i watt" value={p.watt} unit="W" editable={editable} min={100} max={1500} onSave={(v) => save(p.id, { watt: Math.round(v) })} />
                </label>
                <label className={s.wide}>
                  Tekst under paneltypen
                  {editable ? (
                    <TextCommit label="Tekst" wide value={p.description ?? ""} onSave={(v) => void save(p.id, { description: v || null })} />
                  ) : (
                    <span>{p.description ?? "—"}</span>
                  )}
                </label>
              </div>
              <table style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th className={s.small}>Antall paneler</th>
                    {MAP_PANEL_STEPS.map((step) => (
                      <th key={step} className={`${s.small} ${s.num}`}>{STEP_LABEL[step]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={s.small}>Pris per panel (kr)</td>
                    {MAP_PANEL_STEPS.map((step) => (
                      <td key={step} className={s.num}>
                        <NumberField
                          label={`Pris per panel ${STEP_LABEL[step]}`}
                          value={p.prices[step]}
                          editable={editable}
                          max={1_000_000}
                          onSave={(v) => save(p.id, { prices: { [step]: v } })}
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
