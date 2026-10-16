"use client";

// Nytt eller endre produkt, med produktdata som brukes i beregningene.
import { useState } from "react";
import { toast } from "react-toastify";
import {
  createProduct,
  createSupplier,
  oreToInput,
  parseKroner,
  updateProduct,
  type CalcCatalog,
  type CalcProduct,
  type ProductKind,
  type ProductSpecs,
} from "@/lib/calcApi";
import { Dialog } from "./Dialog";
import { Help } from "./fields";
import s from "./kalkulator.module.css";

export const KIND_LABELS: Record<ProductKind, string> = {
  panel: "Solcellepanel (teller i kWp og panelantall)",
  feste: "Festesystem",
  inverter: "Inverter (velges automatisk)",
  batteri: "Batteri (krever hybridinverter)",
  frakt: "Frakt",
  stillase: "Stillas",
  ballastein: "Ballast",
  annet: "Vanlig produkt (ingen spesialregel)",
};

const numOrUndef = (v: string) => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) || n <= 0 ? undefined : n;
};
const str = (n?: number) => (n == null ? "" : String(n).replace(".", ","));

export function specsSummary(kind: ProductKind | undefined, sp: ProductSpecs) {
  if (kind === "panel") return sp.wp ? `${sp.wp} Wp` : "Wp mangler";
  if (kind === "inverter") {
    if (!sp.acKw) return "kW mangler";
    return [`${str(sp.acKw)} kW`, sp.grid ? `${sp.grid === "begge" ? "230/400" : sp.grid} V` : "nett mangler", sp.phases === 1 ? "1-fase" : null, sp.hybrid ? `hybrid${sp.batteryClass ? ` ${sp.batteryClass}` : ""}` : null]
      .filter(Boolean)
      .join(" · ");
  }
  if (kind === "batteri") return [sp.capacityKwh ? `${str(sp.capacityKwh)} kWh` : null, sp.batteryClass ? `${sp.batteryClass}` : null].filter(Boolean).join(" · ");
  return sp.powerKw ? `${str(sp.powerKw)} kW` : "";
}

