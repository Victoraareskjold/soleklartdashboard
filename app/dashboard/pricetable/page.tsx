"use client";

// Priskalkulator: prisberegning, felles produktkatalog og prisavtaler (ny kalkulator).
// Gammel versjon: docs/backup-gammel-kalkulator/pricetable-page.tsx.bak
import Prisoppsett from "@/app/components/kalkulator/Prisoppsett";
import { useInstallerGroup } from "@/context/InstallerGroupContext";

export default function PriceTablePage() {
  const { installerGroupId } = useInstallerGroup();
  return <Prisoppsett installerGroupId={installerGroupId} />;
}
