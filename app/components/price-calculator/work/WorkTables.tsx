import { useInstallerGroup } from "@/context/InstallerGroupContext";
import LoadingScreen from "../../LoadingScreen";
import VolumeReductionsTable from "./VolumeReductionsTable";

export default function WorkTables() {
  const { installerGroupId } = useInstallerGroup();

  if (!installerGroupId) return <LoadingScreen />;

  return <div></div>;
}
