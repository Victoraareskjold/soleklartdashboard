"use client";

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { updateProduct, type CalcCatalog, type CalcProduct } from "@/lib/calcApi";
import { MoneyField } from "./fields";
import { CatalogSetup } from "./CatalogSetup";
import { ProductDialog, specsSummary } from "./ProductDialog";
import s from "./kalkulator.module.css";

export function Catalog({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const [view, setView] = useState<"products" | "setup">("products");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [inverterType, setInverterType] = useState<"" | "string" | "hybrid">("");
  const [grid, setGrid] = useState<"" | "230" | "400">("");
  const [batteryClass, setBatteryClass] = useState<"" | "HV" | "LV">("");
  const [dialog, setDialog] = useState<null | { product?: CalcProduct; initial?: { supplierId?: string; categoryId?: string } }>(null);

  const categoryById = useMemo(() => new Map(catalog.categories.map((c) => [c.id, c])), [catalog.categories]);
  const topCategories = catalog.categories.filter((c) => !c.parentId);
  const topOf = (id: string) => {
    const c = categoryById.get(id);
    return c?.parentId ? categoryById.get(c.parentId) : c;
  };
  const hiddenCount = catalog.products.filter((p) => !p.active).length;

  const kindOf = (p: CalcProduct) => categoryById.get(p.categoryId)?.productKind;
  const selectedKind = categoryId ? categoryById.get(categoryId)?.productKind : undefined;
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const visible = catalog.products.filter((p) => (showHidden ? !p.active : p.active));
  const countIn = (id: string) => visible.filter((p) => topOf(p.categoryId)?.id === id).length;

  const filtered = visible.filter((p) => {
    const hay = `${p.name} ${p.supplierName} ${categoryById.get(p.categoryId)?.name ?? ""}`.toLowerCase();
    if (categoryId && topOf(p.categoryId)?.id !== categoryId) return false;
    if (supplierId && p.supplierId !== supplierId) return false;
    if (words.length && !words.every((w) => hay.includes(w))) return false;
    const k = kindOf(p);
    if (k === "inverter") {
      if (inverterType && (inverterType === "hybrid") !== Boolean(p.specs.hybrid)) return false;
      if (grid && p.specs.grid !== grid && p.specs.grid !== "begge") return false;
    }
    if (batteryClass && (k === "batteri" || (k === "inverter" && p.specs.hybrid)) && p.specs.batteryClass !== batteryClass) return false;
    return true;
  });

  /** Gruppe for oversikten: leverandør, og for invertere type og nett, for batterier HV/LV */
  const groupOf = (p: CalcProduct) => {
    const k = kindOf(p);
    const parts = [p.supplierName || "Uten leverandør"];
    if (!categoryId) parts.push(topOf(p.categoryId)?.name ?? "");
    if (k === "inverter") {
      parts.push(p.specs.hybrid ? `Hybrid${p.specs.batteryClass ? ` ${p.specs.batteryClass}` : ""}` : "String");
      parts.push(p.specs.grid ? (p.specs.grid === "begge" ? "230/400 V" : `${p.specs.grid} V`) : "nett mangler");
    }
    if (k === "batteri") parts.push(p.specs.batteryClass ?? "type mangler");
    return parts.filter(Boolean).join(" · ");
  };
  const size = (p: CalcProduct) => p.specs.acKw ?? p.specs.wp ?? p.specs.capacityKwh ?? 0;
  const groups = [...filtered.reduce((m, p) => m.set(groupOf(p), [...(m.get(groupOf(p)) ?? []), p]), new Map<string, CalcProduct[]>())]
    .map(([label, items]) => ({ label, items: items.sort((a, b) => size(a) - size(b) || a.name.localeCompare(b.name, "nb")) }))
    .sort((a, b) => a.label.localeCompare(b.label, "nb"));
  const usedSuppliers = catalog.suppliers.filter((x) => visible.some((p) => p.supplierId === x.id && (!categoryId || topOf(p.categoryId)?.id === categoryId)));
  const resetFilters = () => {
    setSupplierId("");
    setInverterType("");
    setGrid("");
    setBatteryClass("");
    setSearch("");
  };

  const setActive = async (p: CalcProduct, active: boolean) => {
    try {
      await updateProduct(p.id, { active });
      toast.success(active ? `«${p.name}» vises igjen i nye kalkyler` : `«${p.name}» er skjult. Finn det igjen med «Vis skjulte produkter».`);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className={s.container}>
      <div className={s.pagehead}>
        <div>
          <h1>Felles produktkatalog</h1>
          <p>{catalog.products.filter((p) => p.active).length} aktive produkter · samme innkjøpspriser for alle installatører</p>
        </div>
        <div className={s.actions}>
          <button className={`${s.btn} ${view === "products" ? s.primarylight : ""}`} onClick={() => setView("products")}>
            Produkter
          </button>
          <button className={`${s.btn} ${view === "setup" ? s.primarylight : ""}`} onClick={() => setView("setup")}>
            Kategorier, leverandører og påslag
          </button>
          {edit && view === "products" && (
            <button className={`${s.btn} ${s.primary}`} onClick={() => setDialog({})}>
              + Nytt produkt
            </button>
          )}
        </div>
      </div>

      {view === "setup" ? (
        <CatalogSetup catalog={catalog} reload={reload} />
      ) : (
        <>
          <div className={`${s.notice} ${s.info}`}>
            Endringer i katalogen gjelder nye kalkyler. Lagrede utkast og tilbud beholder prisene de ble regnet med.
            {edit && " Klikk «Rediger» for å endre leverandør, kategori og produktdata (effekt, nett, hybrid). Prisen kan endres direkte i tabellen."}
          </div>
          <div className={s.chips} role="tablist" aria-label="Kategori">
            <button className={`${s.chip} ${!categoryId ? s.chipon : ""}`} onClick={() => setCategoryId("")}>
              Alle <span>{visible.length}</span>
            </button>
            {topCategories.map((c) => (
              <button
                key={c.id}
                className={`${s.chip} ${categoryId === c.id ? s.chipon : ""}`}
                onClick={() => {
                  setCategoryId(c.id);
                  setSupplierId("");
                }}
              >
                {c.name} <span>{countIn(c.id)}</span>
              </button>
            ))}
          </div>
          <div className={s.toolbar}>
            <input className={s.input} placeholder="Søk: navn, leverandør, kW …" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={s.input} value={supplierId} onChange={(e) => setSupplierId(e.target.value)} aria-label="Leverandør">
              <option value="">Alle leverandører</option>
              {usedSuppliers.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
            {(!categoryId || selectedKind === "inverter") && (
              <>
                <select className={s.input} value={inverterType} onChange={(e) => setInverterType(e.target.value as typeof inverterType)} aria-label="Invertertype">
                  <option value="">String og hybrid</option>
                  <option value="string">Stringinvertere</option>
                  <option value="hybrid">Hybridinvertere</option>
                </select>
                <select className={s.input} value={grid} onChange={(e) => setGrid(e.target.value as typeof grid)} aria-label="Strømnett">
                  <option value="">230 og 400 V</option>
                  <option value="230">230 V</option>
                  <option value="400">400 V</option>
                </select>
              </>
            )}
            {(!categoryId || selectedKind === "inverter" || selectedKind === "batteri") && (
              <select className={s.input} value={batteryClass} onChange={(e) => setBatteryClass(e.target.value as typeof batteryClass)} aria-label="Batteritype">
                <option value="">HV og LV</option>
                <option value="HV">HV</option>
                <option value="LV">LV</option>
              </select>
            )}
            {(supplierId || inverterType || grid || batteryClass || search) && (
              <button className={`${s.btn} ${s.ghost}`} onClick={resetFilters}>
                Nullstill filtre
              </button>
            )}
            <label className={s.check}>
              <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
              Vis skjulte produkter ({hiddenCount})
            </label>
            <span className={`${s.small} ${s.muted}`}>{filtered.length} treff</span>
          </div>
          <div className={`${s.panel} ${s.tablewrap}`}>
            <table>
              <thead>
                <tr>
                  <th>Produkt</th>
                  <th>Leverandør</th>
                  <th>Kategori</th>
                  <th className={s.num}>Innkjøp eks. mva.</th>
                  <th>Oppdatert</th>
                  {edit && <th />}
                </tr>
              </thead>
              {groups.map((g) => (
              <tbody key={g.label}>
                <tr className={s.grouprow}>
                  <td colSpan={edit ? 6 : 5}>
                    <span>
                      {g.label} <span className={s.muted}>({g.items.length})</span>
                    </span>
                    {edit && (
                      <button
                        className={s.linkbtn}
                        onClick={() =>
                          setDialog({
                            initial: {
                              supplierId: g.items[0].supplierId,
                              categoryId: categoryId ? g.items[0].categoryId : undefined,
                            },
                          })
                        }
                      >
                        + produkt i gruppen
                      </button>
                    )}
                  </td>
                </tr>
                {g.items.map((p) => {
                  const cat = categoryById.get(p.categoryId);
                  const top = topOf(p.categoryId);
                  const summary = specsSummary(cat?.productKind, p.specs);
                  return (
                    <tr key={p.id} className={p.active ? "" : s.hiddenrow}>
                      <td>
                        <strong className={s.productname}>{p.name}</strong>
                        <div className={s.productmeta}>
                          {p.attachmentUrl && (
                            <a className={s.link} href={p.attachmentUrl} target="_blank" rel="noopener noreferrer">Produktark</a>
                          )}
                          <span>per {p.unit}</span>
                          {summary && <span>· {summary}</span>}
                          {p.specs.derived && <span className={`${s.pill} ${s.manual}`} title="Hentet fra produktnavnet. Åpne «Rediger» og lagre når det er kontrollert.">kontroller data</span>}
                          {!p.active && <span className={s.pill}>skjult</span>}
                        </div>
                      </td>
                      <td className={s.small}>{p.supplierName}</td>
                      <td className={s.small}>
                        {top?.name}
                        {cat?.parentId && <div className={s.muted}>{cat.name}</div>}
                      </td>
                      <td className={s.num}>
                        <MoneyField
                          label={`Pris ${p.name}`}
                          value={p.priceOre}
                          editable={edit}
                          allowEmpty={false}
                          onSave={(ore) => updateProduct(p.id, { price: (ore ?? 0) / 100 }).then(reload)}
                        />
                      </td>
                      <td className={`${s.small} ${s.muted}`}>{p.priceUpdatedAt.slice(0, 10)}</td>
                      {edit && (
                        <td className={s.rowactions2}>
                          <button className={`${s.btn} ${s.small2}`} onClick={() => setDialog({ product: p })}>
                            Rediger
                          </button>
                          {p.active ? (
                            <button
                              className={`${s.btn} ${s.small2} ${s.danger}`}
                              title="Skjuler produktet fra nye kalkyler. Det slettes ikke og kan vises igjen."
                              onClick={() => setActive(p, false)}
                            >
                              Skjul
                            </button>
                          ) : (
                            <button className={`${s.btn} ${s.small2}`} onClick={() => setActive(p, true)}>
                              Vis igjen
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              ))}
            </table>
            {!filtered.length && <div className={s.empty}>{showHidden ? "Ingen skjulte produkter." : "Ingen produkter matcher søket."}</div>}
          </div>
          {edit && (
            <p className={`${s.small} ${s.muted}`}>
              «Skjul» fjerner produktet fra nye kalkyler, men sletter det ikke. Lagrede tilbud påvirkes ikke. Skjulte produkter finner du med «Vis skjulte produkter».
            </p>
          )}
        </>
      )}

      {dialog && (
        <ProductDialog
          catalog={catalog}
          product={dialog.product}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
