import {
  MountItem,
  SupplierCategory,
  SupplierWithProducts,
} from "@/types/price_table";
import { CalculatorState } from "./CalculatorResults";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useEffect, useState } from "react";
import {
  getElectricalInstallationItems,
  getSuppliersWithCategories,
} from "@/lib/api";
import { toast } from "react-toastify";
import { ElectricalInstallationItem } from "../supplier/Table";

interface CalculationSheetProps {
  calculatorState: CalculatorState;
  suppliersAndProducts: SupplierWithProducts[];
  mountItems: MountItem[];
}

export default function CalculationSheet({
  calculatorState,
  suppliersAndProducts,
  mountItems,
}: CalculationSheetProps) {
  const { installerGroupId } = useInstallerGroup();
  const [suppliersWithCategories, setSuppliersWithCategories] = useState<
    SupplierCategory[]
  >([]);
  const [eletricalData, setEletricalData] = useState<
    ElectricalInstallationItem[]
  >([]);

  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>(
    {}
  );

  const categoryMapping: Record<string, string> = {
    solcellepanel: "solcellemateriell",
    inverter: "solcellemateriell",
    feste: "montering",
    batteri: "solcellemateriell",
    stillase: "stillase",
    ballastein: "ballastein",
    frakt: "frakt",
  };

  console.log(mountItems);

  const getCategoryMarkup = (categoryName: string) => {
    const mappedName =
      categoryMapping[categoryName.toLowerCase()] || categoryName;
    const category = suppliersWithCategories.find(
      (c) => c.name.toLowerCase() === mappedName.toLowerCase()
    );
    return category?.markup_percentage || 0;
  };

  useEffect(() => {
    if (!installerGroupId) return;
    const fetchData = async () => {
      try {
        const data = await getSuppliersWithCategories(installerGroupId);
        const electricalData = await getElectricalInstallationItems(
          installerGroupId
        );
        setSuppliersWithCategories(data);
        setEletricalData(electricalData);
      } catch (error) {
        toast.error("Error fetching data:");
        console.error(error);
      }
    };

    fetchData();
  }, [installerGroupId]);

  // Find the section where items are created (around line 82-92)
  // Replace this part:

  const items = calculatorState.items
    .flatMap((item) => {
      if (!item.supplierId || !item.productId) {
        return [
          {
            id: item.id,
            name: item.displayName,
            price: 0,
            quantity: item.quantity,
            category: "unknown",
            source: "supplier",
            supplier: "Ukjent", // Add this line
            product: "", // Add this line for consistency
          },
        ];
      }

      const supplier = suppliersAndProducts.find(
        (s) => s.id === item.supplierId
      );
      const product = supplier?.products.find((p) => p.id === item.productId);

      if (!product) return [];

      const category = product.category?.name?.toLowerCase() || "ukjent";

      // LEVERANDØR-ITEM (alltid)
      const supplierItem = {
        id: item.id + "_supplier",
        name: item.displayName,
        product: product.name,
        supplier: supplier?.name || "Ukjent", // Add fallback here too
        category,
        quantity: item.quantity,
        source: "supplier",
        price: product.price_ex_vat * item.quantity,
      };

      // Hvis ikke "feste" → kun leverandør-linje
      if (category !== "feste") {
        return [supplierItem];
      }

      // MONTERINGS-ITEM (kun feste)
      const mountMatch = mountItems.find((m) => m.product.id === product.id);

      const mountingItem = mountMatch
        ? {
            id: item.id + "_mount",
            name: item.displayName,
            product: product.name,
            supplier: supplier?.name || "Ukjent", // Add fallback here too
            category,
            quantity: item.quantity,
            source: "mounting",
            price:
              (mountMatch.price_per - product.price_ex_vat) * item.quantity,
          }
        : null;

      return mountingItem ? [supplierItem, mountingItem] : [supplierItem];
    })
    .filter((i) => i.quantity > 0 && i.supplier !== "Ukjent");

  const getFinalPrice = (itemId: string, calculatedPrice: number) => {
    return priceOverrides[itemId] ?? calculatedPrice;
  };

  const supplierItems = items.filter((i) => i.source === "supplier");

  const mountingItems = items.filter((i) => i.source === "mounting");

  const totalSupplierMarkup = supplierItems.reduce((sum, item) => {
    return sum + item.price;
  }, 0);

  const totalMountingMarkup = mountingItems.reduce((sum, item) => {
    const markup = getCategoryMarkup(item.category || "");
    const markupValue = item.price * (markup / 100);
    return sum + markupValue;
  }, 0);

  const total = items.reduce((sum, i) => sum + i.price, 0);

  const søknadItems = eletricalData.filter(
    (item) => item.category?.name?.toLowerCase() === "søknad"
  );

  const søknadTotal = søknadItems.reduce((sum, item) => {
    const base = item.price_per || 0;
    const extra = item.extra_costs || 0;
    return sum + base + extra;
  }, 0);

  const electricalMarkup = getCategoryMarkup("elektrisk installasjon");
  const søknadTotalWithMarkup = søknadTotal * (1 + electricalMarkup / 100);

  const solcelleAnleggItems = eletricalData.filter(
    (item) => item.category?.name?.toLowerCase() === "solcelleanlegg"
  );

  const solcelleAnleggBaseTotal = solcelleAnleggItems.reduce((sum, item) => {
    const base = item.price_per || 0;
    const extra = item.extra_costs || 0;
    return sum + base + extra;
  }, 0);

  const panelCount = supplierItems
    .filter((i) => i.category?.toLowerCase() === "feste")
    .reduce((sum, i) => sum + i.quantity, 0);

  const solcelleAnleggTotal =
    solcelleAnleggBaseTotal * panelCount * (1 + electricalMarkup / 100);

  const batteryCount = supplierItems
    .filter((i) => i.category?.toLowerCase() === "batteri")
    .reduce((sum, i) => sum + i.quantity, 0);
  const batteryOptions = eletricalData.filter(
    (item) => item.category?.name.toLowerCase() === "batteri"
  );
  const [selectedBatteryId, setSelectedBatteryId] = useState<string | null>(
    null
  );
  const selectedBattery = batteryOptions.find(
    (battery) => battery.id === selectedBatteryId
  );
  const batteryBasePrice =
    (selectedBattery?.price_per || 0) + (selectedBattery?.extra_costs || 0);
  const batteryTotal =
    batteryBasePrice * batteryCount * (1 + electricalMarkup / 100);

  const additionalCostOptions = eletricalData.filter(
    (item) => item.category?.name?.toLowerCase() === "tilleggskostnader"
  );
  const [additionalCosts, setAdditionalCosts] = useState<
    { id: string; quantity: number }[]
  >([]);

  const handleAddAdditionalCost = () => {
    setAdditionalCosts((prev) => [...prev, { id: "", quantity: 1 }]);
  };

  const handleRemoveAdditionalCost = (index: number) => {
    setAdditionalCosts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateAdditionalCost = (
    index: number,
    field: "id" | "quantity",
    value: string | number
  ) => {
    setAdditionalCosts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const søknadMarkup = søknadTotal * (electricalMarkup / 100);

  const solcelleAnleggMarkup =
    solcelleAnleggBaseTotal * panelCount * (electricalMarkup / 100);

  const batteryMarkup =
    batteryBasePrice * batteryCount * (electricalMarkup / 100);

  const additionalCostsMarkup = additionalCosts.reduce((sum, ac) => {
    const selectedItem = additionalCostOptions.find((i) => i.id === ac.id);
    const base =
      (selectedItem?.price_per || 0) + (selectedItem?.extra_costs || 0);
    return sum + base * ac.quantity * (electricalMarkup / 100);
  }, 0);

  const totalInstallationMarkup =
    søknadMarkup + solcelleAnleggMarkup + batteryMarkup + additionalCostsMarkup;

  const updatePriceOverride = (itemId: string, value: string) => {
    const price = Number(value);
    setPriceOverrides((prev) => ({
      ...prev,
      [itemId]: isNaN(price) ? 0 : price,
    }));
  };

  return (
    <div className="mt-8 border rounded-lg bg-white shadow p-4">
      <h3 className="text-lg font-medium mb-3">PRISOVERSIKT</h3>
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Navn</th>
            <th className="p-2 text-left">Antall</th>
            <th className="p-2 text-left">Kostnad eks. mva</th>
            <th className="p-2 text-right">Påslag i %</th>
            <th className="p-2 text-right">Pris inkl. mva</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <h2 className="p-1 font-bold">LEVERANDØRER</h2>
            </td>
          </tr>
          {supplierItems.map((item) => {
            const markup = getCategoryMarkup(item.category || "");
            const priceWithMarkup = item.price * (1 + markup / 100);
            return (
              <tr key={item.id}>
                <td className="p-2">
                  {item.name} - {item.supplier}
                </td>
                <td className="p-2 text-right">{item.quantity} stk.</td>
                <td className="p-2 text-right">{item.price.toFixed(2)} kr</td>
                <td className="p-2 text-right">{markup} %</td>
                <td className="p-2 text-right">
                  <input
                    value={getFinalPrice(item.id, priceWithMarkup).toFixed(2)}
                    onChange={(e) =>
                      updatePriceOverride(item.id, e.target.value)
                    }
                    className="text-right w-24"
                  />
                </td>
              </tr>
            );
          })}
          <tr className="text-gray-600">
            <td colSpan={4} className="p-2">
              Total leverandør påslag
            </td>
            <td className="p-2 text-right">
              {totalSupplierMarkup.toFixed(2)} kr
            </td>
          </tr>

          <tr>
            <td>
              <h2 className="p-1 font-bold">MONTERING</h2>
            </td>
          </tr>
          {mountingItems.map((item) => {
            const markup = getCategoryMarkup(item.category || "");
            const priceWithMarkup = item.price * (1 + markup / 100);
            return (
              <tr key={item.id}>
                <td className="p-2">
                  {item.name} - {item.supplier}
                </td>
                <td className="p-2 text-right">{item.quantity} stk.</td>
                <td className="p-2 text-right">{item.price.toFixed(2)} kr</td>
                <td className="p-2 text-right">{markup} %</td>
                <td className="p-2 text-right">
                  {priceWithMarkup.toFixed(2)} kr
                </td>
              </tr>
            );
          })}
          <tr className="text-gray-600">
            <td colSpan={4} className="p-2">
              Total montering påslag
            </td>
            <td className="p-2 text-right">
              {totalMountingMarkup.toFixed(2)} kr
            </td>
          </tr>

          <tr>
            <td>
              <h2 className="p-1 font-bold">INSTALLASJON</h2>
            </td>
          </tr>
          {søknadTotal > 0 && (
            <tr>
              <td className="p-2">Søknad</td>
              <td className="p-2 text-right">1 stk.</td>
              <td className="p-2 text-right">{søknadTotal.toFixed(2)} kr</td>
              <td className="p-2 text-right">{electricalMarkup} %</td>
              <td className="p-2 text-right">
                {søknadTotalWithMarkup.toFixed(2)} kr
              </td>
            </tr>
          )}
          {panelCount > 0 && (
            <tr>
              <td className="p-2 ">Solcelleanlegg - arbeid per inverter</td>
              <td className="p-2 text-right">{panelCount} stk.</td>
              <td className="p-2 text-right">
                {(solcelleAnleggBaseTotal * panelCount).toFixed(2)} kr
              </td>
              <td className="p-2 text-right">{electricalMarkup} %</td>
              <td className="p-2 text-right">
                {solcelleAnleggTotal.toFixed(2)} kr
              </td>
            </tr>
          )}
          {batteryCount > 0 && (
            <tr>
              <td className="p-2">
                Batteri{" "}
                <select
                  className="ml-2 border rounded p-1"
                  value={selectedBatteryId || ""}
                  onChange={(e) => setSelectedBatteryId(e.target.value)}
                >
                  <option value="">Arbeidsmetode</option>
                  {batteryOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (
                      {((b.price_per || 0) + (b.extra_costs || 0)).toFixed(2)}{" "}
                      kr)
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2 text-right">{batteryCount} stk.</td>
              <td className="p-2 text-right">
                {(batteryBasePrice * batteryCount).toFixed(2)} kr
              </td>
              <td className="p-2 text-right">{electricalMarkup} %</td>
              <td className="p-2 text-right">{batteryTotal.toFixed(2)} kr</td>
            </tr>
          )}
          {additionalCosts.map((ac, index) => {
            const selectedItem = additionalCostOptions.find(
              (i) => i.id === ac.id
            );
            const base =
              (selectedItem?.price_per || 0) + (selectedItem?.extra_costs || 0);
            const total = base * ac.quantity * (1 + electricalMarkup / 100);

            return (
              <tr key={index}>
                <td>
                  <button
                    onClick={() => handleRemoveAdditionalCost(index)}
                    className="pr-2 py-2 text-slate-500 hover:text-red-500 font-bold"
                  >
                    ×
                  </button>
                  <select
                    className="border rounded p-1"
                    value={ac.id}
                    onChange={(e) =>
                      handleUpdateAdditionalCost(index, "id", e.target.value)
                    }
                  >
                    <option value="">Velg tilleggskostnad</option>
                    {additionalCostOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} (
                        {(
                          (item.price_per || 0) + (item.extra_costs || 0)
                        ).toFixed(2)}{" "}
                        kr)
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    min="1"
                    value={ac.quantity}
                    onChange={(e) =>
                      handleUpdateAdditionalCost(
                        index,
                        "quantity",
                        Number(e.target.value)
                      )
                    }
                    className="w-14 border rounded p-1 text-left"
                  />
                </td>
                <td className="p-2 text-right">
                  {(base * ac.quantity).toFixed(2)} kr
                </td>
                <td className="p-2 text-right">{electricalMarkup} %</td>
                <td className="p-2 text-right font-medium">
                  {total.toFixed(2)} kr
                </td>
              </tr>
            );
          })}
          <tr>
            <td>
              <button
                onClick={handleAddAdditionalCost}
                className="text-red-500 p-2"
              >
                Legg til tileggskostnader
              </button>
            </td>
          </tr>

          <tr className="text-gray-600">
            <td colSpan={4} className="p-2">
              Total installasjon påslag
            </td>
            <td className="p-2 text-right">
              {totalInstallationMarkup.toFixed(2)} kr
            </td>
          </tr>

          <tr className="bg-gray-50 font-semibold">
            <td className="p-2 text-left">Totalt:</td>
            <td colSpan={4} className="p-2 text-right">
              {total.toFixed(2)} kr
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
