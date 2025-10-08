import { PriceRow, PriceTableRowComputed } from "@/types/price";

type ExtendedRow = PriceRow & {
  costPer?: number;
  baseCost?: number;
};

export function calculateRow(
  row: ExtendedRow,
  category?: string
): PriceTableRowComputed {
  let baseCost = 0;
  let markupPercent = 0;

  // Read inputs
  switch (category) {
    case "roofTypes":
      baseCost = row.carpenterCostPerPanel ?? 0;
      markupPercent = row.installerGroupMarkupPercent ?? 0;
      break;

    case "workFromElectrician":
    case "additionalCosts":
      baseCost = row.costPer ?? 0;
      markupPercent = row.installerGroupMarkupPercent ?? 0;
      break;

    default:
      baseCost = row.carpenterCostPerPanel ?? row.costPer ?? row.baseCost ?? 0;
      markupPercent = row.installerGroupMarkupPercent ?? 0;
      break;
  }

  // Calculate
  const markupValue = baseCost * (markupPercent / 100);
  const totalExVat = baseCost + markupValue;
  const totalInclVat = totalExVat * 1.25;

  // Return full fow
  return {
    ...row,
    installerGroupMarkupKr: Number(markupValue.toFixed(2)),
    totalExVat: Number(totalExVat.toFixed(2)),
    totalInclVat: Number(totalInclVat.toFixed(2)),
  };
}

export function calculateAll(rows: PriceRow[], category?: string) {
  return rows.map((r) => calculateRow(r, category));
}
