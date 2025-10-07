import { calculateRow } from "@/lib/calc/price";
import { PriceRow } from "@/types/priece";

type CategoryTableProps = {
  category: string;
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
}: CategoryTableProps) {
  const updateCell = (idx: number, key: string, value: unknown) => {
    const updated = [...rows];
    updated[idx] = { ...updated[idx], [key]: value };
    onChange(updated);
  };

  return (
    <div className="mb-8">
      <h4 className="font-semibold text-lg mb-2 capitalize">{category}</h4>

      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-blue-100">
            <th className="border p-2">Navn</th>
            <th className="border p-2">Snekker kostnad pr. panel</th>
            <th className="border p-2">Påslag %</th>
            <th className="border p-2">Påslag i Kr (pr.panel)</th>
            <th className="border p-2">Total eks. mva</th>
            <th className="border p-2">Total inkl. mva</th>
            <th className="border p-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const computed = calculateRow(row);
            return (
              <tr key={idx} className="border-t">
                <td className="border p-2">
                  <input
                    value={row.name}
                    onChange={(e) => updateCell(idx, "name", e.target.value)}
                    className="w-full"
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="number"
                    value={row.carpenterCostPerPanel}
                    onChange={(e) =>
                      updateCell(
                        idx,
                        "carpenterCostPerPanel",
                        Number(e.target.value)
                      )
                    }
                    className="w-full"
                  />
                </td>
                <td className="border p-2">
                  <input
                    type="number"
                    value={row.installerGroupMarkupPercent}
                    onChange={(e) =>
                      updateCell(
                        idx,
                        "installerGroupMarkupPercent",
                        Number(e.target.value)
                      )
                    }
                    className="w-full"
                  />
                </td>
                <td className="border p-2">
                  {computed.installerGroupMarkupKr}
                </td>
                <td className="border p-2">{computed.totalExVat}</td>
                <td className="border p-2">{computed.totalInclVat}</td>
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
