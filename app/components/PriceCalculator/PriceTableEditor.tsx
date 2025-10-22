"use client";
import React from "react";

import { PriceTable } from "@/types/price";
import { updatePriceTable } from "@/lib/api";
import { toast } from "react-toastify";
import { PriceCategoryTable } from "./PriceCategoryTable";
import { priceCategoryConfig } from "@/lib/config/priceCategories";

type Props = {
  installerGroupId: string;
  table: PriceTable;
  prices: PriceTable["prices"];
  setPrices: React.Dispatch<React.SetStateAction<PriceTable["prices"]>>;
  setTable: React.Dispatch<React.SetStateAction<PriceTable | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<true | false>>;
};

export default function PriceTableEditor({
  installerGroupId,
  table,
  prices,
  setPrices,
  setTable,
  saving,
  setSaving,
}: Props) {
  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updatePriceTable(installerGroupId, {
        ...table,
        prices,
      });
      setTable(updated);
      toast.success("Successfully updated!");
    } catch (err) {
      console.error(err);
      toast.error("Error saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {Object.entries(priceCategoryConfig).map(([category]) => {
        const rows = prices[category] ?? [];

        return (
          <PriceCategoryTable
            key={category}
            category={category as keyof typeof priceCategoryConfig}
            rows={rows}
            onChange={(updatedRows) =>
              setPrices((prev) => ({ ...prev, [category]: updatedRows }))
            }
            onAdd={() =>
              setPrices((prev) => ({
                ...prev,
                [category]: [
                  ...(prev[category] ?? []),
                  {
                    name: "Ny rad",
                    carpenterCostPerPanel: 0,
                    installerGroupMarkupPercent: 20,
                  },
                ],
              }))
            }
            onRemove={(idx) =>
              setPrices((prev) => ({
                ...prev,
                [category]: (prev[category] ?? []).filter((_, i) => i !== idx),
              }))
            }
          />
        );
      })}

      <div className="mt-4 flex gap-2">
        <button onClick={handleSave} disabled={saving}>
          {saving ? "Lagrer…" : "Lagre"}
        </button>
      </div>
    </div>
  );
}
