import { getRoofTypes, getMountItems, updateMountItems } from "@/lib/api";
import { RoofType } from "@/lib/types";
import { MountItem, SupplierWithProducts } from "@/types/price_table";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

interface MountingTableProps {
  suppliersAndProducts: SupplierWithProducts[];
  installerGroupId: string;
}

interface LocalMountData {
  supplierId: string;
  productId: string;
  pricePer: string;
}

export default function MountingTable({
  suppliersAndProducts,
  installerGroupId,
}: MountingTableProps) {
  const [roofTypes, setRoofTypes] = useState<RoofType[]>([]);
  const [mountItems, setMountItems] = useState<MountItem[]>([]);
  const [localData, setLocalData] = useState<Record<string, LocalMountData>>(
    {}
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          getMountItems(installerGroupId).then(setMountItems),
          getRoofTypes().then(setRoofTypes),
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [installerGroupId]);

  useEffect(() => {
    const initialData: Record<string, LocalMountData> = {};
    mountItems.forEach((item) => {
      initialData[item.roof_type_id] = {
        supplierId: item.product?.supplier?.id || "",
        productId: item.product?.id || "",
        pricePer: item.price_per?.toString() || "0",
      };
    });
    setLocalData(initialData);
  }, [mountItems]);

  const getMountOptions = (supplierId: string) => {
    const supplier = suppliersAndProducts.find((s) => s.id === supplierId);
    if (!supplier) return [];
    return supplier.products.filter((p) => p.category?.name === "feste");
  };

  const updateLocalData = (
    roofTypeId: string,
    field: keyof LocalMountData,
    value: string
  ) => {
    setLocalData((prev) => ({
      ...prev,
      [roofTypeId]: {
        ...prev[roofTypeId],
        supplierId: prev[roofTypeId]?.supplierId || "",
        productId: prev[roofTypeId]?.productId || "",
        pricePer: prev[roofTypeId]?.pricePer || "0",
        [field]: value,
      },
    }));
  };

  const handleSupplierChange = (roofTypeId: string, supplierId: string) => {
    updateLocalData(roofTypeId, "supplierId", supplierId);
    updateLocalData(roofTypeId, "productId", "");
    updateLocalData(roofTypeId, "pricePer", "0");
  };
  const handleProductChange = async (roofTypeId: string, productId: string) => {
    const currentSupplier = localData[roofTypeId]?.supplierId || "";
    const currentPricePer = localData[roofTypeId]?.pricePer || "0";

    updateLocalData(roofTypeId, "productId", productId);

    if (currentSupplier && productId) {
      try {
        const updated = await updateMountItems(roofTypeId, installerGroupId, {
          product_id: productId,
          price_per: parseFloat(currentPricePer) || 0,
          supplier_id: currentSupplier,
        });

        setMountItems((prev) => {
          const index = prev.findIndex((m) => m.roof_type_id === roofTypeId);
          if (index >= 0) {
            const newItems = [...prev];
            newItems[index] = updated;
            return newItems;
          } else {
            return [...prev, updated];
          }
        });

        toast.success("Lagret!");
      } catch (error) {
        console.error("Error saving mount item:", error);
        toast.error("Kunne ikke lagre");
      }
    }
  };

  const handleSave = async (roofTypeId: string) => {
    const local = localData[roofTypeId];

    if (!local?.supplierId || !local?.productId) {
      toast.error("Velg leverandør og produkt først");
      return;
    }

    try {
      const updated = await updateMountItems(roofTypeId, installerGroupId, {
        product_id: local.productId,
        price_per: parseFloat(local.pricePer) || 0,
        supplier_id: local.supplierId,
      });

      setMountItems((prev) => {
        const index = prev.findIndex((m) => m.roof_type_id === roofTypeId);
        if (index >= 0) {
          const newItems = [...prev];
          newItems[index] = updated;
          return newItems;
        } else {
          return [...prev, updated];
        }
      });

      toast.success("Lagret!");
    } catch (error) {
      console.error("Error saving mount item:", error);
      toast.error("Kunne ikke lagre");
    }
  };

  if (loading) return <div>Laster...</div>;

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">MONTERING ⚙️</h2>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Leverandører</th>
            <th className="border p-2">Taktype og valgt feste</th>
            <th className="border p-2">Arbeid pr. panel montert (eks. mva)</th>
          </tr>
        </thead>
        <tbody>
          {roofTypes.map((roof) => {
            const local = localData[roof.id] || {
              supplierId: "",
              productId: "",
              pricePer: "0",
            };
            const mountOptions = getMountOptions(local.supplierId);

            return (
              <tr key={roof.id}>
                <td className="border p-1">
                  <select
                    className="w-full mb-1 p-1 rounded"
                    value={local.supplierId}
                    onChange={(e) =>
                      handleSupplierChange(roof.id, e.target.value)
                    }
                  >
                    <option value="" disabled>
                      Velg leverandør...
                    </option>
                    {suppliersAndProducts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="border p-1">
                  <div className="font-medium mb-1">{roof.name}</div>
                  {local.supplierId ? (
                    <select
                      className="w-full p-1 rounded"
                      value={local.productId}
                      onChange={(e) =>
                        handleProductChange(roof.id, e.target.value)
                      }
                      disabled={!local.supplierId}
                    >
                      <option value="" disabled>
                        Velg takfeste...
                      </option>
                      {mountOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Ingen leverandør valgt
                    </p>
                  )}
                </td>

                <td className="border p-1">
                  <input
                    type="number"
                    step="1"
                    value={local.pricePer}
                    onChange={(e) =>
                      updateLocalData(roof.id, "pricePer", e.target.value)
                    }
                    onBlur={() => handleSave(roof.id)}
                    className="w-full p-1 rounded"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
