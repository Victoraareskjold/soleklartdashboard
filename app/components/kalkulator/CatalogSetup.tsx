"use client";

// Kategorier (med regler), leverandører og påslagsgrupper. Kun admin kan endre.
import { useState } from "react";
import { toast } from "react-toastify";
import {
  createCategory,
  createMarkupGroup,
  createSupplier,
  renameMarkupGroup,
  updateCategory,
  updateSupplier,
  type CalcCatalog,
  type CalcCategory,
  type CategoryInput,
  type ProductKind,
} from "@/lib/calcApi";
import { Dialog } from "./Dialog";
import { Help } from "./fields";
import { KIND_LABELS } from "./ProductDialog";
import s from "./kalkulator.module.css";

const run = async (action: () => Promise<unknown>, reload: () => Promise<void>, ok?: string) => {
  try {
    await action();
    if (ok) toast.success(ok);
    await reload();
  } catch (e) {
    toast.error((e as Error).message);
  }
};

export function CatalogSetup({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const [categoryDialog, setCategoryDialog] = useState<null | { parent?: CalcCategory }>(null);
  const tops = catalog.categories.filter((c) => !c.parentId);
  const groupName = (code: string) => catalog.markupGroups.find((g) => g.code === code)?.name ?? code;
  const count = (id: string) =>
    catalog.products.filter((p) => p.active && (p.categoryId === id || catalog.categories.find((c) => c.id === p.categoryId)?.parentId === id)).length;

  return (
    <>
      {!edit && <div className={`${s.notice} ${s.info}`}>Du kan se oppsettet, men bare admin kan endre det.</div>}

      <section className={s.panel}>
        <div className={s.panelhead}>
          <div>
            <h2>Kategorier og regler</h2>
            <span className={`${s.small} ${s.muted}`}>Reglene settes på hovedkategorien og gjelder alle produktene i den.</span>
          </div>
          {edit && (
            <button className={`${s.btn} ${s.primary}`} onClick={() => setCategoryDialog({})}>
              + Ny kategori
            </button>
          )}
        </div>
        <div className={s.tablewrap}>
          <table>
            <thead>
              <tr>
                <th>Kategori</th>
                <th>
                  Rolle i beregningen <Help text="Bestemmer spesialregler: paneler gir kWp, inverter velges automatisk, batteri krever hybrid. Nye produktområder som DC-ladere bruker «Vanlig produkt»." />
                </th>
                <th>
                  Påslag <Help text="Hvilket påslag installatøren får på produktene. Satsen per installatør settes under Prisavtaler." />
                </th>
                <th>
                  Mengde <Help text="«Følger panelantallet» betyr at mengden oppdateres når antall paneler endres (f.eks. feste)." />
                </th>
                <th>
                  Støtte <Help text="Kostnaden regnes med i grunnlaget for solcellestøtte (Enova) for privatkunder." />
                </th>
                <th className={s.num}>Produkter</th>
                {edit && <th />}
              </tr>
            </thead>
            <tbody>
              {tops.map((c) => (
                <CategoryRows key={c.id} category={c} catalog={catalog} edit={edit} reload={reload} count={count} groupName={groupName} onAddSub={() => setCategoryDialog({ parent: c })} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={s.grid}>
        <SuppliersPanel catalog={catalog} reload={reload} />
        <MarkupGroupsPanel catalog={catalog} reload={reload} />
      </div>

      {categoryDialog && (
        <CategoryDialog
          catalog={catalog}
          parent={categoryDialog.parent}
          onClose={() => setCategoryDialog(null)}
          onSaved={() => {
            setCategoryDialog(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function CategoryRows({
  category: c,
  catalog,
  edit,
  reload,
  count,
  groupName,
  onAddSub,
}: {
  category: CalcCategory;
  catalog: CalcCatalog;
  edit: boolean;
  reload: () => Promise<void>;
  count: (id: string) => number;
  groupName: (code: string) => string;
  onAddSub: () => void;
}) {
  const subs = catalog.categories.filter((x) => x.parentId === c.id);
  const set = (patch: Partial<CategoryInput>) => run(() => updateCategory(c.id, patch), reload, "Kategori oppdatert");
  return (
    <>
      <tr>
        <td>
          {edit ? <NameInput value={c.name} onSave={(name) => set({ name })} /> : <strong className={s.productname}>{c.name}</strong>}
        </td>
        <td className={s.small}>
          {edit ? (
            <select className={s.input} value={c.productKind} onChange={(e) => set({ productKind: e.target.value as ProductKind })}>
              {Object.entries(KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          ) : (
            KIND_LABELS[c.productKind]
          )}
        </td>
        <td className={s.small}>
          {edit ? (
            <select className={s.input} value={c.markupGroup} onChange={(e) => set({ markupGroup: e.target.value })}>
              {catalog.markupGroups.map((g) => (
                <option key={g.code} value={g.code}>{g.name}</option>
              ))}
            </select>
          ) : (
            groupName(c.markupGroup)
          )}
        </td>
        <td className={s.small}>
          {edit ? (
            <select className={s.input} value={c.quantityRule} onChange={(e) => set({ quantityRule: e.target.value as CategoryInput["quantityRule"] })}>
              <option value="manual">Settes manuelt</option>
              <option value="per_panel">Følger panelantallet</option>
            </select>
          ) : c.quantityRule === "per_panel" ? (
            "Følger panelantallet"
          ) : (
            "Manuelt"
          )}
        </td>
        <td className={s.small}>
          {edit ? (
            <label className={s.check}>
              <input type="checkbox" checked={c.supportEligible} onChange={(e) => set({ supportEligible: e.target.checked })} /> Med
            </label>
          ) : c.supportEligible ? (
            "Med"
          ) : (
            "Ikke med"
          )}
        </td>
        <td className={s.num}>{count(c.id)}</td>
        {edit && (
          <td className={s.rowactions2}>
            <button className={`${s.btn} ${s.small2}`} onClick={onAddSub}>+ Underkategori</button>
          </td>
        )}
      </tr>
      {subs.map((sub) => (
        <tr key={sub.id}>
          <td className={s.small}>
            <span className={s.muted}>↳ </span>
            {edit ? <NameInput value={sub.name} onSave={(name) => run(() => updateCategory(sub.id, { name }), reload, "Underkategori oppdatert")} /> : sub.name}
          </td>
          <td className={`${s.small} ${s.muted}`} colSpan={4}>Arver reglene fra {c.name}</td>
          <td className={s.num}>{catalog.products.filter((p) => p.active && p.categoryId === sub.id).length}</td>
          {edit && <td />}
        </tr>
      ))}
    </>
  );
}

function NameInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <input
      className={s.input}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() && text !== value && onSave(text.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function CategoryDialog({ catalog, parent, onClose, onSaved }: { catalog: CalcCatalog; parent?: CalcCategory; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [productKind, setProductKind] = useState<ProductKind>("annet");
  const [markupGroup, setMarkupGroup] = useState(catalog.markupGroups[0]?.code ?? "");
  const [quantityRule, setQuantityRule] = useState<CategoryInput["quantityRule"]>("manual");
  const [supportEligible, setSupportEligible] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      title={parent ? `Ny underkategori i ${parent.name}` : "Ny kategori"}
      onClose={onClose}
      footer={
        <button
          className={`${s.btn} ${s.primary}`}
          disabled={saving || !name.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await createCategory({ name: name.trim(), parentId: parent?.id ?? null, productKind, markupGroup, quantityRule, supportEligible });
              toast.success(`Kategorien «${name.trim()}» er opprettet. Den er nå valgbar for nye produkter.`);
              onSaved();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          Opprett kategori
        </button>
      }
    >
      <div className={`${s.fields} ${s.two}`}>
        <label className={s.wide}>
          Navn
          <input className={s.input} autoFocus placeholder="F.eks. DC-ladere" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {parent ? (
          <p className={`${s.small} ${s.muted} ${s.wide}`}>Underkategorien arver reglene fra {parent.name}.</p>
        ) : (
          <>
            <label>
              Rolle i beregningen
              <select className={s.input} value={productKind} onChange={(e) => setProductKind(e.target.value as ProductKind)}>
                {Object.entries(KIND_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              Påslagsgruppe
              <select className={s.input} value={markupGroup} onChange={(e) => setMarkupGroup(e.target.value)}>
                {catalog.markupGroups.map((g) => (
                  <option key={g.code} value={g.code}>{g.name}</option>
                ))}
              </select>
            </label>
            <label>
              Mengde
              <select className={s.input} value={quantityRule} onChange={(e) => setQuantityRule(e.target.value as CategoryInput["quantityRule"])}>
                <option value="manual">Settes manuelt</option>
                <option value="per_panel">Følger panelantallet</option>
              </select>
            </label>
            <label className={s.check}>
              <input type="checkbox" checked={supportEligible} onChange={(e) => setSupportEligible(e.target.checked)} /> Med i grunnlaget for solcellestøtte
            </label>
          </>
        )}
      </div>
      {!parent && (
        <p className={s.rulehelp} style={{ marginTop: 12 }}>
          Eksempel: DC-ladere → rolle «Vanlig produkt», egen påslagsgruppe «DC-ladere» (opprett den under Påslagsgrupper først), mengde manuelt, ikke med i solcellestøtte.
        </p>
      )}
    </Dialog>
  );
}

function SuppliersPanel({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const [name, setName] = useState("");
  return (
    <section className={s.panel}>
      <div className={s.panelhead}>
        <h2>Leverandører</h2>
      </div>
      <table>
        <tbody>
          {catalog.suppliers.map((x) => (
            <tr key={x.id} className={x.active ? "" : s.hiddenrow}>
              <td>{edit ? <NameInput value={x.name} onSave={(n) => run(() => updateSupplier(x.id, { name: n }), reload, "Leverandør oppdatert")} /> : x.name}</td>
              <td className={s.num}>{catalog.products.filter((p) => p.supplierId === x.id && p.active).length} produkter</td>
              {edit && (
                <td className={s.rowactions2}>
                  <button className={`${s.btn} ${s.small2}`} onClick={() => run(() => updateSupplier(x.id, { active: !x.active }), reload)}>
                    {x.active ? "Skjul" : "Vis igjen"}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {edit && (
        <div className={`${s.footerbar}`}>
          <input className={s.input} style={{ flex: 1 }} placeholder="Navn på ny leverandør" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className={`${s.btn} ${s.primary}`}
            disabled={!name.trim()}
            onClick={() => run(() => createSupplier(name.trim()), reload, `Leverandøren «${name.trim()}» er lagt til`).then(() => setName(""))}
          >
            + Ny leverandør
          </button>
        </div>
      )}
    </section>
  );
}

function MarkupGroupsPanel({ catalog, reload }: { catalog: CalcCatalog; reload: () => Promise<void> }) {
  const edit = catalog.canEdit;
  const [name, setName] = useState("");
  return (
    <section className={s.panel}>
      <div className={s.panelhead}>
        <div>
          <h2>Påslagsgrupper</h2>
          <span className={`${s.small} ${s.muted}`}>Satsen per installatør settes under Prisavtaler.</span>
        </div>
      </div>
      <table>
        <tbody>
          {catalog.markupGroups.map((g) => (
            <tr key={g.code}>
              <td>{edit ? <NameInput value={g.name} onSave={(n) => run(() => renameMarkupGroup(g.code, n), reload, "Påslagsgruppe oppdatert")} /> : g.name}</td>
              <td className={`${s.small} ${s.muted}`}>{catalog.categories.filter((c) => !c.parentId && c.markupGroup === g.code).map((c) => c.name).join(", ") || (g.code === "elektro" ? "Arbeid" : g.code === "montering" ? "Montering" : "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {edit && (
        <div className={s.footerbar}>
          <input className={s.input} style={{ flex: 1 }} placeholder="F.eks. DC-ladere" value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className={`${s.btn} ${s.primary}`}
            disabled={!name.trim()}
            onClick={() => run(() => createMarkupGroup(name.trim()), reload, `Påslagsgruppen «${name.trim()}» er lagt til. Sett påslag per installatør under Prisavtaler.`).then(() => setName(""))}
          >
            + Ny påslagsgruppe
          </button>
        </div>
      )}
    </section>
  );
}
