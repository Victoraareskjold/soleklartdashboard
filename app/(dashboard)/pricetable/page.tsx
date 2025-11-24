"use client";

import LoadingScreen from "@/app/components/LoadingScreen";
import ElectricalInstallationTable from "@/app/components/price-calculator/electrical/Table";
import CalculatorResults from "@/app/components/price-calculator/result/CalculatorResults";
import SupplierMarkupsTable from "@/app/components/price-calculator/supplier/SupplierMarkupsTable";
import SupplierTable from "@/app/components/price-calculator/supplier/Table";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { getSuppliersWithProducts, getSuppliers } from "@/lib/api";
import { Supplier, SupplierWithProducts } from "@/types/price_table";
import { useEffect, useState } from "react";
import { SolarData } from "@/app/components/SolarDataView";
import MountingTable from "@/app/components/price-calculator/work/MountingTable";
import VolumeReductionsTable from "@/app/components/price-calculator/work/VolumeReductionsTable";

export default function PriceTablePage() {
  const { installerGroupId } = useInstallerGroup();
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [suppliersAndProducts, setSuppliersAndProducts] = useState<
    SupplierWithProducts[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [solarData, setSolarData] = useState<SolarData>(() => {
    const defaultPanelType =
      (typeof window !== "undefined" && localStorage.getItem("defaultPanel")) ||
      "";
    return {
      selectedPanelType: defaultPanelType,
      totalPanels: 24,
      selectedRoofType: "Enkeltkrummet takstein",
      checkedRoofData: [
        {
          roofId: "",
          adjustedPanelCount: 0,
          maxPanels: 0,
          direction: "",
          angle: 0,
        },
      ],
    };
  });

  useEffect(() => {
    getSuppliers().then((data) => {
      setSuppliers(data);
    });
    getSuppliersWithProducts().then((data) => {
      setSuppliersAndProducts(data);
    });
    setLoading(false);
  }, []);

  if (loading || !suppliers || !suppliersAndProducts || !installerGroupId)
    return <LoadingScreen />;

  return (
    <div className="flex gap-2 p-2 bg-gray-50 min-h-screen">
      <div className="w-full flex flex-col gap-12 py-8 mx-auto">
        {/* Calculator Results Section */}
        <div className="bg-white shadow-lg rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Priskalkulator
          </h2>
          <CalculatorResults
            suppliers={suppliers}
            suppliersAndProducts={suppliersAndProducts}
            solarData={solarData}
            setSolarData={setSolarData}
          />
        </div>

        {/* Pricing Rules and Installation Tables Section */}
        <div className="bg-white shadow-lg rounded-xl p-6">
          <div className="space-y-8">
            <SupplierMarkupsTable />
            <ElectricalInstallationTable installerGroupId={installerGroupId} />
            <MountingTable
              suppliersAndProducts={suppliersAndProducts}
              installerGroupId={installerGroupId}
            />
            <VolumeReductionsTable installerGroupId={installerGroupId} />
          </div>
        </div>

        {/* Supplier Table Section */}
        <div className="bg-white shadow-lg rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Leverandørprodukter
          </h2>
          <SupplierTable suppliersAndProducts={suppliersAndProducts} />
        </div>
      </div>
    </div>
  );
}
