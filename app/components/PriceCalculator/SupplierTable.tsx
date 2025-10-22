"use client";
import React from "react";
import { SupplierCategoryTable } from "./SupplierCategoryTable";
import { supplierCategoryConfig } from "@/lib/config/supplierCategories";
import { PriceTable, SupplierData } from "@/types/price";
import { updatePriceTable } from "@/lib/api";
import { toast } from "react-toastify";

type Props = {
  installerGroupId: string;
  table: PriceTable;
  setTable: React.Dispatch<React.SetStateAction<PriceTable | null>>;
  suppliers: Record<string, Record<string, SupplierData>>;
  setSuppliers: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, SupplierData>>>
  >;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
};

const SUPPLIER_LIST = [
  { id: "solarTech", name: "Solar Technologies Scandinavia" },
  { id: "testTech", name: "Test Tech" },
];

export default function SupplierTableEditor({
  installerGroupId,
  table,
  setTable,
  suppliers,
  setSuppliers,
  saving,
  setSaving,
}: Props) {
  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updatePriceTable(installerGroupId, {
        ...table,
        suppliers,
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
    <div className="space-y-8">
      {SUPPLIER_LIST.map((supplier) => (
        <div key={supplier.id}>
          <h2 className="text-2xl font-bold mb-2">{supplier.name}</h2>

          {Object.entries(supplierCategoryConfig).map(([category]) => {
            const supplierData = suppliers[supplier.id]?.[category] ?? {};

            return (
              <SupplierCategoryTable
                key={category}
                category={category as keyof typeof supplierCategoryConfig}
                data={supplierData}
                onChange={(key, updatedRows) =>
                  setSuppliers((prev) => ({
                    ...prev,
                    [supplier.id]: {
                      ...prev[supplier.id],
                      [category]: {
                        ...prev[supplier.id]?.[category],
                        [key]: updatedRows,
                      },
                    },
                  }))
                }
                onAdd={(key) =>
                  setSuppliers((prev) => ({
                    ...prev,
                    [supplier.id]: {
                      ...prev[supplier.id],
                      [category]: {
                        ...prev[supplier.id]?.[category],
                        [key]: [
                          ...(prev[supplier.id]?.[category]?.[key] ?? []),
                          {
                            attachment: "",
                            description: "",
                            priceExVat: 0,
                          },
                        ],
                      },
                    },
                  }))
                }
                onRemove={(key, idx) =>
                  setSuppliers((prev) => ({
                    ...prev,
                    [supplier.id]: {
                      ...prev[supplier.id],
                      [category]: {
                        ...prev[supplier.id]?.[category],
                        [key]: (
                          prev[supplier.id]?.[category]?.[key] ?? []
                        ).filter((_, i) => i !== idx),
                      },
                    },
                  }))
                }
              />
            );
          })}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              {saving ? "Lagrer…" : "Lagre"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
