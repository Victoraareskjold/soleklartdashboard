import { calculateRow } from "@/lib/calc/price";
import { priceCategoryConfig } from "@/lib/config/priceCategories";
import { PriceRow, PriceTableRowComputed } from "@/types/price_table";

type ColumnConfig = {
  key: keyof PriceTableRowComputed | keyof PriceRow | string;
  label: string;
  type: "text" | "number" | "computed";
};

export type CategoryConfig = {
  label: string;
  columns: ColumnConfig[];
};

type Props = {
  category: keyof typeof priceCategoryConfig;
  rows: PriceRow[];
  onChange: (rows: PriceRow[]) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
};

export function PriceCategoryTable({
  category,
  rows,
  onChange,
  onAdd,
  onRemove,
}: Props) {
  const config: CategoryConfig = priceCategoryConfig[category];
  if (!config) return null;

  const updateCell = (
    idx: number,
    key: string,
    value: string | number | unknown
  ) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [key]: value } as PriceRow;
    onChange(updated);
  };

  return (
    <div className="mb-8">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {config.columns.map((col) => (
              <th
                key={col.key as string}
                className="border p-2 text-left w-1/6"
              >
                {col.label}
              </th>
            ))}
            {/* <th className="border p-2"></th> */}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const computed = calculateRow(row, category);
            return (
              <tr key={idx}>
                {config.columns.map((col) => {
                  const key = col.key as keyof typeof computed;
                  const value =
                    col.type === "computed"
                      ? computed[key]
                      : (row as never)[key] ?? "";

                  if (col.type === "text" || col.type === "number") {
                    return (
                      <td key={col.key as string} className="border p-2">
                        <input
                          type={col.type}
                          value={value}
                          onChange={(e) =>
                            updateCell(
                              idx,
                              col.key as string,
                              col.type === "number"
                                ? Number(e.target.value)
                                : e.target.value
                            )
                          }
                          className="w-full"
                        />
                      </td>
                    );
                  }

                  return (
                    <td
                      key={col.key as string}
                      className="border p-2 text-right"
                    >
                      {value}
                    </td>
                  );
                })}
                <td className="border p-2">
                  <button onClick={() => onRemove(idx)}>🗑️</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button onClick={onAdd} className="mt-2 bg-gray-200 px-3 py-1 rounded">
        + Legg til rad
      </button>
    </div>
  );
}
