import { SupplierWithProducts } from "@/types/price_table";
import { CalculatorState } from "./CalculatorResults";

interface CalculationSheetProps {
  calculatorState: CalculatorState;
  suppliersAndProducts: SupplierWithProducts[];
}

export default function CalculationSheet({
  calculatorState,
  suppliersAndProducts,
}: CalculationSheetProps) {
  const items = calculatorState.items.map((item) => {
    if (!item.supplierId || !item.productId) {
      return {
        id: item.id,
        name: item.displayName,
        price: 0,
      };
    }

    const supplier = suppliersAndProducts.find((s) => s.id === item.supplierId);
    const product = supplier?.products.find((p) => p.id === item.productId);

    const price = product ? product.price_ex_vat * item.quantity : 0;

    return {
      id: item.id,
      name: item.displayName,
      price,
    };
  });

  const total = items.reduce((sum, i) => sum + i.price, 0);

  return (
    <div className="mt-8 border rounded-lg bg-white shadow p-4">
      <h3 className="text-lg font-semibold mb-3">Utregningsark</h3>
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Navn</th>
            <th className="p-2 text-right">Pris eks. mva</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t">
              <td className="p-2">{item.name}</td>
              <td className="p-2 text-right">{item.price.toFixed(2)} kr</td>
            </tr>
          ))}
          <tr className="border-t bg-gray-50 font-semibold">
            <td className="p-2 text-right">Totalt:</td>
            <td className="p-2 text-right">{total.toFixed(2)} kr</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
