import React from "react";
import { supplierCategoryConfig } from "@/lib/config/supplierCategories";
import { SupplierRow } from "@/types/price";

type Props = {
  category: keyof typeof supplierCategoryConfig;
  data: Record<string, SupplierRow[]>;
  onChange: (key: string, rows: SupplierRow[]) => void;
  onAdd: (key: string) => void;
  onRemove: (key: string, idx: number) => void;
};

export function SupplierCategoryTable({
  category,
  data,
  onChange,
  onAdd,
  onRemove,
}: Props) {
  const config = supplierCategoryConfig[category];
  if (!config) return null;

  return (
    <div className="border rounded-md mb-8 overflow-hidden">
      <h2 className="text-xl font-semibold bg-gray-200 p-2">{config.label}</h2>

      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="border-t p-2 w-1/3">Vedlegg</th>
            <th className="border p-2 w-1/3">Beskrivelse</th>
            <th className="border p-2 w-1/3">Pris (NOK eks. mva)</th>
            <th className="border px-5"></th>
          </tr>
        </thead>

        <tbody>
          {config.sections.map((section) => {
            const rows = data[section.key] ?? [];

            return (
              <React.Fragment key={section.key}>
                <tr>
                  <td
                    colSpan={4}
                    className="font-bold bg-gray-100 p-2 border-t text-left"
                  >
                    {section.title}
                  </td>
                </tr>

                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="border p-2">
                      <input
                        value={row.attachment || ""}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx] = {
                            ...updated[idx],
                            attachment: e.target.value,
                          };
                          onChange(section.key, updated);
                        }}
                        className="w-full"
                      />
                    </td>

                    <td className="border p-2">
                      <input
                        value={row.description}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx] = {
                            ...updated[idx],
                            description: e.target.value,
                          };
                          onChange(section.key, updated);
                        }}
                        className="w-full"
                      />
                    </td>

                    <td className="border p-2">
                      <input
                        type="number"
                        value={row.priceExVat}
                        onChange={(e) => {
                          const updated = [...rows];
                          updated[idx] = {
                            ...updated[idx],
                            priceExVat: Number(e.target.value),
                          };
                          onChange(section.key, updated);
                        }}
                        className="w-full"
                      />
                    </td>

                    <td className="border p-2 text-center">
                      <button onClick={() => onRemove(section.key, idx)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}

                <tr>
                  <td colSpan={4} className="p-2 text-right border-t">
                    <button
                      onClick={() => onAdd(section.key)}
                      className="bg-gray-200 px-3 py-1 rounded"
                    >
                      + Legg til rad
                    </button>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
