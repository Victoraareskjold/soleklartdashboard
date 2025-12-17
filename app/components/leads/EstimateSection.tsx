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

interface EstimateSectionProps {
  solarData: SolarData;
  setSolarData: React.Dispatch<React.SetStateAction<SolarData>>;
}

export default function EstimateSection({
  solarData,
  setSolarData,
}: EstimateSectionProps) {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [suppliersAndProducts, setSuppliersAndProducts] = useState<
    SupplierWithProducts[] | null
  >(null);
  const [priceOverview, setPriceOverview] = useState<PriceOverview | null>(
    null
  );
  const params = useParams();
  const leadId = params.leadId as string;

  useEffect(() => {
    getSuppliers().then((data) => {
      setSuppliers(data);
    });
    getSuppliersWithProducts().then((data) => {
      setSuppliersAndProducts(data);
    });
  }, []);

  const handleCreateEstimate = async () => {
    if (!solarData || !priceOverview) return;

    try {
      await createEstimate({
        lead_id: leadId,
        solarData,
        price_data: priceOverview,
      });

      toast.success("Estimat og prisestimat opprettet!");
    } catch (err) {
      console.error("Kunne ikke opprette estimat:", err);
    }
  };

  return (
    <>
      <CalculatorResults
        suppliers={suppliers}
        suppliersAndProducts={suppliersAndProducts}
        solarData={solarData}
        setSolarData={setSolarData}
        setPriceOverview={setPriceOverview}
      />
      <button
        className="bg-[#FF8E4C] text-white px-6 py-2 rounded-md mt-4 w-full"
        onClick={handleCreateEstimate}
      >
        Opprett estimat
      </button>
    </>
  );
}
