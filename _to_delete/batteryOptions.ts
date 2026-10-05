import {
  BatteryOption,
  SupplierCategory,
  SupplierWithProducts,
} from "@/types/price_table";

/**
 * Batterialternativene på et tilbud bygges fra installatørens batteriprodukter
 * i priskalkulatoren. Både priskalkulatoren (når et estimat opprettes) og
 * redigeringsvisningen bruker denne filen, slik at pris og påslag blir like
 * begge steder.
 */

/** Produktkategorien batterier ligger under i priskalkulatoren. */
export const BATTERY_CATEGORY = "batteri";

/**
 * Batterier prises med samme påslag som øvrig solcellemateriell.
 * Samme sammenheng som `categoryMapping` i CalculationSheet.
 */
const BATTERY_MARKUP_CATEGORY = "solcellemateriell";

/** Leser kapasitet i kWh ut av et produktnavn, f.eks. "LUNA2000 10 kWh" → 10. */
export function parseCapacityKwh(productName: string): number | null {
  const match = productName.match(/(\d+(?:[.,]\d+)?)\s*kwh/i);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Påslaget som gjelder batterier for denne installatørgruppen. */
export function batteryMarkupPercent(
  supplierCategories: SupplierCategory[],
): number {
  const category = supplierCategories.find(
    (c) => c.name.toLowerCase() === BATTERY_MARKUP_CATEGORY,
  );
  return category?.markup_percentage || 0;
}

/** Alle batteriprodukter i katalogen, som ferdige batterialternativer. */
export function buildBatteryOptions(
  suppliersAndProducts: SupplierWithProducts[] | null | undefined,
  markupPercent: number,
): BatteryOption[] {
  return (suppliersAndProducts ?? []).flatMap((supplier) =>
    (supplier.products ?? [])
      .filter(
        (product) =>
          product.category?.name?.toLowerCase() === BATTERY_CATEGORY,
      )
      .map((product) => ({
        id: product.id,
        name: product.name,
        capacityKwh: parseCapacityKwh(product.name),
        priceWithMarkup:
          (product.price_ex_vat || 0) * (1 + markupPercent / 100),
        attachmentUrl: product.attachment,
      })),
  );
}
