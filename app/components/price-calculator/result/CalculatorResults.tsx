"use client";
import {
  MountItem,
  PriceOverview,
  Product,
  Supplier,
  SupplierWithProducts,
} from "@/types/price_table";
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
  setPriceOverview?: (priceOverview: PriceOverview | null) => void;
  ownConsumption?: number | null;
  leadCompany?: string | null;
  finished: boolean;
  leadId: string;
}

export interface CalculatorItem {
  id: string;
  displayName: string;
  categoryId?: string;
  subcategoryId?: string;
  quantity: number;
  supplierId: string;
  productId: string;
  defaultSupplierId?: string;
  defaultProductId?: string;
  mountPricePer?: number;
  index?: number;
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
  setPriceOverview,
  ownConsumption,
  leadCompany,
  finished,
  leadId,
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
        defaultSupplierId: solarData?.defaultPanelSupplierId || "",
        productId: "",
        defaultProductId: solarData?.defaultPanelProductId || "",
        index: 1,
      },
      {
        id: "feste",
        displayName: "Feste",
        categoryId: "",
        quantity: solarData?.totalPanels || 1,
        supplierId: "",
        productId: "",
        defaultSupplierId: solarData?.defaultFesteSupplierId || "",
        index: 2,
      },
      {
        id: "inverter",
        displayName: "Inverter",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        defaultSupplierId: solarData?.defaultInverterSupplierId || "",
        productId: "",
        index: 3,
      },
      {
        id: "stillase",
        displayName: "Stillase",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        productId: "1557c4ef-2e78-41ef-904c-8113d8ba76cd",
        defaultSupplierId: "ba4f75fd-26fd-44ef-9c18-25110d3b4448",
        defaultProductId: "1557c4ef-2e78-41ef-904c-8113d8ba76cd",
        index: 4,
      },
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
        if (!item.defaultSupplierId) return item;

        const found = suppliers.find((s) => s.id === item.defaultSupplierId);

        return found ? { ...item, supplierId: found.id } : item;
      }),
    }));
  }, [suppliers]);

  // Auto-add ballastein for flatt tak
  useEffect(() => {
    if (!solarData?.selectedRoofType) return;

    const isFlatRoof = solarData.selectedRoofType.toLowerCase() === "flatt tak";

    setCalculatorState((prev) => {
      const ballasteinCategory = allCategories.find(
        (c) => c.name === "ballastein",
      );

      const ballasteinExists = prev.items.some(
        (item) => item.id === "ballastein",
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
              index: 8,
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

  // Auto-add crane-logic
  useEffect(() => {
    if (!suppliersAndProducts || suppliersAndProducts.length === 0) return;
    if (!solarData?.totalPanels) return;

    const shouldAddCrane = solarData.totalPanels > 72;

    setCalculatorState((prev) => {
      const craneExists = prev.items.some((i) => i.id === "solcellekran");
      if (shouldAddCrane && !craneExists) {
        const allProducts = suppliersAndProducts.flatMap((s) =>
          s.products.map((p) => ({ ...p, supplierId: s.id })),
        );
        const solarCrane = allProducts.find((p) =>
          p.name.toLowerCase().includes("solcellekran"),
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
              index: 7,
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
          (item) => item.roof_type?.name === solarData.selectedRoofType,
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
                  index: 2,
                }
              : item,
          ),
        }));
      } catch (err) {
        console.error("Failed to load mount item:", err);
      }
    }

    fetchMountItem();
  }, [installerGroupId, solarData?.selectedRoofType, mountItems]);

  // Auto-add stillase-logic
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
          s.products.map((p) => ({ ...p, supplierId: s.id })),
        );

        const standardPall = allProducts.find((p) =>
          p.name.toLowerCase().includes("standardpall"),
        );
        const europaPall = allProducts.find((p) =>
          p.name.toLowerCase().includes("europall"),
        );

        // Finn FRAKT kategori
        const fraktCategory = allCategories.find((c) => c.name === "frakt");

        setCalculatorState((prev) => {
          // Fjern eksisterende frakt-items for å unngå duplikater
          const itemsWithoutFrakt = prev.items.filter(
            (item) => item.id !== "frakt" && item.id !== "frakt2",
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
              index: 5,
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
              index: 6,
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

  // Auto-select inverter basert på valgt leverandør
  useEffect(() => {
    const effectiveKwp =
      solarData?.kwpMode === "manual"
        ? solarData.manualKwp
        : solarData?.autoKwp;

    if (
      !effectiveKwp ||
      !installerGroupId ||
      !suppliersAndProducts ||
      allCategories.length === 0
    )
      return;

    try {
      const desiredCapacity = effectiveKwp * 0.85;

      const inverterCategory = allCategories.find(
        (c) => c.name.toLowerCase() === "inverter",
      );

      const voltage = solarData?.voltage || 230;

      // Finn riktig subkategori basert på spenning
      const inverterSubcategory = inverterCategory?.subcategories?.find(
        (sub) => {
          const n = sub.name.toLowerCase();
          if (voltage === 400) {
            return (
              n.includes("400") || n.includes("3-fas") || n.includes("3fas")
            );
          }
          return n.includes("230") || n.includes("1-fas") || n.includes("1fas");
        },
      );

      // VIKTIG: Finn ut hvilken leverandør som er valgt i tabellen akkurat nå
      const currentInverter = calculatorState.items.find((item) =>
        item.id.startsWith("inverter"),
      );

      // Bruk eksisterende valg, eller fallback til default hvis tabellen er tom
      const activeSupplierId =
        currentInverter?.supplierId || solarData?.defaultInverterSupplierId;

      if (!activeSupplierId) {
        console.log("Ingen leverandør valgt for inverter ennå.");
        return;
      }

      // HENT KUN produkter fra den aktive leverandøren
      const supplier = suppliersAndProducts.find(
        (s) => s.id === activeSupplierId,
      );
      if (!supplier) return;

      const inverterProducts = supplier.products
        .filter((p) => p.subcategory?.id === inverterSubcategory?.id)
        .map((p) => ({
          ...p,
          supplierId: supplier.id,
          power: parseFloat(p.name.match(/(\d+\.?\d*)\s?kW/i)?.[1] || "0"),
        }))
        .filter((p) => p.power > 0)
        .sort((a, b) => b.power - a.power); // Størst først

      if (inverterProducts.length === 0) {
        console.log(
          `Leverandør ${supplier.name} har ingen passende invertere for ${voltage}V`,
        );
        return;
      }

      // Algoritme for å velge antall invertere (fra valgt leverandør)
      let remaining = desiredCapacity;
      const selected: { product: Product; quantity: number }[] = [];

      for (const p of inverterProducts) {
        if (remaining <= 0.5) break; // Stopper når vi er nær nok (f.eks 0.5kW rest)
        const qty = Math.floor(remaining / p.power);
        if (qty > 0) {
          selected.push({ product: p, quantity: qty });
          remaining -= qty * p.power;
        }
      }

      // Hvis vi har rest som er mer enn 0, men ingen mindre invertere passer,
      // legg til én av den minste inverteren for å dekke gapet
      if (remaining > 1 && inverterProducts.length > 0) {
        const smallestProduct = inverterProducts[inverterProducts.length - 1];
        selected.push({ product: smallestProduct, quantity: 1 });
      }

      if (selected.length === 0) return;

      setCalculatorState((prev) => {
        const itemsWithoutInverter = prev.items.filter(
          (item) => !item.id.startsWith("inverter"),
        );
        const newItems = selected.map((s, index) => ({
          id: `inverter-${index}`,
          displayName: "Inverter",
          categoryId: inverterCategory!.id,
          quantity: s.quantity,
          supplierId: activeSupplierId, // LÅST til valgt leverandør
          productId: s.product.id,
          index: 3,
        }));
        return { ...prev, items: [...itemsWithoutInverter, ...newItems] };
      });
    } catch (err) {
      console.error("Feil ved beregning av invertere:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    solarData?.kwpMode,
    solarData?.manualKwp,
    solarData?.autoKwp,
    solarData?.voltage,
  ]);

  useEffect(() => {
    if (!suppliersAndProducts || suppliersAndProducts.length === 0) return;

    setCalculatorState((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.productId || !item.supplierId || !item.defaultProductId)
          return item;

        const supplier = suppliersAndProducts.find(
          (s) => s.id === item.supplierId,
        );
        const product = supplier?.products.find(
          (p) => p.name.toLowerCase() === item.defaultProductId!.toLowerCase(),
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
          id: id,
          displayName:
            `${category?.name.charAt(0).toUpperCase()}${category?.name.slice(
              1,
            )}` || "Nytt utstyr",
          categoryId: newItem.categoryId!,
          quantity: newItem.quantity || 1,
          supplierId: newItem.supplierId || "",
          productId: newItem.productId || "",
          index: newItem.index,
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

    setCalculatorState((prev) => {
      const updatedItems = prev.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      );

      if (itemId === "solcellepanel" && updates.quantity !== undefined) {
        const newQty = updates.quantity;

        // FIX: Bruk setTimeout for å unngå "update while rendering"-feil
        if (setSolarData) {
          setTimeout(() => {
            setSolarData((prevSolar) => ({
              ...prevSolar,
              totalPanels: newQty,
            }));
          }, 0);
        }

        return {
          ...prev,
          items: updatedItems.map((item) =>
            item.id === "feste" ? { ...item, quantity: newQty } : item,
          ),
        };
      }
      return { ...prev, items: updatedItems };
    });

    // 2. Lagre preferanser i localStorage KUN når spesifikke felt endres
    if (updates.supplierId) {
      const keyMap: Record<string, string> = {
        solcellepanel: "defaultPanelSupplierId",
        feste: "defaultFesteSupplierId",
        inverter: "defaultInverterSupplierId",
      };
      if (keyMap[itemId]) {
        localStorage.setItem(
          `${keyMap[itemId]}_${installerGroupId}`,
          updates.supplierId,
        );
      }
    }

    if (itemId === "solcellepanel" && updates.productId) {
      // Finn produktnavnet for å lagre det (siden getPanelWp bruker navn)
      const supplier = suppliersAndProducts?.find(
        (s) =>
          s.id ===
          (updates.supplierId ||
            calculatorState.items.find((i) => i.id === itemId)?.supplierId),
      );
      const product = supplier?.products.find(
        (p) => p.id === updates.productId,
      );

      if (product) {
        localStorage.setItem(
          `defaultPanelProductId_${installerGroupId}`,
          product.name,
        );
        // Oppdater navnet i solarData så FacilityInfo etc. er syncet, men IKKE rør supplierId her
        setSolarData?.((prev) => ({
          ...prev,
          defaultPanelProductId: product.name,
        }));
      }
    }
  };

  useMemo(() => {
    if (!suppliersAndProducts) return;

    const total = calculatorState.items.reduce((sum, item) => {
      if (!item.productId || !item.supplierId) return sum;

      const supplier = suppliersAndProducts.find(
        (s) => s.id === item.supplierId,
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
      (item) => item.id === "solcellepanel",
    );
    if (panelItem) {
      setSolarData((prev) => {
        if (!prev || prev.totalPanels === panelItem.quantity) return prev;
        return {
          ...prev,
          totalPanels: panelItem.quantity,
        };
      });
    }
  }, [calculatorState.items, setSolarData]);

  useEffect(() => {
    if (!setSolarData || !suppliersAndProducts) return;
    if (solarData?.kwpMode === "manual") return;

    const panelItem = calculatorState.items.find(
      (i) => i.id === "solcellepanel",
    );
    if (!panelItem?.productId || !panelItem?.supplierId) return;

    const supplier = suppliersAndProducts.find(
      (s) => s.id === panelItem.supplierId,
    );
    const product = supplier?.products.find(
      (p) => p.id === panelItem.productId,
    );

    if (!product) return;

    const panelWp = getPanelWp(product.name);
    const newKwp = (panelItem.quantity * panelWp) / 1000;

    setSolarData((prev) => ({
      ...prev,
      autoKwp: newKwp,
      kwp: newKwp, // 👈 KRITISK for UI
      kwpMode: "auto", // 👈 paneler er autoritative
    }));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatorState.items, suppliersAndProducts]);

  if (!suppliers || suppliers.length === 0) return <p>Ingen suppliers</p>;
  if (!suppliersAndProducts || suppliersAndProducts.length === 0)
    return <p>Ingen supplierdata</p>;
  if (allCategories.length === 0) return <p>Laster kategorier...</p>;

  return (
    <div className="flex gap-2">
      <FacilityInfo
        solarData={solarData}
        setSolarData={setSolarData}
        ownConsumption={ownConsumption}
      />
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
              <th className="border p-2 w-32">Pris eks. mva</th>
              <th className="border p-2">🗑️</th>
            </tr>
          </thead>
          <tbody>
            {calculatorState.items
              .sort((a, b) => {
                const ai = a.index ?? Infinity;
                const bi = b.index ?? Infinity;
                return ai - bi;
              })

              .map((item) => (
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
          setPriceOverview={setPriceOverview}
          leadCompany={leadCompany}
          finished={finished}
          leadId={leadId}
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
                    {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}{" "}
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
