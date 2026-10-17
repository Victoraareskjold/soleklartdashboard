"use client";

// «Kunde og anlegg» ved siden av kalkulatoren når et estimat lages.
// Kundeinfo (person og teknisk) fra leaden øverst, så anleggsdata fra solkartet.
// Viser dataene fra solkartet (pvmap) slik den gamle kalkulatoren gjorde: kWp, årsproduksjon,
// selvprodusert andel og Enova-støtte, oppdatert når panelantall eller paneltype endres i kalkylen.
import type { SolarData } from "../SolarDataView";

/** Kundeinfo fra leaden */
export interface LeadCustomerInfo {
  name?: string;
  company?: string;
  orgNr?: string;
  address?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  voltage?: number | null;
  phases?: number | null;
  mainFuse?: number | null;
  roofType?: string;
  roofSlope?: number | null;
  roofAge?: number | null;
}

interface Props {
  customer?: LeadCustomerInfo;
  /** Solkartdata justert til kalkylen (kWp og årsproduksjon følger panelantallet) */
  solarData: SolarData;
  /** Årsproduksjon fra solkartet før justering, for å vise kWh per kWp */
  originalYearlyProd?: number;
  originalKwp?: number;
  /** Manuell årsproduksjon, null = følg kalkylen */
  prodOverride: number | null;
  onProdOverride: (value: number | null) => void;
  ownConsumption?: number | null;
  /** Støtte fra kalkylen i kroner (auto/manuell), null = ikke beregnet */
  support: number | null;
  business: boolean;
}

const fmt = (n: number | undefined | null, d = 0) =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("nb-NO", { minimumFractionDigits: d, maximumFractionDigits: d });

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 px-3 py-2 last:border-0" title={hint}>
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="text-right text-sm font-semibold tabular-nums text-ink">{children}</span>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <p className="border-y border-line bg-gray-50/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{title}</p>;
}

