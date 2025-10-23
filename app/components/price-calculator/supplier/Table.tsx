import { SupplierWithProducts, Product } from "@/types/price_table";
import React from "react";

interface SupplierTableProps {
  suppliers: SupplierWithProducts[] | null;
}

const MASTER_PRODUCTS = [
  {
    name: "SOLCELLEPANEL",
  },
  {
    name: "INVERTER",
    subcategories: ["inverter 230v", "inverter 400v"],
  },
  {
    name: "BATTERI",
    subcategories: ["batteri 5kWh", "batteri 10kWh"],
  },
  {
    name: "TILBEHØR",
    subcategories: ["kabel", "montasjeutstyr"],
  },
];

export default function SupplierTable({ suppliers }: SupplierTableProps) {
  if (!suppliers || suppliers.length === 0) return <p>Ingen suppliers</p>;

  return (
    <div className="overflow-auto p-2">
      {suppliers.map((supplier) => (
        <div key={supplier.id}>
          <h2 className="text-xl font-bold mb-8">{supplier.name}</h2>

          {MASTER_PRODUCTS.map((cat) => (
            <div key={cat.name} className="mb-4">
              <h2 className="text-xl font-bold">{cat.name}</h2>

              {cat.subcategories && cat.subcategories.length > 0 ? (
                cat.subcategories.map((subcat) => {
                  const productsInSubcat = supplier.products.filter(
                    (p: Product) =>
                      p.category?.toUpperCase() === cat.name.toUpperCase() &&
                      p.subcategory?.toLowerCase() === subcat.toLowerCase()
                  );

                  return (
                    <div key={subcat}>
                      <div className="w-full bg-gray-200">
                        <h3 className="font-semibold">{subcat}</h3>
                      </div>

                      <ProductTable products={productsInSubcat} />
                    </div>
                  );
                })
              ) : (
                <ProductTable
                  products={supplier.products.filter(
                    (p: Product) =>
                      p.category?.toUpperCase() === cat.name.toUpperCase()
                  )}
                />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ProductTable({ products }: { products: Product[] }) {
  return (
    <table className="w-full border-collapse border border-gray-300">
      <thead>
        <tr className="bg-gray-100">
          <th className="border p-1 w-1/3">Vedlegg</th>
          <th className="border p-1 w-1/3">Navn</th>
          <th className="border p-1 w-1/3">Pris eks. mva</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td className="border p-1 w-1/3">
              {product.attachment && (
                <a
                  href={product.attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📎
                </a>
              )}
            </td>
            <td className="border w-1/3">
              <input
                className="w-full p-1"
                value={product.name}
                type="text"
                readOnly
                disabled
              />
            </td>
            <td className="border w-1/3">
              <input
                className="w-full p-1"
                value={product.price_ex_vat.toLocaleString("no-NO")}
                type="number"
                // TODO
                readOnly
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
