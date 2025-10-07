"use client";
import React, { useEffect, useState } from "react";

import { PriceTable } from "@/types/priece";
import { getPriceTable, updatePriceTable } from "@/lib/api";
import { toast } from "react-toastify";
import LoadingScreen from "../LoadingScreen";
import { PriceCategoryTable } from "./PriceCategoryTable";

type Props = {
  installerGroupId: string;
};
export default function PriceTableEditor({ installerGroupId }: Props) {
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState<PriceTable | null>(null);
  const [items, setItems] = useState<PriceTable["items"]>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchTable = async () => {
      try {
        const table = await getPriceTable(installerGroupId);
        setTable(table);
        setItems(table?.items ?? {});
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTable();
  }, [installerGroupId]);

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

  if (loading) return <LoadingScreen />;

  return (
    <div>
      {Object.entries(items).map(([category, rows]) => (
        <PriceCategoryTable
          key={category}
          category={category}
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
      ))}

      <div className="mt-4 flex gap-2">
        <button onClick={handleSave} disabled={saving}>
          {saving ? "Lagrer…" : "Lagre"}
        </button>
      </div>
    </div>
  );
}
