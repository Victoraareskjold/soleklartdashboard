"use client";

// Foretrukne merker og leverandører. Kalkulatoren velger disse først når de passer prosjektet
// (nett, størrelse, batteritype); ellers velges som før. Alt kan overstyres i hvert tilbud.
import { useState } from "react";
import { toast } from "react-toastify";
import { updateSettings, type CalcCatalog, type PreferenceKind } from "@/lib/calcApi";
import s from "./kalkulator.module.css";

const KINDS: { kind: PreferenceKind; label: string; help: string; productKind: string }[] = [
  { kind: "panel", label: "Paneler", help: "Panelet nye kalkyler starter med.", productKind: "panel" },
  { kind: "inverter", label: "Stringinvertere", help: "Grunnpakkens inverter når den passer nett og størrelse.", productKind: "inverter" },
  { kind: "hybrid", label: "Hybridinvertere", help: "Automatisk hybridvalg i batteridelen når den passer nett, batteritype og PV-effekt.", productKind: "inverter" },
  { kind: "battery", label: "Batterier", help: "Sorteres først blant batterimodellene (etter standardrekkefølgen).", productKind: "batteri" },
];

export function Preferences({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const current = catalog.settings.preferences ?? {};
  const [brands, setBrands] = useState<Record<string, string>>(() =>
    Object.fromEntries(KINDS.map(({ kind }) => [kind, (current[kind]?.brands ?? []).join(", ")])),
  );

  const save = (kind: PreferenceKind, patch: { supplierIds?: string[]; brands?: string[] }) => {
    const next = Object.fromEntries(
      KINDS.map(({ kind: k }) => [k, { supplierIds: current[k]?.supplierIds ?? [], brands: current[k]?.brands ?? [] }]),
    ) as Record<PreferenceKind, { supplierIds: string[]; brands: string[] }>;
    next[kind] = { ...next[kind], ...patch };
    return updateSettings({ preferences: next })
      .then(() => toast.success("Foretrukne valg lagret"))
      .then(reload)
      .catch((e: Error) => toast.error(e.message));
  };

  const suppliersFor = (productKind: string) => {
    const cats = new Set(catalog.categories.filter((c) => c.productKind === productKind).map((c) => c.id));
    return catalog.suppliers.filter((x) => x.active && catalog.products.some((p) => p.active && p.supplierId === x.id && cats.has(p.categoryId)));
  };
  const supplierName = (id: string) => catalog.suppliers.find((x) => x.id === id)?.name ?? "ukjent";

  return (
    <section className={s.panel}>
      <div className={s.panelhead}>
        <h2>Foretrukne merker og leverandører</h2>
      </div>
      <div className={s.panelbody}>
        <p className={s.rulehelp}>
          Kalkulatoren velger foretrukne produkter først, men bare når de passer prosjektet (strømnett, størrelse, batteritype og PV-effekt). Passer ingen, velges som før: rimeligste egnede. Du kan alltid velge noe annet i det enkelte tilbudet.
          Merke = ord i produktnavnet, f.eks. «Solis» eller «Astronergy». Med både leverandør og merke må begge stemme (f.eks. Solis fra STS).
        </p>
        <table>
          <tbody>
            {KINDS.map(({ kind, label, help, productKind }) => {
              const pref = current[kind] ?? {};
              const chosen = pref.supplierIds ?? [];
              return (
                <tr key={kind}>
                  <td className={s.small} style={{ verticalAlign: "top", paddingTop: 10, width: 150 }}>
                    <strong>{label}</strong>
                    <div className={s.muted}>{help}</div>
                  </td>
                  <td>
                    {edit ? (
                      <>
                        <div className={s.fields} style={{ marginBottom: 6 }}>
                          <label>
                            Merker
                            <input
                              className={s.input}
                              placeholder={kind === "hybrid" ? "Solis" : kind === "panel" ? "Astronergy" : "Ingen preferanse"}
                              value={brands[kind] ?? ""}
                              onChange={(e) => setBrands((b) => ({ ...b, [kind]: e.target.value }))}
                              onBlur={(e) => {
                                const list = e.target.value.split(",").map((x) => x.trim()).filter(Boolean);
                                if (list.join(",") !== (pref.brands ?? []).join(",")) void save(kind, { brands: list });
                              }}
                              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                            />
                          </label>
                        </div>
                        <div className={s.chips}>
                          {suppliersFor(productKind).map((x) => {
                            const on = chosen.includes(x.id);
                            return (
                              <button
                                key={x.id}
                                type="button"
                                className={`${s.chip} ${on ? s.chipon : ""}`}
                                aria-pressed={on}
                                onClick={() => save(kind, { supplierIds: on ? chosen.filter((id) => id !== x.id) : [...chosen, x.id] })}
                              >
                                {x.name}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <span className={s.small}>
                        {[...(pref.brands ?? []), ...chosen.map(supplierName)].join(", ") || "Ingen preferanse"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className={`${s.small} ${s.muted}`}>
          Batterimodellene kunden ser, og rekkefølgen, lagres som standard fra batteridelen på et estimat («Lagre utvalg og rekkefølge som standard»).
          {catalog.settings.batteryDefaults?.models?.length
            ? ` Nå: ${catalog.settings.batteryDefaults.models.map((id) => catalog.products.find((p) => p.id === id)?.name ?? "ukjent").join(" → ")}.`
            : " Ingen standard lagret ennå: alle modeller med valgt batteritype vises."}
        </p>
      </div>
    </section>
  );
}
