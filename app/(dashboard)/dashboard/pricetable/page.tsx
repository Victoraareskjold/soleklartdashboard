"use client";

import CalculatorResults from "@/app/components/price-calculator/result/CalculatorResults";
import SupplierTable from "@/app/components/price-calculator/supplier/Table";
import { getSuppliersWithProducts, getSuppliers } from "@/lib/api";
import { Supplier, SupplierWithProducts } from "@/types/price_table";
import { useEffect, useState } from "react";

export default function PriceTablePage() {
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
    <div>
      <CalculatorResults
        suppliers={suppliers}
        suppliersAndProducts={suppliersAndProducts}
      />
      {/* <SupplierTable suppliersAndProducts={suppliersAndProducts} /> */}
    </div>
  );
}
