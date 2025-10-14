"use client";
import LoadingScreen from "@/app/components/LoadingScreen";
import PriceCalculatorTable from "@/app/components/PriceCalculator/PriceCalculatorTable";
import PriceTableEditor from "@/app/components/PriceCalculator/PriceTableEditor";
import SupplierTable from "@/app/components/PriceCalculator/SupplierTable";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { getPriceTable } from "@/lib/api";
import { PriceTable } from "@/types/price";
import { useEffect, useState } from "react";

export default function PriceTablePage() {
  const { installerGroupId } = useInstallerGroup();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [table, setTable] = useState<PriceTable | null>(null);
  const [prices, setPrices] = useState<PriceTable["prices"]>({});
  const [suppliers, setSuppliers] = useState<PriceTable["suppliers"]>({});

  useEffect(() => {
    if (!installerGroupId) return;
    const fetchTable = async () => {
      try {
        const table = await getPriceTable(installerGroupId);
        setTable(table);
        setPrices(table?.prices ?? {});
        setSuppliers(table?.suppliers ?? {});
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTable();
  }, [installerGroupId]);

  if (loading || !installerGroupId || !table) return <LoadingScreen />;

  return (
    <div>
      <PriceCalculatorTable table={table} items={prices} />

      <PriceTableEditor
        installerGroupId={installerGroupId}
        table={table}
        prices={prices}
        setPrices={setPrices}
        setTable={setTable}
        saving={saving}
        setSaving={setSaving}
      />

      <SupplierTable
        installerGroupId={installerGroupId}
        table={table}
        suppliers={suppliers}
        setSuppliers={setSuppliers}
        setTable={setTable}
        saving={saving}
        setSaving={setSaving}
      />
    </div>
  );
}
