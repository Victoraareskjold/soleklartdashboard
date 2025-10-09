"use client";
import LoadingScreen from "@/app/components/LoadingScreen";
import PriceCalculatorTable from "@/app/components/PriceCalculator/PriceCalculatorTable";
import PriceTableEditor from "@/app/components/PriceCalculator/PriceTableEditor";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { getPriceTable } from "@/lib/api";
import { PriceTable } from "@/types/price";
import { useEffect, useState } from "react";

export default function PriceTablePage() {
  const { installerGroupId } = useInstallerGroup();

  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState<PriceTable | null>(null);
  const [items, setItems] = useState<PriceTable["items"]>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!installerGroupId) return;
    const fetchTable = async () => {
      try {
        const table = await getPriceTable(installerGroupId);
        setTable(table);
        setItems(table?.items ?? {});
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
      <PriceCalculatorTable table={table} items={items} />
      <PriceTableEditor
        installerGroupId={installerGroupId}
        table={table}
        items={items}
        setItems={setItems}
        setTable={setTable}
        saving={saving}
        setSaving={setSaving}
      />
    </div>
  );
}
