import { CategoryConfig } from "@/app/components/PriceCalculator/PriceCategoryTable";

export const priceCategoryConfig: Record<string, CategoryConfig> = {
  roofTypes: {
    label: "Taktyper",
    columns: [
      { key: "name", label: "Taktyper", type: "text" },
      {
        key: "carpenterCostPerPanel",
        label: "Snekker kostnad pr. panel",
        type: "number",
      },
      { key: "installerGroupMarkupPercent", label: "Påslag %", type: "number" },
      {
        key: "installerGroupMarkupKr",
        label: "Påslag i Kr (pr.panel)",
        type: "computed",
      },
      { key: "totalExVat", label: "Total eks. mva", type: "computed" },
      { key: "totalInclVat", label: "Total inkl. mva", type: "computed" },
    ],
  },

  workFromElectrician: {
    label: "Arbeid fra elektriker",
    columns: [
      { key: "name", label: "Arbeid fra elektriker", type: "text" },
      { key: "costPer", label: "Kostnad per enhet", type: "number" },
      { key: "installerGroupMarkupPercent", label: "Påslag %", type: "number" },
      { key: "installerGroupMarkupKr", label: "Påslag i Kr", type: "computed" },
      { key: "totalExVat", label: "Total eks. mva", type: "computed" },
      { key: "totalInclVat", label: "Total inkl. mva", type: "computed" },
    ],
  },

  additionalCosts: {
    label: "Tillegskostnader",
    columns: [
      { key: "name", label: "Tillegskostnader", type: "text" },
      { key: "costPer", label: "Kostnad per", type: "number" },
      { key: "installerGroupMarkupPercent", label: "Påslag %", type: "number" },
      { key: "installerGroupMarkupKr", label: "Påslag i Kr", type: "computed" },
      { key: "totalExVat", label: "Total eks. mva", type: "computed" },
      { key: "totalInclVat", label: "Total inkl. mva", type: "computed" },
    ],
  },
};
