import { Supplier, SupplierWithProducts } from "@/types/price_table";
import { useMemo } from "react";
import { CalculatorItem, CalculatorItemUpdate } from "./CalculatorResults";
import { CategoryWithSubcategories } from "../supplier/Table";

interface CalculatorRowProps {
  item: CalculatorItem;
  suppliers: Supplier[];
  suppliersAndProducts: SupplierWithProducts[];
  allCategories: CategoryWithSubcategories[];
  onUpdate: (updates: CalculatorItemUpdate) => void;
}

export default function CalculatorRow({
  item,
  suppliers,
  suppliersAndProducts,
  allCategories,
  onUpdate,
}: CalculatorRowProps) {
  const category = allCategories.find((c) => c.id === item.categoryId);
  const subcategory = item.subcategoryId
    ? category?.subcategories?.find((s) => s.id === item.subcategoryId)
    : null;

  const availableProducts = useMemo(() => {
    if (!item.supplierId) return [];

    const supplier = suppliersAndProducts.find((s) => s.id === item.supplierId);
    if (!supplier) return [];

    return supplier.products.filter((product) => {
      const categoryMatch = product.category?.id === item.categoryId;

      if (item.subcategoryId) {
        return categoryMatch && product.subcategory?.id === item.subcategoryId;
      }
      return categoryMatch;
    });
  }, [
    item.supplierId,
    item.categoryId,
    item.subcategoryId,
    suppliersAndProducts,
  ]);

  const selectedProduct = useMemo(() => {
    if (!item.productId || !availableProducts.length) return null;
    return availableProducts.find((p) => p.id === item.productId);
  }, [item.productId, availableProducts]);

  const handleQuantityChange = (value: string) => {
    const num = parseInt(value) || 0;
    onUpdate({ quantity: num });
  };

  const handleSupplierChange = (supplierId: string) => {
    onUpdate({ supplierId, productId: "" });
  };

  const handleProductChange = (productId: string) => {
    onUpdate({ productId });
  };

  const displayName = subcategory?.name || category?.name || "produkt";

  return (
    <tr>
      <td className="border p-2 text-center">
        <input
          type="number"
          min="0"
          value={item.quantity}
          onChange={(e) => handleQuantityChange(e.target.value)}
          className="w-full text-center"
        />
      </td>
      <td className="border p-2 flex items-center">
        <p className="w-42">{item.displayName}</p>
        <select
          className="bg-gray-100 p-2 w-full"
          value={item.productId}
          onChange={(e) => handleProductChange(e.target.value)}
          disabled={!item.supplierId || availableProducts.length === 0}
        >
          <option value="" disabled>
            {!item.supplierId
              ? "Velg leverandør først..."
              : availableProducts.length === 0
              ? `Ingen ${displayName.toLowerCase()} tilgjengelig`
              : `Velg ${displayName.toLowerCase()}...`}
          </option>
          {(() => {
            if (!category) return null;

            const grouped: Record<string, typeof availableProducts> = {};
            for (const product of availableProducts) {
              const subName = product.subcategory?.name || "";
              if (!grouped[subName]) grouped[subName] = [];
              grouped[subName].push(product);
            }

            const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
              if (a === "") return -1;
              if (b === "") return 1;
              return a.localeCompare(b);
            });

            return sortedGroups.map(([subName, products]) =>
              subName ? (
                <optgroup key={subName} label={subName}>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </optgroup>
              ) : (
                products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))
              )
            );
          })()}
        </select>
      </td>
      <td className="border p-2">
        <select
          className="bg-gray-100 p-2 w-full"
          value={item.supplierId}
          onChange={(e) => handleSupplierChange(e.target.value)}
        >
          <option value="">Velg leverandør...</option>
          {suppliers.map((sup) => (
            <option key={sup.id} value={sup.id}>
              {sup.name}
            </option>
          ))}
        </select>
      </td>
      <td className="border p-2 text-right">
        {selectedProduct && item.quantity > 0
          ? `${(selectedProduct.price_ex_vat * item.quantity).toFixed(2)} kr`
          : "0.00 kr"}
      </td>
      <td className="border p-2 text-center">
        <button
          className="hover:text-red-800"
          onClick={() => onUpdate({ _delete: true })}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
