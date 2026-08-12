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

  // Ny state for å vite når localStorage er ferdig lest
  const [isStorageReady, setIsStorageReady] = useState(false);

  const [solarData, setSolarData] = useState<SolarData>({
    defaultPanelSupplierId: "",
    defaultPanelProductId: "",
    defaultFesteSupplierId: "",
    defaultInverterSupplierId: "",
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
  });

  // Last inn fra localStorage
  useEffect(() => {
    if (!installerGroupId) return;

    const panelSupplierId =
      localStorage.getItem(`defaultPanelSupplierId_${installerGroupId}`) || "";
    const panelProductId =
      localStorage.getItem(`defaultPanelProductId_${installerGroupId}`) || "";
    const festeId =
      localStorage.getItem(`defaultFesteSupplierId_${installerGroupId}`) || "";
    const inverterId =
      localStorage.getItem(`defaultInverterSupplierId_${installerGroupId}`) ||
      "";

    setSolarData((prev) => ({
      ...prev,
      defaultPanelSupplierId: panelSupplierId,
      defaultPanelProductId: panelProductId,
      defaultFesteSupplierId: festeId,
      defaultInverterSupplierId: inverterId,
    }));

    // Nå vet vi at vi har prøvd å hente verdiene
    setIsStorageReady(true);
  }, [installerGroupId]);

  useEffect(() => {
    Promise.all([getSuppliers(), getSuppliersWithProducts()]).then(
      ([s, sp]) => {
        setSuppliers(s);
        setSuppliersAndProducts(sp);
        setLoading(false);
      },
    );
  }, []);

  // Oppdatert sjekk: Vi venter spesifikt på isStorageReady
  if (
    loading ||
    !isStorageReady ||
    !suppliers ||
    !suppliersAndProducts ||
    !installerGroupId ||
    !teamId
  ) {
    return <LoadingScreen />;
  }

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
            finished={false}
            leadId={""}
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
