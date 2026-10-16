"use client";

// «Info om anlegget» ved siden av kalkulatoren når et estimat lages.
// Viser dataene fra solkartet (pvmap) slik den gamle kalkulatoren gjorde: kWp, årsproduksjon,
// selvprodusert andel og Enova-støtte, oppdatert når panelantall eller paneltype endres i kalkylen.
import type { SolarData } from "../SolarDataView";

interface Props {
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

export default function EstimateFacilityInfo({
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
    <aside className="h-fit overflow-hidden rounded-xl border border-line bg-surface xl:sticky xl:top-4">
      <div className="border-b border-line bg-gray-50/60 px-3 py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Info om anlegget</h3>
        {!hasMapData && <p className="mt-0.5 text-[11px] text-muted">Ingen data fra solkartet ennå</p>}
      </div>

      <Row label="kWp">{fmt(kwp, 2)}</Row>
      <Row label="Paneler">{fmt(solarData.totalPanels)}</Row>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-1.5">
        <span className="text-xs font-medium text-muted">Årlig kWh produksjon</span>
        <span className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            className="h-7 w-24 rounded-md border border-transparent bg-transparent px-1.5 text-right text-sm font-semibold tabular-nums text-ink hover:border-line hover:bg-white focus:border-gray-300 focus:bg-white"
            value={Math.round(yearlyProd) || ""}
            placeholder="0"
            aria-label="Årlig kWh produksjon"
            onChange={(e) => onProdOverride(e.target.value === "" ? null : Number(e.target.value))}
          />
        </span>
      </div>
      {prodOverride != null && (
        <button type="button" className="w-full px-3 py-1 text-right text-[11px] text-brand underline" onClick={() => onProdOverride(null)}>
          Følg kalkylen ({fmt(solarData.yearlyProd)} kWh)
        </button>
      )}
      <Row label="kWh per kWp" hint="Spesifikk produksjon fra solkartet">{fmt(specific)}</Row>
      <Row label="Eget forbruk">{ownConsumption ? `${fmt(ownConsumption)} kWh` : "—"}</Row>
      <Row label="Selvprodusert">{selfProduced == null ? "—" : `${fmt(selfProduced, 1)} %`}</Row>
      {solarData.desiredKwh ? <Row label="Ønsket kWh">{fmt(solarData.desiredKwh)}</Row> : null}
      {solarData.coveragePercentage ? <Row label="Dekningsgrad">{`${fmt(solarData.coveragePercentage, 0)} %`}</Row> : null}
      {solarData.selectedElPrice ? <Row label="Strømpris">{`${fmt(solarData.selectedElPrice, 2)} kr/kWh`}</Row> : null}
      {solarData.yearlyCost ? <Row label="Årlig besparelse">{`${fmt(solarData.yearlyCost)} kr`}</Row> : null}
      {solarData.selectedRoofType ? <Row label="Taktype">{solarData.selectedRoofType}</Row> : null}
      {solarData.voltage ? <Row label="Spenning">{`${solarData.voltage} V`}</Row> : null}
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
