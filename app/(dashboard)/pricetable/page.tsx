"use client";

import LoadingScreen from "@/app/components/LoadingScreen";
import ElectricalInstallationTable from "@/app/components/price-calculator/electrical/Table";
import CalculatorResults from "@/app/components/price-calculator/result/CalculatorResults";
import SupplierMarkupsTable from "@/app/components/price-calculator/supplier/SupplierMarkupsTable";
import SupplierTable from "@/app/components/price-calculator/supplier/Table";
import WorkTables from "@/app/components/price-calculator/work/WorkTables";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { getSuppliersWithProducts, getSuppliers } from "@/lib/api";
import { Supplier, SupplierWithProducts } from "@/types/price_table";
import { useEffect, useState } from "react";
import { SolarData } from "@/app/components/SolarDataView";

export default function PriceTablePage() {
  const { installerGroupId } = useInstallerGroup();
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [suppliersAndProducts, setSuppliersAndProducts] = useState<
    SupplierWithProducts[] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [solarData, setSolarData] = useState<SolarData>({
    selectedPanelType: "Jinka Solar 240w",
    totalPanels: 10,
    selectedRoofType: "Enkeltkrummet takstein",
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
    <div className="flex gap-2 p-2">
      <div className="w-full">
        <CalculatorResults
          suppliers={suppliers}
          suppliersAndProducts={suppliersAndProducts}
          solarData={solarData}
          setSolarData={setSolarData}
        />
        <ElectricalInstallationTable installerGroupId={installerGroupId} />
        <WorkTables suppliersAndProducts={suppliersAndProducts} />
        <SupplierMarkupsTable />
        <SupplierTable suppliersAndProducts={suppliersAndProducts} />
      </div>
    </div>
  );
}
