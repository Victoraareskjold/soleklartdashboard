"use client";
import React, { useState, useMemo } from "react";
import CalculatorSection from "./CalculatorSection";
import { PriceTable } from "@/types/price";

type Props = {
  roofTypes: PriceTable["prices"]["roofTypes"];
  totalPanels: number;
};

type RoofType = PriceTable["prices"]["roofTypes"][number];

export default function RoofSection({ roofTypes = [], totalPanels }: Props) {
  const [selected, setSelected] = useState<RoofType | null>(
    roofTypes[0] ?? null
  );

  const carpenter = selected ? selected.carpenterCostPerPanel * totalPanels : 0;

  const markupKr = selected
    ? (selected.installerGroupMarkupPercent / 100) * carpenter
    : 0;

  const totals = useMemo(() => {
    const total = carpenter + markupKr;
    return { carpenter, total };
  }, [markupKr, carpenter]);

  return (
    <CalculatorSection
      title="Snekker"
      color="red"
      rows={[
        {
          label: "Taktekke",
          value: (
            <select
              value={selected?.name ?? ""}
              onChange={(e) =>
                setSelected(
                  roofTypes.find((r) => r.name === e.target.value) ?? null
                )
              }
              className="border rounded-md px-2 py-1 w-full"
            >
              {roofTypes.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          ),
        },
        {
          label: "Snekker kostnad",
          value: `${totals.carpenter.toLocaleString("no-NO")} kr`,
        },
        {
          label: "Påslag elektriker",
          value: `${markupKr.toLocaleString("no-NO")} kr`,
        },
        {
          label: "Total",
          value: <strong>{totals.total.toLocaleString("no-NO")} kr</strong>,
        },
      ]}
    />
  );
}
