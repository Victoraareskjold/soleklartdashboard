"use client";
import LoadingScreen from "@/app/components/LoadingScreen";
import PriceTableEditor from "@/app/components/PriceCalculator/PriceTableEditor";
import { useInstallerGroup } from "@/context/InstallerGroupContext";

export default function PriceTablePage() {
  const { installerGroupId } = useInstallerGroup();
  if (!installerGroupId) return <LoadingScreen />;
  return <PriceTableEditor installerGroupId={installerGroupId} />;
}
