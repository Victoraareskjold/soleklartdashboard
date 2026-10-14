import { getRoofTypes, getMountItems, updateMountItems } from "@/lib/api";
import { RoofType } from "@/lib/types";
import { MountItem, SupplierWithProducts } from "@/types/price_table";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Settings } from "lucide-react";

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
    {},
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
    value: string,
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

  if (loading) return <div className="text-sm text-muted">Laster...</div>;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
        MONTERING <Settings size={14} className="text-muted" />
      </h3>
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="sk-table">
          <thead>
            <tr>
              <th className="w-1/4">Leverandører</th>
              <th>Taktype og valgt feste</th>
              <th className="w-56 text-right!">
                Arbeid pr. panel montert (eks. mva)
              </th>
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
                  <td className="py-2 align-top">
                    <select
                      className="h-8 w-full rounded-md border border-line bg-white pl-2 text-sm text-ink hover:border-gray-300"
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

                  <td className="py-2 align-top">
                    <div className="mb-1 text-xs font-semibold text-ink">
                      {roof.name}
                    </div>
                    {local.supplierId ? (
                      <select
                        className="h-8 w-full rounded-md border border-line bg-white pl-2 text-sm text-ink hover:border-gray-300"
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
                      <p className="text-xs text-muted">
                        Ingen leverandør valgt
                      </p>
                    )}
                  </td>

                  <td className="py-2 text-right align-top">
                    <input
                      type="number"
                      step="1"
                      value={local.pricePer}
                      onChange={(e) =>
                        updateLocalData(roof.id, "pricePer", e.target.value)
                      }
                      onBlur={() => handleSave(roof.id)}
                      className="w-28 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                    />
                    <span className="ml-0.5 text-xs text-muted">kr</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
