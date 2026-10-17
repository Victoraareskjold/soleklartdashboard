"use client";

// Intern oppstilling for et signert tilbud: kundens endelige valg, innkjøp (inkl. BMS),
// installatørens påslag og endelig Soleklart-kommisjon med tilleggene.
// Tallene kommer fra kalkulatortjenesten (låst versjon + valget som ble lagret ved signering).
import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { getEstimateBreakdown, type SignedBreakdown } from "@/lib/calcApi";

const kr = (ore: number | null | undefined) =>
  ore == null ? "—" : `${Math.round(ore / 100).toLocaleString("nb-NO")} kr`;
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} %`);

const MODE_LABEL: Record<SignedBreakdown["selection"]["mode"], string> = {
  solar: "Solcelleanlegg (standard)",
  hybrid: "Klargjort for batteri (hybridinverter)",
  battery: "Solceller + batteri",
};

export default function SignedBreakdownPanel({ estimateId }: { estimateId: string }) {
  const [data, setData] = useState<SignedBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEstimateBreakdown(estimateId)
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [estimateId]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <Receipt size={15} className="text-brand" />
        <h3 className="text-sm font-semibold text-ink">Signert avtale · intern oppstilling</h3>
        <span className="text-xs text-muted">Vises ikke for kunden</span>
      </div>
      {error && <p className="px-4 py-3 text-sm text-red-700">Kunne ikke hente oppstillingen: {error}</p>}
      {!data && !error && <p className="px-4 py-3 text-sm text-muted">Henter …</p>}
      {data && (
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <p className="mb-2 text-sm">
              <strong>Kundens valg:</strong> {MODE_LABEL[data.selection.mode]}
              {data.selection.mode === "battery" && data.capacityKwh > 0 ? ` · ${data.capacityKwh.toLocaleString("nb-NO")} kWh` : ""}
              {data.signedAt ? (
                <span className="text-muted"> · signert {new Date(data.signedAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}</span>
              ) : (
                <span className="text-muted"> · ikke signert ennå</span>
              )}
            </p>
            <table className="w-full text-xs tabular-nums">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-1.5">Post</th>
                  <th className="py-1.5 text-right">Antall</th>
                  <th className="py-1.5 text-right">Innkjøp</th>
                  <th className="py-1.5 text-right">Påslag inst.</th>
                  <th className="py-1.5 text-right">Salg inst.</th>
                  <th className="py-1.5 text-right">Soleklart</th>
                  <th className="py-1.5 text-right">Kunde eks. mva.</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100 font-medium">
                  <td className="py-1.5">Solcelleanlegg (grunnpakke)</td>
                  <td className="py-1.5 text-right">1</td>
                  <td className="py-1.5 text-right">{kr(data.base.supplierCostOre)}</td>
                  <td className="py-1.5 text-right text-muted">se linjer</td>
                  <td className="py-1.5 text-right">{kr(data.base.subtotalOre)}</td>
                  <td className="py-1.5 text-right">{kr(data.base.commissionOre)}</td>
                  <td className="py-1.5 text-right">{kr(data.base.totalExVatOre)}</td>
                </tr>
                {data.extras.map((x) => (
                  <tr key={x.label} className="border-t border-gray-100">
                    <td className="py-1.5">{x.label}</td>
                    <td className="py-1.5 text-right">{x.quantity}</td>
                    <td className="py-1.5 text-right">{kr(x.purchaseOre)}</td>
                    <td className="py-1.5 text-right">{kr(x.installerMarkupOre)}</td>
                    <td className="py-1.5 text-right">{kr(x.saleOre)}</td>
                    <td className="py-1.5 text-right">{kr(x.soleklartOre)}</td>
                    <td className="py-1.5 text-right">{kr(x.customerOre)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line font-semibold">
                  <td className="py-1.5" colSpan={5}>
                    Totalt
                  </td>
                  <td className="py-1.5 text-right">{kr(data.commissionOre)}</td>
                  <td className="py-1.5 text-right">{kr(data.totalExVatOre)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="space-y-1.5 rounded-lg bg-gray-50 p-3 text-sm">
            <Row label="Endelig Soleklart-kommisjon" value={kr(data.commissionOre)} strong />
            <Row label="· av grunnpakken" value={kr(data.base.commissionOre)} />
            <Row label="· av tilleggene" value={kr(data.extrasSoleklartOre)} />
            <Row label="Soleklart-sats" value={pct(data.commissionRate * 100)} />
            <Row label="Påslag batteri/hybrid (installatør)" value={pct(data.materialMarkupPercent)} />
            <Row label="Kundepris eks. mva." value={kr(data.totalExVatOre)} />
            <Row label="Kundepris inkl. mva." value={kr(data.totalIncVatOre)} strong />
            <p className="pt-1 text-[11px] text-muted">
              Prisgrunnlag og satser er låst i tilbudsversjon {data.version} ({new Date(data.versionCreatedAt).toLocaleDateString("nb-NO")}). Endringer i katalog
              eller prisavtaler etterpå påvirker ikke denne avtalen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "font-semibold text-ink" : "text-muted"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
