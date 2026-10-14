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
import { Calculator, Package, SlidersHorizontal } from "lucide-react";

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
    <div className="sk-page">
      <div className="sk-page-header">
        <div>
          <p className="sk-eyebrow">Prising</p>
          <h1 className="sk-page-title">Pristabell</h1>
          <p className="sk-page-subtitle">
            Priskalkulator, påslag, arbeidskostnader og leverandørprodukter.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Calculator Results Section */}
        <section className="sk-card">
          <div className="sk-card-header">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Calculator size={16} />
              </span>
              <h2 className="sk-section-title">Priskalkulator</h2>
            </div>
          </div>
          <div className="sk-card-body">
            <CalculatorResults
              suppliers={suppliers}
              suppliersAndProducts={suppliersAndProducts}
              solarData={solarData}
              setSolarData={setSolarData}
              finished={false}
              leadId={""}
            />
          </div>
        </section>

        {/* Pricing Rules and Installation Tables Section */}
        <section className="sk-card">
          <div className="sk-card-header">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <SlidersHorizontal size={16} />
              </span>
              <h2 className="sk-section-title">Påslag og arbeid</h2>
            </div>
          </div>
          <div className="sk-card-body flex flex-col gap-8">
            <SupplierMarkupsTable />
            <ElectricalInstallationTable installerGroupId={installerGroupId} />
            <MountingTable
              suppliersAndProducts={suppliersAndProducts}
              installerGroupId={installerGroupId}
            />
            <VolumeReductionsTable installerGroupId={installerGroupId} />
            <TeamCommissionTable teamId={teamId} />
          </div>
        </section>

        {/* Supplier Table Section */}
        <section className="sk-card">
          <div className="sk-card-header">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <Package size={16} />
              </span>
              <h2 className="sk-section-title">Leverandørprodukter</h2>
            </div>
          </div>
          <div className="sk-card-body">
            <SupplierTable suppliersAndProducts={suppliersAndProducts} />
          </div>
        </section>
      </div>
    </div>
  );
}
