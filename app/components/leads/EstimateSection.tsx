import { useEffect, useState } from "react";
import CalculatorResults from "../price-calculator/result/CalculatorResults";
import { SolarData } from "../SolarDataView";
import {
  PriceOverview,
  Supplier,
  SupplierWithProducts,
} from "@/types/price_table";
import {
  createEstimate,
  getSuppliers,
  getSuppliersWithProducts,
} from "@/lib/api";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import { supabase } from "@/lib/supabase";
import { CreateEstimateInput, Estimate } from "@/lib/types";
import { getPanelWp } from "@/utils/getPanelWp";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import LoadingScreen from "../LoadingScreen";

interface EstimateSectionProps {
  solarData: SolarData;
  setSolarData: React.Dispatch<React.SetStateAction<SolarData>>;
  onEstimateCreated?: (newEstimate: Estimate) => void;
  ownConsumption: number;
  leadCompany?: string | null;
}

export default function EstimateSection({
  solarData,
  setSolarData,
  onEstimateCreated,
  ownConsumption,
  leadCompany,
}: EstimateSectionProps) {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [suppliersAndProducts, setSuppliersAndProducts] = useState<
    SupplierWithProducts[] | null
  >(null);
  const [priceOverview, setPriceOverview] = useState<PriceOverview | null>(
    null,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const params = useParams();
  const leadId = params.leadId as string;

  const [initialSolarData, setInitialSolarData] = useState<SolarData | null>(
    null,
  );
  const [finished, setFinished] = useState(false);

  const [isStorageReady, setIsStorageReady] = useState(false);
  const { installerGroupId } = useInstallerGroup();

  useEffect(() => {
    if (
      solarData.totalPanels! > 0 &&
      solarData.yearlyProd! > 0 &&
      !initialSolarData
    ) {
      setInitialSolarData(solarData);
    }
  }, [solarData, initialSolarData]);

  useEffect(() => {
    getSuppliers().then((data) => {
      setSuppliers(data);
    });
    getSuppliersWithProducts().then((data) => {
      setSuppliersAndProducts(data);
    });
  }, []);

  useEffect(() => {
    if (!installerGroupId) {
      setIsStorageReady(true);
      return;
    }

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

    setIsStorageReady(true);
  }, [installerGroupId, setSolarData]);

  const wrappedSetSolarData = (action: React.SetStateAction<SolarData>) => {
    setSolarData((prevSolarData) => {
      const newSolarData =
        typeof action === "function" ? action(prevSolarData) : action;

      if (
        initialSolarData &&
        (newSolarData.totalPanels !== prevSolarData.totalPanels ||
          newSolarData.selectedPanelType !== prevSolarData.selectedPanelType)
      ) {
        const initialPanelWp = getPanelWp(initialSolarData.selectedPanelType!);
        const initialKwp =
          (initialSolarData.totalPanels! * initialPanelWp) / 1000;

        const newPanelWp = getPanelWp(newSolarData.selectedPanelType!);
        const newKwp = (newSolarData.totalPanels! * newPanelWp) / 1000;

        if (initialKwp > 0) {
          const newYearlyProd =
            (initialSolarData.yearlyProd! / initialKwp) * newKwp;
          return {
            ...newSolarData,
            yearlyProd: Math.round(newYearlyProd),
            kwp: newKwp,
          };
        }
      }

      return newSolarData;
    });
  };

  const handleCreateEstimate = async () => {
    if (!solarData || !priceOverview) {
      toast.warn("Mangler data for å opprette estimat.");
      return;
    }

    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const filePath = `${leadId}/${imageFile.name}-${Date.now()}`;
        const { error: uploadError } = await supabase.storage
          .from("estimate-images")
          .upload(filePath, imageFile);

        if (uploadError) {
          throw new Error(`Bildeopplasting feilet: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from("estimate-images")
          .getPublicUrl(filePath);

        if (!publicUrlData) {
          throw new Error("Kunne ikke hente offentlig URL for bilde.");
        }
        imageUrl = publicUrlData.publicUrl;
      }

      console.log(priceOverview);

      const newEstimate = await createEstimate({
        lead_id: leadId,
        solarData,
        price_data: priceOverview,
        imageUrl,
        finished,
      } as CreateEstimateInput);

      toast.success("Estimat og prisestimat opprettet!");
      if (onEstimateCreated) {
        onEstimateCreated(newEstimate);
      }
    } catch (err) {
      console.error("Kunne ikke opprette estimat:", err);
      toast.error(
        err instanceof Error ? err.message : "En ukjent feil oppstod.",
      );
    }
  };

  if (!isStorageReady || !suppliers || !suppliersAndProducts) {
    return <LoadingScreen />;
  }

  return (
    <>
      <div>
        <label htmlFor="finished" className="mr-2">
          Ferdigstilt?
        </label>
        <input
          id="finished"
          type="checkbox"
          checked={finished}
          onChange={(e) => setFinished(e.target.checked)}
        />
      </div>
      <CalculatorResults
        suppliers={suppliers}
        suppliersAndProducts={suppliersAndProducts}
        solarData={solarData}
        setSolarData={wrappedSetSolarData}
        setPriceOverview={setPriceOverview}
        ownConsumption={ownConsumption}
        leadCompany={leadCompany}
      />
      <div className="mt-4">
        <label
          htmlFor="estimate-image"
          className="block text-sm font-medium text-gray-700"
        >
          Last opp bilde (valgfritt)
        </label>
        <input
          type="file"
          id="estimate-image"
          name="estimate-image"
          accept="image/*"
          onChange={(e) =>
            setImageFile(e.target.files ? e.target.files[0] : null)
          }
          className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
        />
      </div>
      <button
        className="bg-[#FF8E4C] text-white px-6 py-2 rounded-md mt-4 w-full"
        onClick={handleCreateEstimate}
      >
        Opprett estimat
      </button>
    </>
  );
}
