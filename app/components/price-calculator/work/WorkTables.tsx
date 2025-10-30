import { useInstallerGroup } from "@/context/InstallerGroupContext";
import MountingTable from "./MountingTable";
import { SupplierWithProducts } from "@/types/price_table";
import LoadingScreen from "../../LoadingScreen";

interface WorkTablesProps {
  suppliersAndProducts: SupplierWithProducts[];
}

export default function WorkTables({ suppliersAndProducts }: WorkTablesProps) {
  const { installerGroupId } = useInstallerGroup();

  if (!installerGroupId) return <LoadingScreen />;

  return (
    <div>
      <MountingTable
        suppliersAndProducts={suppliersAndProducts}
        installerGroupId={installerGroupId}
      />
    </div>
  );
}
