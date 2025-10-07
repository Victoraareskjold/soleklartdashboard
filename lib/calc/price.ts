import { PriceRow, PriceTableRowComputed } from "@/types/priece";

export function calculateRow(row: PriceRow): PriceTableRowComputed {
  const carp = Number(row.carpenterCostPerPanel || 0);
  const pct = Number(row.installerGroupMarkupPercent || 0);

  const installerGroupMarkupKr = +(carp * (pct / 100));
  const totalExVar = +(carp + installerGroupMarkupKr);
  const totalInclVat = +(totalExVar * 1.25);

  return {
    ...row,
    installerGroupMarkupKr: Number(installerGroupMarkupKr.toFixed(2)),
    totalExVat: Number(totalExVar.toFixed(2)),
    totalInclVat: Number(totalInclVat.toFixed(2)),
  };
}

export function calculateAll(rows: PriceRow[]) {
  return rows.map(calculateRow);
}