export function ProductDialog({ catalog, product, onClose, onSaved }: { catalog: CalcCatalog; product?: CalcProduct; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [supplierId, setSupplierId] = useState(product?.supplierId ?? catalog.suppliers.find((x) => x.active)?.id ?? "");
  const [newSupplier, setNewSupplier] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "stk");
  const [price, setPrice] = useState(product ? oreToInput(product.priceOre) : "");
  const [attachmentUrl, setAttachmentUrl] = useState(product?.attachmentUrl ?? "");
  const sp0 = product?.specs ?? {};
  const [wp, setWp] = useState(str(sp0.wp));
  const [acKw, setAcKw] = useState(str(sp0.acKw));
  const [maxPvKwp, setMaxPvKwp] = useState(str(sp0.maxPvKwp));
  const [grid, setGrid] = useState(sp0.grid ?? "");
  const [phases, setPhases] = useState(String(sp0.phases ?? 3));
  const [hybrid, setHybrid] = useState(!!sp0.hybrid);
  const [batteryClass, setBatteryClass] = useState(sp0.batteryClass ?? "");
  const [capacityKwh, setCapacityKwh] = useState(str(sp0.capacityKwh));
  const [powerKw, setPowerKw] = useState(str(sp0.powerKw));
  const [saving, setSaving] = useState(false);

  const category = catalog.categories.find((c) => c.id === categoryId);
  const kind = category?.productKind;
  const options = catalog.categories.filter((c) => !c.parentId).flatMap((top) => [top, ...catalog.categories.filter((c) => c.parentId === top.id)]);

  const buildSpecs = (): ProductSpecs => {
    // Beholder ukjente felt, men fjerner "derived" fordi dataene nå er kontrollert/lagret av en person
    const rest = { ...sp0 };
    for (const k of ["wp", "acKw", "maxPvKwp", "grid", "phases", "hybrid", "batteryClass", "capacityKwh", "powerKw", "derived"]) delete rest[k];
    if (kind === "panel") return { ...rest, wp: numOrUndef(wp) };
    if (kind === "inverter")
      return {
        ...rest,
        acKw: numOrUndef(acKw),
        maxPvKwp: numOrUndef(maxPvKwp),
        grid: (grid || undefined) as ProductSpecs["grid"],
        phases: phases === "1" ? 1 : 3,
        hybrid,
        batteryClass: hybrid && batteryClass ? (batteryClass as "HV" | "LV") : undefined,
      };
    if (kind === "batteri") return { ...rest, capacityKwh: numOrUndef(capacityKwh), batteryClass: (batteryClass || undefined) as ProductSpecs["batteryClass"] };
    return { ...rest, powerKw: numOrUndef(powerKw) };
  };

  const submit = async () => {
    setSaving(true);
    try {
      let sid = supplierId;
      if (newSupplier !== null) {
        if (!newSupplier.trim()) throw new Error("Skriv navnet på den nye leverandøren");
        sid = (await createSupplier(newSupplier.trim())).id;
      }
      const kroner = parseKroner(price);
      if (kroner === null) throw new Error("Pris mangler");
      const body = { name: name.trim(), supplierId: sid, categoryId, unit, price: kroner, attachmentUrl: attachmentUrl.trim() || null, specs: JSON.parse(JSON.stringify(buildSpecs())) };
      if (product) await updateProduct(product.id, body);
      else await createProduct(body);
      toast.success(product ? "Produkt oppdatert" : "Produkt lagt til");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      title={product ? "Rediger produkt" : "Nytt produkt"}
      onClose={onClose}
      footer={
        <button className={`${s.btn} ${s.primary}`} disabled={saving || !name.trim() || !categoryId || (!supplierId && newSupplier === null)} onClick={submit}>
          {saving ? "Lagrer …" : product ? "Lagre endringer" : "Legg til produkt"}
        </button>
      }
    >
      {product?.specs.derived && (
        <div className={s.notice}>Produktdataene er hentet fra produktnavnet ved import. Kontroller dem og lagre, så regnes de som bekreftet.</div>
      )}
      <div className={`${s.fields} ${s.two}`}>
        <label className={s.wide}>
          Navn
          <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Leverandør
          {newSupplier === null ? (
            <select
              className={s.input}
              value={supplierId}
              onChange={(e) => (e.target.value === "__new" ? setNewSupplier("") : setSupplierId(e.target.value))}
            >
              {catalog.suppliers.filter((x) => x.active || x.id === supplierId).map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
              <option value="__new">+ Ny leverandør …</option>
            </select>
          ) : (
            <span className={s.inputwrap}>
              <input className={s.input} autoFocus placeholder="Navn på ny leverandør" value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} />
              <button className={`${s.btn} ${s.small2}`} onClick={() => setNewSupplier(null)}>Avbryt</button>
            </span>
          )}
        </label>
        <label>
          Kategori
          <select className={s.input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Velg …</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>{c.parentId ? `   ↳ ${c.name}` : c.name}</option>
            ))}
          </select>
        </label>
        <label>
          Enhet
          <select className={s.input} value={unit} onChange={(e) => setUnit(e.target.value)}>
            {[...new Set([unit, "stk", "panel", "m", "system", "sett"])].map((u) => (
              <option key={u}>{u}</option>
            ))}
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
      </div>

      {category && (
        <>
          <hr className={s.subtleline} />
          <p className={s.rulehelp}>
            <strong>Produktdata</strong> · Kategorien har rollen «{KIND_LABELS[category.productKind]}». Feltene under brukes i beregningene.
          </p>
          <div className={`${s.fields} ${s.two}`}>
            {kind === "panel" && (
              <label>
                <span>Effekt per panel (Wp) <Help text="Brukes til anleggets kWp og Enova-støtte." /></span>
                <input className={s.input} inputMode="numeric" value={wp} onChange={(e) => setWp(e.target.value)} />
              </label>
            )}
            {kind === "inverter" && (
              <>
                <label>
                  <span>Nominell AC-effekt (kW) <Help text="Sammenlignes med kWp ÷ dimensjoneringsfaktor ved automatisk valg." /></span>
                  <input className={s.input} inputMode="decimal" value={acKw} onChange={(e) => setAcKw(e.target.value)} />
                </label>
                <label>
                  Strømnett
                  <select className={s.input} value={grid} onChange={(e) => setGrid(e.target.value as typeof grid)}>
                    <option value="">Ikke oppgitt (velges aldri automatisk)</option>
                    <option value="230">230 V (IT/TT)</option>
                    <option value="400">400 V (TN)</option>
                    <option value="begge">Begge</option>
                  </select>
                </label>
                <label>
                  Faser
                  <select className={s.input} value={phases} onChange={(e) => setPhases(e.target.value)}>
                    <option value="3">3-fase</option>
                    <option value="1">1-fase (velges ikke automatisk)</option>
                  </select>
                </label>
                <label>
                  <span>Maks PV-effekt (kWp, valgfritt) <Help text="Fra produsentens datablad. Er den oppgitt, velges inverteren bare når anlegget er innenfor." /></span>
                  <input className={s.input} inputMode="decimal" value={maxPvKwp} onChange={(e) => setMaxPvKwp(e.target.value)} />
                </label>
                <label className={s.check}>
                  <input type="checkbox" checked={hybrid} onChange={(e) => setHybrid(e.target.checked)} /> Hybridinverter (kan brukes med batteri)
                </label>
                {hybrid && (
                  <label>
                    Batteritype
                    <select className={s.input} value={batteryClass} onChange={(e) => setBatteryClass(e.target.value as typeof batteryClass)}>
                      <option value="">Ikke oppgitt</option>
                      <option value="HV">HV (høyvolt)</option>
                      <option value="LV">LV (lavvolt)</option>
                    </select>
                  </label>
                )}
              </>
            )}
            {kind === "batteri" && (
              <>
                <label>
                  Kapasitet (kWh)
                  <input className={s.input} inputMode="decimal" value={capacityKwh} onChange={(e) => setCapacityKwh(e.target.value)} />
                </label>
                <label>
                  <span>Batteritype <Help text="Hybridinverteren må ha samme type (HV/LV)." /></span>
                  <select className={s.input} value={batteryClass} onChange={(e) => setBatteryClass(e.target.value as typeof batteryClass)}>
                    <option value="">Ikke oppgitt</option>
                    <option value="HV">HV (høyvolt)</option>
                    <option value="LV">LV (lavvolt)</option>
                  </select>
                </label>
              </>
            )}
            {kind && !["panel", "inverter", "batteri"].includes(kind) && (
              <label>
                <span>Effekt (kW, valgfritt) <Help text="Vises bare som produktdata, f.eks. for en DC-lader. Regnes ikke som solcelleanleggets kWp." /></span>
                <input className={s.input} inputMode="decimal" value={powerKw} onChange={(e) => setPowerKw(e.target.value)} />
              </label>
            )}
          </div>
        </>
      )}
    </Dialog>
  );
}
