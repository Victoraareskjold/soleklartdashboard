"use client";
import { MountItem, Supplier, SupplierWithProducts } from "@/types/price_table";
import { useState, useMemo, useEffect } from "react";
import { getCategories, getMountItems } from "@/lib/api";
import CalculationSheet from "./CalculationSheet";
import CalculatorRow from "./CalculatorRow";
import { SolarData } from "../../SolarDataView";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { getPanelWp } from "@/utils/getPanelWp";
import FacilityInfo from "./FacilityInfo";

interface CalculatorResultsProps {
  suppliers: Supplier[] | null;
  suppliersAndProducts: SupplierWithProducts[] | null;
  solarData?: SolarData;
  setSolarData?: React.Dispatch<React.SetStateAction<SolarData>>;
}

export interface CalculatorItem {
  id: string;
  displayName: string;
  categoryId?: string;
  subcategoryId?: string;
  quantity: number;
  supplierId: string;
  productId: string;
  defaultSupplier?: string;
  defaultProduct?: string;
  mountPricePer?: number;
}

export interface CalculatorState {
  items: CalculatorItem[];
  totalPrice: number;
}

export interface CategoryWithSubcategories {
  id: string;
  name: string;
  subcategories?: {
    id: string;
    name: string;
    category_id: string;
  }[];
}

export type CalculatorItemUpdate = Partial<CalculatorItem> & {
  _delete?: boolean;
  productName?: string;
};

