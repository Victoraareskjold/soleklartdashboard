"use client";

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import { createProduct, parseKroner, updateProduct, type CalcCatalog } from "@/lib/calcApi";
import { MoneyField } from "./fields";
import s from "./kalkulator.module.css";

export function Catalog({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [adding, setAdding] = useState(false);

  const categoryById = useMemo(() => new Map(catalog.categories.map((c) => [c.id, c])), [catalog.categories]);
  const topCategories = catalog.categories.filter((c) => !c.parentId);
  const topOf = (id: string) => {
    const c = categoryById.get(id);
    return c?.parentId ? categoryById.get(c.parentId) : c;
  };

  const filtered = catalog.products.filter(
    (p) =>
      (!categoryId || topOf(p.categoryId)?.id === categoryId) &&
      `${p.name} ${p.supplierName}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className={s.pagehead}>
        <div>
          <h1>Felles produktkatalog</h1>
          <p>{catalog.products.length} produkter · samme innkjøpspriser for alle installatører</p>
        </div>
        {edit && (
          <button className={`${s.btn} ${s.primary}`} onClick={() => setAdding(!adding)}>
            + Nytt produkt
          </button>
        )}
      </div>
      <div className={`${s.notice} ${s.info}`}>
        Endringer i katalogen gjelder nye kalkyler. Lagrede tilbud beholder prisene de ble regnet med.
      </div>
      {adding && <NewProduct catalog={catalog} onDone={() => { setAdding(false); reload(); }} />}
      <div className={s.toolbar}>
        <input className={s.input} placeholder="Søk produkt eller leverandør" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={s.input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Alle kategorier</option>
          {topCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className={`${s.small} ${s.muted}`}>{filtered.length} treff</span>
      </div>
      <div className={`${s.panel} ${s.tablewrap}`}>
        <table>
          <thead>
            <tr>
              <th>Produkt</th>
              <th>Leverandør</th>
              <th>Kategori</th>
              <th className={s.num}>Pris eks. mva.</th>
              <th>Oppdatert</th>
              {edit && <th />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const cat = categoryById.get(p.categoryId);
              const top = topOf(p.categoryId);
              return (
                <tr key={p.id}>
                  <td>
                    <strong className={s.productname}>{p.name}</strong>
                    <div className={s.productmeta}>
                      {p.attachmentUrl && (
                        <>
                          <a className={s.link} href={p.attachmentUrl} target="_blank" rel="noopener noreferrer">Produktark</a>
                          {" · "}
                        </>
                      )}
                      per {p.unit}
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
                    <td className={s.num}>
                      <button
                        className={`${s.btn} ${s.ghost} ${s.danger}`}
                        title="Skjul produktet fra nye kalkyler"
                        onClick={async () => {
                          if (!confirm(`Skjule «${p.name}» fra katalogen? Lagrede tilbud påvirkes ikke.`)) return;
                          await updateProduct(p.id, { active: false }).then(reload).catch((e) => toast.error(e.message));
                        }}
                      >
                        Skjul
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && <div className={s.empty}>Ingen produkter matcher søket.</div>}
      </div>
    </>
  );
}

function NewProduct({ catalog, onDone }: { catalog: CalcCatalog; onDone: () => void }) {
  const [name, setName] = useState("");
  const [supplierId, setSupplierId] = useState(catalog.suppliers[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [unit, setUnit] = useState("stk");
  const [price, setPrice] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [saving, setSaving] = useState(false);

  // Hovedkategorier med underkategorier rett under
  const options = catalog.categories
    .filter((c) => !c.parentId)
    .flatMap((top) => [top, ...catalog.categories.filter((c) => c.parentId === top.id)]);

  const submit = async () => {
    setSaving(true);
    try {
      const kroner = parseKroner(price);
      if (kroner === null) throw new Error("Pris mangler");
      await createProduct({ name, supplierId, categoryId, unit, price: kroner, attachmentUrl: attachmentUrl.trim() || null });
      toast.success("Produkt lagt til");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={s.panel}>
      <div className={s.panelhead}>
        <h2>Nytt produkt</h2>
      </div>
      <div className={`${s.panelbody} ${s.fields}`}>
        <label className={s.wide}>
          Navn
          <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Leverandør
          <select className={s.input} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {catalog.suppliers.map((sup) => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
          </select>
        </label>
        <label>
          Kategori
          <select className={s.input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Velg …</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.parentId ? `  ↳ ${c.name}` : c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Enhet
          <select className={s.input} value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option>stk</option>
            <option>panel</option>
            <option>m</option>
            <option>system</option>
          </select>
        </label>
        <label>
          Innkjøpspris eks. mva. (kr)
          <input className={s.input} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className={s.wide}>
          Lenke til produktark (valgfritt)
          <input className={s.input} value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://" />
        </label>
        <div className={`${s.wide} ${s.rowactions}`}>
          <button className={`${s.btn} ${s.primary}`} disabled={saving || !name.trim() || !categoryId || !supplierId} onClick={submit}>
            {saving ? "Lagrer …" : "Legg til produkt"}
          </button>
        </div>
      </div>
    </section>
  );
}
