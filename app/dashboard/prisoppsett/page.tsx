"use client";

// Midlertidig testadresse. Samme komponent ligger nå på /dashboard/pricetable; denne siden kan slettes.
import Prisoppsett from "@/app/components/kalkulator/Prisoppsett";
import { useInstallerGroup } from "@/context/InstallerGroupContext";

export default function PrisoppsettPage() {
  const { installerGroupId } = useInstallerGroup();
  return <Prisoppsett installerGroupId={installerGroupId} />;
}
