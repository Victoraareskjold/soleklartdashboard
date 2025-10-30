import { getWorkItems } from "@/lib/api";
import { SupplierWithProducts, WorkItem } from "@/types/price_table";
import { useEffect, useState } from "react";

interface MountingTableProps {
  suppliersAndProducts: SupplierWithProducts[];
  installerGroupId: string;
}

export default function MountingTable({
  suppliersAndProducts,
  installerGroupId,
}: MountingTableProps) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<
    Record<string, string>
  >({});
  const [selectedMounts, setSelectedMounts] = useState<Record<string, string>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWorkItems("mounting", installerGroupId).then((data) => {
      setWorkItems(data);
    });
    setLoading(false);
  }, [installerGroupId]);

  const handleSupplierChange = (workItemId: string, supplierId: string) => {
    setSelectedSuppliers((prev) => ({ ...prev, [workItemId]: supplierId }));
    setSelectedMounts((prev) => ({ ...prev, [workItemId]: "" }));
  };

  const handleMountChange = (workItemId: string, mountId: string) => {
    setSelectedMounts((prev) => ({ ...prev, [workItemId]: mountId }));
  };

  const getMountOptions = (supplierId: string) => {
    const supplier = suppliersAndProducts.find((s) => s.id === supplierId);
    if (!supplier) return [];
    return supplier.products.filter(
      (p) => p.category?.name === "FESTEMATERIELL LØSNING"
    );
  };

  const calcPricePerPanel = (item: WorkItem): number => {
    const supplierId = selectedSuppliers[item.id];
    const mountId = selectedMounts[item.id];
    if (!supplierId || !mountId) return item.cost_per;
    const supplier = suppliersAndProducts.find((s) => s.id === supplierId);
    const mount = supplier?.products.find((p) => p.id === mountId);
    if (!mount) return item.cost_per;
    return item.cost_per * mount.price_ex_vat;
  };

  if (loading) return <div>Laster...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Montering</h2>
        <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
          + Legg til rad
        </button>
      </div>

      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Leverandør</th>
            <th className="border p-2">Taktype</th>
            <th className="border p-2">Arbeid per panel</th>
            <th className="border p-2">Pris per panel</th>
            <th className="border p-2 w-12">🗑️</th>
          </tr>
        </thead>
        <tbody>
          {workItems.map((item) => {
            const supplierId = selectedSuppliers[item.id];
            const mountOptions = getMountOptions(supplierId);
            const totalPrice = calcPricePerPanel(item);

            return (
              <tr key={item.id}>
                {/* leverandør */}
                <td className="border p-1">
                  {/* Leverandør */}
                  <select
                    className="w-full mb-1 p-1 rounded"
                    onChange={(e) =>
                      handleSupplierChange(item.id, e.target.value)
                    }
                  >
                    <option>Velg leverandør...</option>
                    {suppliersAndProducts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Takfeste */}
                <td className="border p-1">
                  {item.name}
                  {supplierId ? (
                    <select
                      className="w-full p-1 rounded"
                      onChange={(e) =>
                        handleMountChange(item.id, e.target.value)
                      }
                      disabled={!supplierId}
                    >
                      <option>Velg takfeste...</option>
                      {mountOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-500">Ingen leverandør valgt</p>
                  )}
                </td>

                {/* Arbeid per panel */}
                <td className="border p-1">
                  <input
                    type="text"
                    value={Number(item.cost_per).toFixed(2)}
                    readOnly
                    className="w-full p-1 rounded"
                  />
                </td>

                {/* Total pris */}
                <td className="border p-1">
                  <input
                    type="text"
                    value={totalPrice.toFixed(2)}
                    readOnly
                    className="w-full p-1 rounded"
                  />
                </td>

                <td className="border">
                  <button className="w-full aspect-square hover:bg-red-100">
                    x
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {workItems.length === 0 && (
        <p className="text-gray-500 text-center py-8">
          Ingen rader. Klikk Legg til rad for å starte.
        </p>
      )}
    </div>
  );
}
