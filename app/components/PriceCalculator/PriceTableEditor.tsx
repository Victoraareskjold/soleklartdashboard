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
  items: PriceTable["items"];
  setItems: React.Dispatch<React.SetStateAction<PriceTable["items"]>>;
  setTable: React.Dispatch<React.SetStateAction<PriceTable | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<true | false>>;
};

export default function PriceTableEditor({
  installerGroupId,
  table,
  items,
  setItems,
  setTable,
  saving,
  setSaving,
}: Props) {
  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updatePriceTable(installerGroupId, {
        ...table,
        items,
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
        const rows = items[category] ?? [];

        return (
          <PriceCategoryTable
            key={category}
            category={category as keyof typeof priceCategoryConfig}
            rows={rows}
            onChange={(updatedRows) =>
              setItems((prev) => ({ ...prev, [category]: updatedRows }))
            }
            onAdd={() =>
              setItems((prev) => ({
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
              setItems((prev) => ({
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
