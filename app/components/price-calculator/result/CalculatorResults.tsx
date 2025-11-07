import { Supplier, SupplierWithProducts } from "@/types/price_table";
import { useState, useMemo, useEffect } from "react";
import { getCategories, getMountItems } from "@/lib/api";
import CalculationSheet from "./CalculationSheet";
import CalculatorRow from "./CalculatorRow";
import { SolarData } from "../../SolarDataView";
import { useInstallerGroup } from "@/context/InstallerGroupContext";

interface CalculatorResultsProps {
  suppliers: Supplier[] | null;
  suppliersAndProducts: SupplierWithProducts[] | null;
  solarData?: SolarData;
}

export interface CalculatorItem {
  id: string;
  displayName: string;
  dbName: string;
  categoryId: string;
  subcategoryId?: string;
  quantity: number;
  supplierId: string;
  productId: string;
  defaultSupplier?: string;
  defaultProduct?: string;
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
};

export default function CalculatorResults({
  suppliers,
  suppliersAndProducts,
  solarData,
}: CalculatorResultsProps) {
  const { installerGroupId } = useInstallerGroup();
  const [allCategories, setAllCategories] = useState<
    CategoryWithSubcategories[]
  >([]);

  useEffect(() => {
    getCategories().then(setAllCategories);
  }, []);
  const [showModal, setShowModal] = useState(false);

  const [calculatorState, setCalculatorState] = useState<CalculatorState>({
    items: [
      {
        id: "panel",
        displayName: "Panel",
        dbName: "SOLCELLEPANEL",
        categoryId: "",
        quantity: solarData?.totalPanels || 1,
        supplierId: "",
        productId: "",
        defaultSupplier: "Solar Technologies Scandinavia AS",
        defaultProduct: "Jinka Solar 240w",
      },
      {
        id: "feste",
        displayName: "Feste",
        dbName: "FESTEMATERIELL LØSNING",
        categoryId: "",
        quantity: solarData?.totalPanels || 1,
        supplierId: "",
        productId: "",
        defaultSupplier: "Solar Technologies Scandinavia AS",
      },
      {
        id: "inverter",
        displayName: "Inverter",
        dbName: "INVERTER",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        productId: "",
      },
      {
        id: "stillase",
        displayName: "Stillase",
        dbName: "STILLASE",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        productId: "",
      },
      {
        id: "frakt",
        displayName: "Frakt",
        dbName: "FRAKT",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        productId: "",
      },
      /* {
        id: "battery",
        displayName: "Batteri",
        dbName: "BATTERI",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        productId: "",
      },
      {
        id: "ballastein",
        displayName: "Ballastein",
        dbName: "BALLASTEIN",
        categoryId: "",
        quantity: 1,
        supplierId: "",
        productId: "",
      },
      {
        id: "solcellekran",
        displayName: "Solcellekran",
        dbName: "SOLCELLEKRAN",
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
    dbName: "",
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
        const cat = allCategories.find((c) => c.name === item.dbName);
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

  // hent feste hvis vi har solarData
  useEffect(() => {
    async function fetchMountItem() {
      if (!solarData?.selectedRoofType || !installerGroupId) return;
      try {
        const mountItems = await getMountItems(installerGroupId);

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
                }
              : item
          ),
        }));
      } catch (err) {
        console.error("Failed to load mount item:", err);
      }
    }

    fetchMountItem();
  }, [installerGroupId, solarData?.selectedRoofType]);

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
          dbName: category?.name?.toUpperCase() || "UKJENT",
          categoryId: newItem.categoryId!,
          quantity: newItem.quantity || 1,
          supplierId: newItem.supplierId || "",
          productId: newItem.productId || "",
        },
      ],
    }));

    setNewItem({
      displayName: "",
      dbName: "",
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

      return sum + product.price_ex_vat * item.quantity;
    }, 0);

    setCalculatorState((prev) => ({ ...prev, totalPrice: total }));
  }, [calculatorState.items, suppliersAndProducts]);

  if (!suppliers || suppliers.length === 0) return <p>Ingen suppliers</p>;
  if (!suppliersAndProducts || suppliersAndProducts.length === 0)
    return <p>Ingen supplierdata</p>;
  if (allCategories.length === 0) return <p>Laster kategorier...</p>;

  return (
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
      {/*  <pre className="text-red-500">
        {JSON.stringify(solarData) || "no data"}
      </pre> */}

      <CalculationSheet
        calculatorState={calculatorState}
        suppliersAndProducts={suppliersAndProducts}
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
  );
}
