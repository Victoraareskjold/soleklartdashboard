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
  const [dialog, setDialog] = useState<null | { product?: CalcProduct }>(null);

  const categoryById = useMemo(() => new Map(catalog.categories.map((c) => [c.id, c])), [catalog.categories]);
  const topCategories = catalog.categories.filter((c) => !c.parentId);
  const topOf = (id: string) => {
    const c = categoryById.get(id);
    return c?.parentId ? categoryById.get(c.parentId) : c;
  };
  const hiddenCount = catalog.products.filter((p) => !p.active).length;

  const filtered = catalog.products.filter(
    (p) =>
      (showHidden ? !p.active : p.active) &&
      (!categoryId || topOf(p.categoryId)?.id === categoryId) &&
      `${p.name} ${p.supplierName}`.toLowerCase().includes(search.toLowerCase()),
  );

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
          <div className={s.toolbar}>
            <input className={s.input} placeholder="Søk produkt eller leverandør" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={s.input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Kategori">
              <option value="">Alle kategorier</option>
              {topCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
              <tbody>
                {filtered.map((p) => {
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