export default function EstimateFacilityInfo({
  customer,
  solarData,
  originalYearlyProd,
  originalKwp,
  prodOverride,
  onProdOverride,
  ownConsumption,
  support,
  business,
}: Props) {
  const yearlyProd = prodOverride ?? solarData.yearlyProd ?? 0;
  const kwp = solarData.kwp ?? 0;
  const specific = originalKwp && originalYearlyProd ? originalYearlyProd / originalKwp : kwp > 0 ? yearlyProd / kwp : null;
  const selfProduced = ownConsumption ? (yearlyProd / ownConsumption) * 100 : null;
  const enova = support ?? (business ? 0 : Math.min(kwp, 15) * 2500);
  const roofs = solarData.checkedRoofData ?? [];
  const hasMapData = Boolean(solarData.yearlyProd);

  return (
    <aside className="h-fit overflow-hidden rounded-xl border-2 border-blue-200 bg-surface xl:sticky xl:top-4">
      <div className="bg-brand-soft px-3 py-2.5">
        <h3 className="text-sm font-semibold text-brand">Kunde og anlegg</h3>
        {!hasMapData && <p className="mt-0.5 text-[11px] text-muted">Ingen data fra solkartet ennå</p>}
      </div>

      {customer && (
        <>
          <div className="space-y-0.5 px-3 py-2 text-sm text-ink">
            {customer.name && <p className="font-semibold">{customer.name}</p>}
            {customer.company && (
              <p className="font-semibold">
                {customer.company}
                {customer.orgNr ? <span className="font-normal text-muted"> · org.nr. {customer.orgNr}</span> : null}
              </p>
            )}
            {customer.address && <p className="text-xs text-muted">{customer.address}</p>}
            {customer.email && <p className="truncate text-xs text-muted" title={customer.email}>{customer.email}</p>}
            {(customer.phone || customer.mobile) && (
              <p className="text-xs text-muted">{[customer.mobile, customer.phone].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <Section title="Teknisk" />
          <Row label="Strømnett">
            {customer.voltage ? `${customer.voltage} V${customer.voltage === 400 ? " (TN)" : " (IT/TT)"}` : "—"}
          </Row>
          <Row label="Faser">{customer.phases ? `${customer.phases}-fase` : "—"}</Row>
          <Row label="Hovedsikring">{customer.mainFuse ? `${customer.mainFuse} A` : "—"}</Row>
          {customer.roofType ? <Row label="Taktype (lead)">{customer.roofType}</Row> : null}
          {customer.roofSlope ? <Row label="Takvinkel">{`${fmt(customer.roofSlope)}°`}</Row> : null}
          {customer.roofAge ? <Row label="Takets alder">{`${fmt(customer.roofAge)} år`}</Row> : null}
          <Section title="Anlegget" />
        </>
      )}

      <div className="border-b border-gray-100 bg-amber-50/60 px-3 py-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink">Årsproduksjon (kWh)</span>
          <input
            type="number"
            min={0}
            className="h-9 w-full rounded-md border border-line bg-white px-2 text-right text-base font-semibold tabular-nums text-ink focus:border-brand"
            value={Math.round(yearlyProd) || ""}
            placeholder="0"
            aria-label="Årsproduksjon i kWh"
            onChange={(e) => onProdOverride(e.target.value === "" ? null : Number(e.target.value))}
          />
          <span className="text-[11px] text-muted">
            Brukes i produksjon, besparelse og nedbetaling på tilbudet.
            {prodOverride != null ? " Endret for hånd." : " Følger kalkylen (solkartet × kWp)."}
          </span>
        </label>
        {prodOverride != null && (
          <button type="button" className="mt-1 text-[11px] text-brand underline" onClick={() => onProdOverride(null)}>
            Følg kalkylen ({fmt(solarData.yearlyProd)} kWh)
          </button>
        )}
      </div>
      <Row label="kWp">{fmt(kwp, 2)}</Row>
      <Row label="Paneler">{fmt(solarData.totalPanels)}</Row>
      <Row label="kWh per kWp" hint="Spesifikk produksjon fra solkartet">{fmt(specific)}</Row>
      <Row label="Eget forbruk">{ownConsumption ? `${fmt(ownConsumption)} kWh` : "—"}</Row>
      <Row label="Selvprodusert">{selfProduced == null ? "—" : `${fmt(selfProduced, 1)} %`}</Row>
      {solarData.desiredKwh ? <Row label="Ønsket kWh">{fmt(solarData.desiredKwh)}</Row> : null}
      {solarData.coveragePercentage ? <Row label="Dekningsgrad">{`${fmt(solarData.coveragePercentage, 0)} %`}</Row> : null}
      {solarData.selectedElPrice ? <Row label="Strømpris">{`${fmt(solarData.selectedElPrice, 2)} kr/kWh`}</Row> : null}
      {solarData.yearlyCost ? <Row label="Årlig besparelse">{`${fmt(solarData.yearlyCost)} kr`}</Row> : null}
      {solarData.selectedRoofType ? <Row label="Taktype">{solarData.selectedRoofType}</Row> : null}
      {!customer && solarData.voltage ? <Row label="Spenning">{`${solarData.voltage} V`}</Row> : null}
      <Row label={support != null ? "Støtte (kalkylen)" : "Enova-støtte"}>{`${fmt(enova)} kr`}</Row>

      {roofs.length > 0 && (
        <div className="border-t border-line">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Takflater</p>
          {roofs.map((r, i) => (
            <div key={`${r.roofId}-${i}`} className="flex justify-between gap-2 px-3 py-1 text-xs tabular-nums text-ink">
              <span className="text-muted">Tak {r.roofId || i + 1}</span>
              <span>
                {r.adjustedPanelCount ?? r.maxPanels} pnl · {fmt(Number(r.angle))}° · {r.direction}
              </span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
