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

export default function PriceTablePage() {
  const { installerGroupId } = useInstallerGroup();
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [suppliersAndProducts, setSuppliersAndProducts] = useState<
    SupplierWithProducts[] | null
  >(null);
  const [loading, setLoading] = useState(true);

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
    <div className="flex flex-col gap-2 p-2">
      <CalculatorResults
        suppliers={suppliers}
        suppliersAndProducts={suppliersAndProducts}
      />
      <ElectricalInstallationTable installerGroupId={installerGroupId} />
      <WorkTables suppliersAndProducts={suppliersAndProducts} />
      <SupplierMarkupsTable />
      <SupplierTable suppliersAndProducts={suppliersAndProducts} />
    </div>
  );
}
