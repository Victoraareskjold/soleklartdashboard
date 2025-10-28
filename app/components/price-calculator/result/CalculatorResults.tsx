import { Supplier, SupplierWithProducts } from "@/types/price_table";

interface CalculatorResultsProps {
  suppliers: Supplier[] | null;
  suppliersAndProducts: SupplierWithProducts[] | null;
}

export default function CalculatorResults({
  suppliers,
  suppliersAndProducts,
}: CalculatorResultsProps) {
  if (!suppliers || suppliers.length === 0) return <p>Ingen suppliers</p>;
  if (!suppliersAndProducts || suppliersAndProducts.length === 0)
    return <p>Ingen supplierdata</p>;

  return (
    <div>
      <table>
        <thead>
          <tr>
            <td colSpan={2}>
              <select className="bg-red-300 p-2">
                {suppliers.map((supplier) => {
                  return (
                    <option key={supplier.id}>
                      Leverandør {supplier.name}
                    </option>
                  );
                })}
              </select>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Solcellepanel</td>
            <td>
              <select className="bg-gray-100 p-2">
                {suppliersAndProducts
                  .flatMap((supplier) => supplier.products)
                  .filter(
                    (product) =>
                      product.category?.name.toUpperCase() === "SOLCELLEPANEL"
                  )
                  .map((product) => (
                    <option key={product.id}>{product.name}</option>
                  ))}
              </select>
            </td>
          </tr>
          <tr>
            <td>Inverter</td>
            <td>
              <select className="bg-gray-100 p-2">
                {suppliersAndProducts
                  .flatMap((supplier) => supplier.products)
                  .filter(
                    (product) =>
                      product.category?.name.toUpperCase() === "INVERTER"
                  )
                  .map((product) => (
                    <option key={product.id}>{product.name}</option>
                  ))}
              </select>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