export default function CalculatorResults({
  suppliers,
  suppliersAndProducts,
  solarData,
  setSolarData,
}: CalculatorResultsProps) {
  const { installerGroupId } = useInstallerGroup();
  const [allCategories, setAllCategories] = useState<
    CategoryWithSubcategories[]
  >([]);

  const [mountItems, setMountItems] = useState<MountItem[]>([]);

  useEffect(() => {
    if (!installerGroupId) return;
    getCategories().then(setAllCategories);
    getMountItems(installerGroupId).then(setMountItems);
  }, [installerGroupId]);

  const [showModal, setShowModal] = useState(false);

  const [calculatorState, setCalculatorState] = useState<CalculatorState>({
    items: [
      {
        id: "solcellepanel",
        displayName: "Solcellepanel",
        categoryId: "",
        quantity: solarData?.totalPanels || 1,
        supplierId: "",
        productId: "",
        defaultSupplier: "Solar Technologies Scandinavia AS",
      },
      {
        id: "feste",
        displayName: "Feste",
        categoryId: "",
        quantity: solarData?.totalPanels || 1,
        supplierId: "",
        productId: "",
        defaultSupplier: "Solar Technologies Scandinavia AS",
      },
      {
        id: "inverter",
        displayName: "Inverter",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        productId: "",
        defaultSupplier: "Solar Technologies Scandinavia AS",
      },
      {
        id: "stillase",
        displayName: "Stillase",
        categoryId: "",
        quantity: 1,
        supplierId: "ba4f75fd-26fd-44ef-9c18-25110d3b4448",
        productId: "1557c4ef-2e78-41ef-904c-8113d8ba76cd",
        defaultSupplier: "Stillase Moss AS",
      },
      /* {
      {
        id: "frakt",
        displayName: "Frakt",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        productId: "",
        defaultSupplier: "DHL Freight",
      },
        id: "battery",
        displayName: "Batteri",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        productId: "",
      },
      {
        id: "ballastein",
        displayName: "Ballastein",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        productId: "",
      },
      {
        id: "solcellekran",
        displayName: "Solcellekran",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        productId: "",
      }, */
    ],
    totalPrice: 0,
  });

  const [newItem, setNewItem] = useState<Partial<CalculatorItem>>({
    displayName: "",
    id: "",
    quantity: 1,
    supplierId: "",
    productId: "",
  });

  // koble kategorier
  useEffect(() => {
    if (allCategories.length === 0) return;

    setCalculatorState((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.categoryId) return item;
        const cat = allCategories.find((c) => c.name === item.id);
        return {
          ...item,
          categoryId: cat?.id || "",
          subcategoryId: undefined,
        };
      }),
    }));
  }, [allCategories]);

  // koble leverandører
  useEffect(() => {
    if (!suppliers || suppliers.length === 0) return;

    setCalculatorState((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.supplierId) return item;
        if (!item.defaultSupplier) return item;

        const found = suppliers.find(
          (s) => s.name.toLowerCase() === item.defaultSupplier!.toLowerCase()
        );

        return found ? { ...item, supplierId: found.id } : item;
      }),
    }));
  }, [suppliers]);

  // Auto-select panel product based on solarData.panelType
  useEffect(() => {
    if (!suppliersAndProducts || suppliersAndProducts.length === 0) return;
    if (!solarData?.selectedPanelType) return;

    const panelTypeToMatch = solarData.selectedPanelType;
    const allProducts = suppliersAndProducts.flatMap((s) =>
      s.products.map((p) => ({ ...p, supplierId: s.id }))
    );

    const matchedProduct = allProducts.find(
      (p) => p.name.toLowerCase() === panelTypeToMatch.toLowerCase()
    );

    if (matchedProduct) {
      setCalculatorState((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === "solcellepanel"
            ? {
                ...item,
                supplierId: matchedProduct!.supplierId,
                productId: matchedProduct!.id,
              }
            : item
        ),
      }));
    }
  }, [suppliersAndProducts, solarData?.selectedPanelType]);

  // Auto-add ballastein for flatt tak
  useEffect(() => {
    if (!solarData?.selectedRoofType) return;

    const isFlatRoof = solarData.selectedRoofType.toLowerCase() === "flatt tak";

    setCalculatorState((prev) => {
      const ballasteinCategory = allCategories.find(
        (c) => c.name === "ballastein"
      );

      const ballasteinExists = prev.items.some(
        (item) => item.id === "ballastein"
      );

      if (isFlatRoof && !ballasteinExists) {
        return {
          ...prev,
          items: [
            ...prev.items,
            {
              id: "ballastein",
              displayName: "Ballastein",
              categoryId: ballasteinCategory?.id,
              quantity: 1,
              supplierId: "c15b13b3-21d5-4e7b-a6e3-e6047e17c830",
              productId: "",
            },
          ],
        };
      } else if (!isFlatRoof && ballasteinExists) {
        return {
          ...prev,
          items: prev.items.filter((item) => item.id !== "ballastein"),
        };
      }

      return prev;
    });
  }, [solarData?.selectedRoofType, solarData?.totalPanels, allCategories]);

  useEffect(() => {
    if (!suppliersAndProducts || suppliersAndProducts.length === 0) return;
    if (!solarData?.totalPanels) return;

    const shouldAddCrane = solarData.totalPanels > 72;

    setCalculatorState((prev) => {
      const craneExists = prev.items.some((i) => i.id === "solcellekran");
      if (shouldAddCrane && !craneExists) {
        const allProducts = suppliersAndProducts.flatMap((s) =>
          s.products.map((p) => ({ ...p, supplierId: s.id }))
        );
        const solarCrane = allProducts.find((p) =>
          p.name.toLowerCase().includes("solcellekran")
        );
        if (!solarCrane) return prev;

        const fraktCategory = allCategories.find((c) => c.name === "frakt");

        return {
          ...prev,
          items: [
            ...prev.items,
            {
              id: "solcellekran",
              displayName: "Frakt",
              categoryId: fraktCategory?.id || "",
              quantity: 1,
              supplierId: solarCrane.supplierId,
              productId: solarCrane.id,
            },
          ],
        };
      } else if (!shouldAddCrane && craneExists) {
        return {
          ...prev,
          items: prev.items.filter((i) => i.id !== "solcellekran"),
        };
      }
      return prev;
    });
  }, [solarData?.totalPanels, allCategories, suppliersAndProducts]);

  // hent feste hvis vi har solarData
  useEffect(() => {
    async function fetchMountItem() {
      if (!solarData?.selectedRoofType || !installerGroupId) return;
      try {
        if (!mountItems || mountItems.length === 0) return;

        const matchingMount = mountItems.find(
          (item) => item.roof_type?.name === solarData.selectedRoofType
        );

        if (!matchingMount || !matchingMount.product) return;
        setCalculatorState((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item.id === "feste"
              ? {
                  ...item,
                  supplierId: matchingMount.product.supplier.id,
                  productId: matchingMount.product.id,
                  roofTypeName: matchingMount.roof_type.name,
                  mountProductName: matchingMount.product.name,
                  mountPricePer: matchingMount.product.price_ex_vat,
                }
              : item
          ),
        }));
      } catch (err) {
        console.error("Failed to load mount item:", err);
      }
    }

    fetchMountItem();
  }, [installerGroupId, solarData?.selectedRoofType, mountItems]);

  useEffect(() => {
    async function fetchStillase() {
      if (
        !solarData?.totalPanels ||
        !installerGroupId ||
        !suppliersAndProducts ||
        allCategories.length === 0
      )
        return;
      try {
        const totalPanels = solarData.totalPanels;

        const count36 = Math.max(1, Math.ceil(totalPanels / 36));
        const count100 = Math.max(1, Math.ceil(totalPanels / 100));

        const allProducts = suppliersAndProducts.flatMap((s) =>
          s.products.map((p) => ({ ...p, supplierId: s.id }))
        );

        const standardPall = allProducts.find((p) =>
          p.name.toLowerCase().includes("standardpall")
        );
        const europaPall = allProducts.find((p) =>
          p.name.toLowerCase().includes("europall")
        );

        // Finn FRAKT kategori
        const fraktCategory = allCategories.find((c) => c.name === "frakt");

        setCalculatorState((prev) => {
          // Fjern eksisterende frakt-items for å unngå duplikater
          const itemsWithoutFrakt = prev.items.filter(
            (item) => item.id !== "frakt" && item.id !== "frakt2"
          );

          const newItems = [...itemsWithoutFrakt];

          if (standardPall) {
            newItems.push({
              id: "frakt",
              displayName: "Frakt",
              categoryId: fraktCategory?.id || "",
              quantity: count36,
              supplierId: standardPall.supplierId,
              productId: standardPall.id,
            });
          }

          if (europaPall) {
            newItems.push({
              id: "frakt2",
              displayName: "Frakt",
              categoryId: fraktCategory?.id || "",
              quantity: count100,
              supplierId: europaPall.supplierId,
              productId: europaPall.id,
            });
          }

          return { ...prev, items: newItems };
        });
      } catch (err) {
        console.error("Feil ved lasting av stillase:", err);
      }
    }

    fetchStillase();
  }, [
    installerGroupId,
    solarData?.totalPanels,
    suppliersAndProducts,
    allCategories,
  ]);

  // Auto-select inverter basert på default eller andre regler
  useEffect(() => {
    async function fetchBestInverter() {
      if (
        !solarData?.kwp ||
        !installerGroupId ||
        !suppliersAndProducts ||
        allCategories.length === 0
      )
        return;

      try {
        const totalKwp = solarData.kwp; // kWp
        const desiredCapacity = totalKwp * 0.87; // 87 % av total kWp

        const solarTechSupplier = suppliersAndProducts.find(
          (s) => s.name.toLowerCase() === "solar technologies scandinavia as"
        );
        const inverterCategory = allCategories.find(
          (c) => c.name.toLowerCase() === "inverter"
        );

        const inverter3FasSub = inverterCategory?.subcategories?.find(
          (sub) => sub.name.toLowerCase() === "inverter 3-fas"
        );

        const inverterProducts = solarTechSupplier?.products.filter(
          (p) => p.subcategory?.id === inverter3FasSub?.id
        );
        if (!inverterProducts || inverterProducts.length === 0) return;

        const parsePower = (name: string) => {
          const match = name.match(/(\d+\.?\d*)\s?kW/i);
          return match ? parseFloat(match[1]) : 0;
        };

        const sorted = inverterProducts
          .map((p) => ({ ...p, power: parsePower(p.name) }))
          .filter((p) => p.power > 0)
          .sort((a, b) => b.power - a.power);

        let remaining = desiredCapacity;
        const selected: { product: (typeof sorted)[0]; quantity: number }[] =
          [];

        for (const p of sorted) {
          if (remaining <= 0) break;
          const qty = Math.floor(remaining / p.power);
          if (qty > 0) {
            selected.push({ product: p, quantity: qty });
            remaining -= qty * p.power;
          }
        }

        // Beregn total valgt kapasitet
        const totalSelectedPower = selected.reduce(
          (sum, s) => sum + s.product.power * s.quantity,
          0
        );

        // Ikke legg til invertere hvis totalen er for lav (<70 % av ønsket kapasitet)
        const minAcceptable = desiredCapacity * 0.7;
        if (totalSelectedPower < minAcceptable) {
          console.log(
            `Kunne ikke dekke ønsket kapasitet (${desiredCapacity.toFixed(
              2
            )} kWp), valgt kun ${totalSelectedPower.toFixed(2)} kW`
          );
          return;
        }

        console.log("Desired:", desiredCapacity.toFixed(2), "kWp");
        console.log("Total valgt:", totalSelectedPower.toFixed(2), "kW");
        console.log(
          "Valgte invertere:",
          selected.map((s) => `${s.quantity}× ${s.product.name}`)
        );

        setCalculatorState((prev) => {
          const itemsWithoutInverter = prev.items.filter(
            (item) => !item.id.startsWith("inverter")
          );
          const newItems = selected.map((s, index) => ({
            id: `inverter-${index}`,
            displayName: "Inverter",
            categoryId: inverterCategory!.id,
            quantity: s.quantity,
            supplierId: solarTechSupplier!.id,
            productId: s.product.id,
          }));
          return { ...prev, items: [...itemsWithoutInverter, ...newItems] };
        });
      } catch (err) {
        console.error("Feil ved lasting av inverter:", err);
      }
    }

    fetchBestInverter();
  }, [installerGroupId, solarData?.kwp, suppliersAndProducts, allCategories]);

  useEffect(() => {
    if (!suppliersAndProducts || suppliersAndProducts.length === 0) return;

    setCalculatorState((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.productId || !item.supplierId || !item.defaultProduct)
          return item;

        const supplier = suppliersAndProducts.find(
          (s) => s.id === item.supplierId
        );
        const product = supplier?.products.find(
          (p) => p.name.toLowerCase() === item.defaultProduct!.toLowerCase()
        );

        return product ? { ...item, productId: product.id } : item;
      }),
    }));
  }, [suppliersAndProducts]);

  const handleAddItem = () => {
    if (!newItem.categoryId) return;

    const category = allCategories.find((c) => c.id === newItem.categoryId);
    const id = `${category?.name || "item"}-${Date.now()}`;

    setCalculatorState((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id,
          displayName: category?.name || "Nytt utstyr",
          categoryId: newItem.categoryId!,
          quantity: newItem.quantity || 1,
          supplierId: newItem.supplierId || "",
          productId: newItem.productId || "",
        },
      ],
    }));

    setNewItem({
      displayName: "",
      quantity: 1,
      supplierId: "",
      productId: "",
    });
    setShowModal(false);
  };

  const updateItem = (itemId: string, updates: CalculatorItemUpdate) => {
    if (updates._delete) {
      setCalculatorState((prev) => ({
        ...prev,
        items: prev.items.filter((i) => i.id !== itemId),
      }));
      return;
    }

    if (
      itemId === "solcellepanel" &&
      updates.productName &&
      setSolarData &&
      solarData
    ) {
      setSolarData({ ...solarData, selectedPanelType: updates.productName });
      localStorage.setItem("defaultPanel", updates.productName);
    }

    setCalculatorState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    }));
  };

  useMemo(() => {
    if (!suppliersAndProducts) return;

    const total = calculatorState.items.reduce((sum, item) => {
      if (!item.productId || !item.supplierId) return sum;

      const supplier = suppliersAndProducts.find(
        (s) => s.id === item.supplierId
      );
      const product = supplier?.products.find((p) => p.id === item.productId);

      if (!product) return sum;

      const unitPrice =
        item.mountPricePer !== undefined
          ? item.mountPricePer // montering pr feste
          : product.price_ex_vat; // levering pris fra supplier

      return sum + unitPrice * item.quantity;
    }, 0);

    setCalculatorState((prev) => ({ ...prev, totalPrice: total }));
  }, [calculatorState.items, suppliersAndProducts]);

  useEffect(() => {
    if (!setSolarData) return;
    const panelItem = calculatorState.items.find(
      (item) => item.id === "solcellepanel"
    );
    if (panelItem) {
      setSolarData((prev) => {
        if (!prev) return prev!;
        return {
          ...prev,
          totalPanels: panelItem.quantity,
        };
      });
    }
  }, [calculatorState.items, setSolarData]);

  useEffect(() => {
    if (!setSolarData || !solarData) return;

    const { totalPanels, selectedPanelType } = solarData;
    if (!totalPanels || !selectedPanelType) {
      setSolarData((prev) => {
        if (!prev || prev.kwp === 0) return prev!;
        return { ...prev, kwp: 0 };
      });
      return;
    }

    const panelWp = getPanelWp(selectedPanelType);
    const newKwp = (totalPanels * panelWp) / 1000;

    setSolarData((prev) => {
      if (!prev || prev.kwp === newKwp) return prev!;
      return { ...prev, kwp: newKwp };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solarData?.totalPanels, solarData?.selectedPanelType, setSolarData]);

  if (!suppliers || suppliers.length === 0) return <p>Ingen suppliers</p>;
  if (!suppliersAndProducts || suppliersAndProducts.length === 0)
    return <p>Ingen supplierdata</p>;
  if (allCategories.length === 0) return <p>Laster kategorier...</p>;

  return (
    <div className="flex gap-2">
      <FacilityInfo solarData={solarData} setSolarData={setSolarData} />
      <div>
        <table className="w-full">
          <thead>
            <tr>
              <th colSpan={4} className="border p-2 bg-gray-100">
                SOLCELLE ANLEGG
              </th>
              <th className="font-bold">
                <button
                  className="bg-green-600 p-4 text-white"
                  onClick={() => setShowModal(true)}
                >
                  +
                </button>
              </th>
            </tr>
            <tr className="bg-gray-100">
              <th className="border p-2">Antall</th>
              <th className="border p-2">Utstyr</th>
              <th className="border p-2">Leverandør</th>
              <th className="border p-2">Pris eks. mva</th>
              <th className="border p-2">🗑️</th>
            </tr>
          </thead>
          <tbody>
            {calculatorState.items.map((item) => (
              <CalculatorRow
                key={item.id}
                item={item}
                suppliers={suppliers}
                suppliersAndProducts={suppliersAndProducts}
                allCategories={allCategories}
                onUpdate={(updates) => updateItem(item.id, updates)}
              />
            ))}
          </tbody>
        </table>

        <CalculationSheet
          calculatorState={calculatorState}
          suppliersAndProducts={suppliersAndProducts}
          mountItems={mountItems}
          solarData={solarData}
        />
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowModal(false)}
          >
            <div
              className="bg-white p-6 rounded-lg w-96 shadow"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-3">Legg til utstyr</h3>

              <select
                className="border w-full p-2 mb-2"
                value={newItem.categoryId || ""}
                onChange={(e) =>
                  setNewItem({
                    ...newItem,
                    categoryId: e.target.value,
                    subcategoryId: "",
                  })
                }
              >
                <option value="">Velg kategori...</option>
                {allCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <div className="flex justify-end gap-2">
                <button
                  className="px-3 py-2 bg-gray-300 rounded"
                  onClick={() => setShowModal(false)}
                >
                  Avbryt
                </button>
                <button
                  className="px-3 py-2 bg-green-600 text-white rounded"
                  onClick={handleAddItem}
                >
                  Legg til
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
