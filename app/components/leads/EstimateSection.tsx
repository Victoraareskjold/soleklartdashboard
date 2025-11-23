import { useEffect, useState } from "react";
import CalculatorResults from "../price-calculator/result/CalculatorResults";
import { SolarData } from "../SolarDataView";
import { Supplier, SupplierWithProducts } from "@/types/price_table";
import { getSuppliers, getSuppliersWithProducts } from "@/lib/api";

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

  useEffect(() => {
    getSuppliers().then((data) => {
      setSuppliers(data);
    });
    getSuppliersWithProducts().then((data) => {
      setSuppliersAndProducts(data);
    });
  }, []);

  return (
    <>
      <CalculatorResults
        suppliers={suppliers}
        suppliersAndProducts={suppliersAndProducts}
        solarData={solarData}
        setSolarData={setSolarData}
      />
    </>
  );
}
