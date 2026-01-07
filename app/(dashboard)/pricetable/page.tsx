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
import TeamCommissionTable from "@/app/components/price-calculator/work/TeamCommissionTable";
import { useTeam } from "@/context/TeamContext";

export default function PriceTablePage() {
  const { installerGroupId } = useInstallerGroup();
  const { teamId } = useTeam();
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [suppliersAndProducts, setSuppliersAndProducts] = useState<
    SupplierWithProducts[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [solarData, setSolarData] = useState<SolarData>(() => {
    const defaultInverterSupplierId =
      (typeof window !== "undefined" &&
        localStorage.getItem("defaultInverterSupplier")) ||
      "";
    return {
      selectedPanelType: "",
      defaultInverterSupplierId,
      totalPanels: 1,
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

  useEffect(() => {
    if (!installerGroupId) return;

    const panelKey = `defaultPanel_${installerGroupId}`;
    const inverterKey = `defaultInverterSupplier_${installerGroupId}`;

    const savedPanel = localStorage.getItem(panelKey) || "";
    const savedInverter = localStorage.getItem(inverterKey) || "";

    setSolarData((prev) => ({
      ...prev,
      selectedPanelType: savedPanel || "",
      defaultInverterSupplierId: savedInverter || "",
    }));
  }, [installerGroupId]);

  if (
    loading ||
    !suppliers ||
    !suppliersAndProducts ||
    !installerGroupId ||
    !teamId
  )
    return <LoadingScreen />;

  return (
    <div className="flex gap-2 min-h-screen">
      <div className="w-full flex flex-col gap-12 mx-auto">
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
            <TeamCommissionTable teamId={teamId} />
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
