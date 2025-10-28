import {
  addSupplierProduct,
  deleteSupplierProduct,
  updateSupplierPrice,
} from "@/lib/api";
import { SupplierWithProducts, Product } from "@/types/price_table";
import Link from "next/link";
import { useState } from "react";
import { toast } from "react-toastify";

interface SupplierTableProps {
  suppliersAndProducts: SupplierWithProducts[] | null;
}

interface AddProductModal {
  isOpen: boolean;
  supplierId: string;
  categoryId: string;
  subcategoryId: string | null;
  categoryName: string;
  subcategoryName?: string;
}

export default function SupplierTable({
  suppliersAndProducts,
}: SupplierTableProps) {
  const [suppliers, setSuppliers] = useState(suppliersAndProducts);
  const [modal, setModal] = useState<AddProductModal>({
    isOpen: false,
    supplierId: "",
    categoryId: "",
    subcategoryId: null,
    categoryName: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    price_ex_vat: "",
    attachment: "",
  });

  if (!suppliers || suppliers.length === 0) return <p>Ingen supplierdata</p>;

  const handleDeleteProduct = async (supplierId: string, productId: string) => {
    try {
      await deleteSupplierProduct(productId);

      // Oppdater state lokalt
      setSuppliers(
        suppliers.map((supplier) =>
          supplier.id === supplierId
            ? {
                ...supplier,
                products: supplier.products.filter((p) => p.id !== productId),
              }
            : supplier
        )
      );
      toast.success("Produkt slettet");
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Kunne ikke slette produkt");
    }
  };

  const handlePriceChange = async (productId: string, value: string) => {
    try {
      const price = value === "" ? 0 : parseFloat(value);
      await updateSupplierPrice(productId, price);
      setSuppliers((prev) =>
        (prev ?? []).map((s) => ({
          ...s,
          products: s.products.map((p) =>
            p.id === productId ? { ...p, price_ex_vat: price } : p
          ),
        }))
      );
      toast.success("Pris oppdatert!");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke oppdatere pris");
    }
  };

  const openModal = (
    supplierId: string,
    categoryId: string,
    categoryName: string,
    subcategoryId?: string,
    subcategoryName?: string
  ) => {
    setModal({
      isOpen: true,
      supplierId,
      categoryId,
      subcategoryId: subcategoryId || null,
      categoryName,
      subcategoryName,
    });
    setFormData({ name: "", price_ex_vat: "", attachment: "" });
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
    setFormData({ name: "", price_ex_vat: "", attachment: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const newProduct = {
        supplier_id: modal.supplierId,
        category_id: modal.categoryId,
        subcategory_id: modal.subcategoryId,
        name: formData.name,
        price_ex_vat: parseFloat(formData.price_ex_vat) || 0,
        attachment: formData.attachment || null,
      };

      const created = await addSupplierProduct(newProduct);

      const createdProduct: Product = {
        ...created,
        category: { id: modal.categoryId, name: modal.categoryName },
        subcategory: modal.subcategoryId
          ? {
              id: modal.subcategoryId,
              name: modal.subcategoryName ?? "",
              category_id: modal.categoryId,
            }
          : null,
      };

      setSuppliers((prev) =>
        (prev ?? []).map((s) =>
          s.id === modal.supplierId
            ? { ...s, products: [...s.products, createdProduct] }
            : s
        )
      );

      closeModal();
    } catch (error) {
      console.error("Error adding product:", error);
      alert("Kunne ikke legge til produkt");
    }
  };

  return (
    <>
      <div className="overflow-auto p-2">
        {suppliers.map((supplier) => {
          const categories = buildCategoriesFromProducts(supplier.products);

          return (
            <div key={supplier.id}>
              <h2 className="text-xl font-bold mb-8">{supplier.name}</h2>
              {categories.map((cat) => (
                <div key={cat.id} className="mb-4">
                  <h2 className="text-xl font-bold">{cat.name}</h2>
                  {cat.subcategories.length > 0 ? (
                    cat.subcategories.map((subcat) => (
                      <div key={subcat.id}>
                        <div className="w-full bg-gray-200 flex justify-between items-center p-2">
                          <h3 className="font-semibold">{subcat.name}</h3>
                          <button
                            onClick={() =>
                              openModal(
                                supplier.id,
                                cat.id,
                                cat.name,
                                subcat.id,
                                subcat.name
                              )
                            }
                            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                          >
                            + Legg til
                          </button>
                        </div>
                        <ProductTable
                          products={subcat.products}
                          onDelete={(productId) =>
                            handleDeleteProduct(supplier.id, productId)
                          }
                          onPriceChange={handlePriceChange}
                        />
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="w-full bg-gray-200 flex justify-end p-2">
                        <button
                          onClick={() =>
                            openModal(supplier.id, cat.id, cat.name)
                          }
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                        >
                          + Legg til
                        </button>
                      </div>
                      <ProductTable
                        products={cat.products}
                        onDelete={(productId) =>
                          handleDeleteProduct(supplier.id, productId)
                        }
                        onPriceChange={handlePriceChange}
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h2 className="text-xl font-bold mb-4">Legg til produkt</h2>
            <p className="text-sm text-gray-600 mb-4">
              {modal.categoryName}
              {modal.subcategoryName && ` - ${modal.subcategoryName}`}
            </p>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Navn</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full border rounded p-2"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Pris eks. mva
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_ex_vat}
                  onChange={(e) =>
                    setFormData({ ...formData, price_ex_vat: e.target.value })
                  }
                  className="w-full border rounded p-2"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Vedlegg (URL)
                </label>
                <input
                  type="text"
                  value={formData.attachment}
                  onChange={(e) =>
                    setFormData({ ...formData, attachment: e.target.value })
                  }
                  className="w-full border rounded p-2"
                  placeholder="https://..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Legg til
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function buildCategoriesFromProducts(products: Product[]) {
  const categoryMap = new Map<
    string,
    {
      id: string;
      name: string;
      products: Product[];
      subcategories: Map<
        string,
        { id: string; name: string; products: Product[] }
      >;
    }
  >();

  products.forEach((product) => {
    if (!product.category) return;

    const categoryKey = product.category.id;

    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, {
        id: product.category.id,
        name: product.category.name,
        products: [],
        subcategories: new Map(),
      });
    }
    const category = categoryMap.get(categoryKey)!;

    // Hvis produktet har subkategori
    if (product.subcategory) {
      const subcatKey = product.subcategory.id;

      if (!category.subcategories.has(subcatKey)) {
        category.subcategories.set(subcatKey, {
          id: product.subcategory.id,
          name: product.subcategory.name,
          products: [],
        });
      }

      category.subcategories.get(subcatKey)!.products.push(product);
    } else {
      // Produktet tilhører bare kategorien, ikke noen subkategori
      category.products.push(product);
    }
  });

  // Konverter Map til array
  return Array.from(categoryMap.values()).map((cat) => ({
    ...cat,
    subcategories: Array.from(cat.subcategories.values()),
  }));
}

function ProductTable({
  products,
  onDelete,
  onPriceChange,
}: {
  products: Product[];
  onDelete: (productId: string) => void;
  onPriceChange: (productId: string, newPrice: string) => void;
}) {
  const [localPrices, setLocalPrices] = useState(
    Object.fromEntries(products.map((p) => [p.id, String(p.price_ex_vat)]))
  );

  const handleChange = (id: string, value: string) => {
    if (/^\d*\.?\d*$/.test(value) || value === "") {
      setLocalPrices((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleSave = async (id: string) => {
    const value = localPrices[id];
    await onPriceChange(id, value);
  };

  return (
    <table className="w-full border-collapse border border-gray-300">
      <thead>
        <tr className="bg-gray-100">
          <th className="border p-1 w-64">Vedlegg</th>
          <th className="border p-1 max-w-full">Navn</th>
          <th className="border p-1 w-64">Pris eks. mva</th>
          <th className="border p-1 w-10">🗑️</th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td className="border p-1">
              {product.attachment ? (
                <Link
                  href={product.attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📎 Åpne PDF
                </Link>
              ) : (
                <button>Legg til PDF</button>
              )}
            </td>
            <td className="border">
              <input
                className="w-full p-1"
                value={product.name}
                type="text"
                readOnly
                disabled
              />
            </td>
            <td className="border">
              <input
                className="w-full p-1"
                type="text"
                value={localPrices[product.id]}
                onChange={(e) => handleChange(product.id, e.target.value)}
                onBlur={() => handleSave(product.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
              />
            </td>
            <td className="border">
              <button
                onClick={() => onDelete(product.id)}
                className="w-full aspect-square hover:bg-red-100"
              >
                x
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
