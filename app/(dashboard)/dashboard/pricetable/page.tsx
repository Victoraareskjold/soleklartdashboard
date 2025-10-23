"use client";

import SupplierTable from "@/app/components/price-calculator/supplier/Table";
import { getSuppliersWithProducts } from "@/lib/api";
import { SupplierWithProducts } from "@/types/price_table";
import { useEffect, useState } from "react";

export default function PriceTablePage() {
  const [suppliers, setSuppliers] = useState<SupplierWithProducts[] | null>(
    null
  );

  useEffect(() => {
    getSuppliersWithProducts().then((data) => {
      setSuppliers(data);
    });
  }, []);

  return (
    <div>
      <SupplierTable suppliers={suppliers} />
    </div>
  );
}
