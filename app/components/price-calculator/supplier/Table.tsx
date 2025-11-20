import {
  addSupplierProduct,
  deleteSupplierProduct,
  getCategories,
  updateSupplierPrice,
} from "@/lib/api";
import {
  SupplierWithProducts,
  Product,
  ProductCategory,
  ProductSubcategory,
} from "@/types/price_table";
import { createSupabaseAdminClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

interface SupplierTableProps {
  suppliersAndProducts: SupplierWithProducts[] | null;
}

interface AddProductModal {
  isOpen: boolean;
  supplierId: string;
  supplierName: string;
}

export interface CategoryWithSubcategories extends ProductCategory {
  subcategories?: ProductSubcategory[];
}

export interface ElectricalInstallationItem {
  id: string;
  installer_group_id: string;
  name: string;
  price_per: number;
  extra_costs?: number | null;
  category?: {
    id: string;
    name: string;
  };
}

export default function SupplierTable({
  suppliersAndProducts,
}: SupplierTableProps) {
  const [suppliers, setSuppliers] = useState(suppliersAndProducts);
  const [allCategories, setAllCategories] = useState<
    CategoryWithSubcategories[]
  >([]);

  const [modal, setModal] = useState<AddProductModal>({
    isOpen: false,
    supplierId: "",
    supplierName: "",
  });
  const [formData, setFormData] = useState({
    categoryId: "",
    subcategoryId: "",
    name: "",
    price_ex_vat: "",
    attachment: "",
  });

  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const supabase = createSupabaseAdminClient();

  useEffect(() => {
    getCategories().then(setAllCategories);
  }, []);

  if (!suppliers || suppliers.length === 0) return <p>Ingen supplierdata</p>;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Kun PDF-filer er tillatt!");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Filen er for stor (maks 10MB)");
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      setUploadingFile(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;
      const filePath = `attachments/${fileName}`;

      const { error } = await supabase.storage
        .from("attachments")
        .upload(filePath, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("attachments")
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Kunne ikke laste opp fil");
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const deleteFile = async (fileUrl: string) => {
    try {
      const urlParts = fileUrl.split("/attachments/");
      if (urlParts.length < 2) return;

      const filePath = `${urlParts[1].split("?")[0]}`;

      const { error } = await supabase.storage
        .from("attachments")
        .remove([filePath]);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleDeleteProduct = async (supplierId: string, productId: string) => {
    const confirmDelete = window.confirm("Er du sikker på at du vil slette?");
    if (!confirmDelete) return;
    try {
      const supplier = suppliers.find((s) => s.id === supplierId);
      const product = supplier?.products.find((p) => p.id === productId);

      await deleteSupplierProduct(productId);

      if (product?.attachment) {
        await deleteFile(product.attachment);
      }

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

  const openModal = (supplierId: string, supplierName: string) => {
    setModal({
      isOpen: true,
      supplierId,
      supplierName,
    });
    setFormData({
      categoryId: "",
      subcategoryId: "",
      name: "",
      price_ex_vat: "",
      attachment: "",
    });
    setSelectedFile(null);
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
    setFormData({
      categoryId: "",
      subcategoryId: "",
      name: "",
      price_ex_vat: "",
      attachment: "",
    });
    setSelectedFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.categoryId) {
      toast.error("Velg en kategori");
      return;
    }

    try {
      let attachmentUrl = formData.attachment;
      if (selectedFile) {
        const uploadedUrl = await uploadFile(selectedFile);
        if (!uploadedUrl) {
          toast.error("Kunne ikke laste opp fil");
          return;
        }
        attachmentUrl = uploadedUrl;
      }

      const newProduct = {
        supplier_id: modal.supplierId,
        category_id: formData.categoryId,
        subcategory_id: formData.subcategoryId || null,
        name: formData.name,
        price_ex_vat: parseFloat(formData.price_ex_vat) || 0,
        attachment: attachmentUrl || null,
      };

      const created = await addSupplierProduct(newProduct);

      // Find category and subcategory names
      const category = allCategories.find((c) => c.id === formData.categoryId);
      const subcategory = formData.subcategoryId
        ? category?.subcategories?.find((s) => s.id === formData.subcategoryId)
        : null;

      const createdProduct: Product = {
        ...created,
        category: category ? { id: category.id, name: category.name } : null,
        subcategory: subcategory
          ? {
              id: subcategory.id,
              name: subcategory.name,
              category_id: formData.categoryId,
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

      toast.success("Produkt lagt til!");
      closeModal();
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("Kunne ikke legge til produkt");
    }
  };

  const selectedCategory = allCategories.find(
    (c) => c.id === formData.categoryId
  );

  return (
    <>
      <div className="overflow-auto p-2">
        {suppliers.map((supplier) => {
          const categories = buildCategoriesFromProducts(supplier.products);

          return (
            <div key={supplier.id} className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{supplier.name}</h2>
                <button
                  onClick={() => openModal(supplier.id, supplier.name)}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                >
                  + Legg til produkt
                </button>
              </div>

              {categories.length === 0 ? (
                <p className="text-gray-500 italic mb-4">
                  Ingen produkter ennå. Klikk Legg til produkt for å starte.
                </p>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id} className="mb-4">
                    <h3 className="text-lg font-bold bg-gray-100 p-2">
                      {cat.name.toUpperCase()}
                    </h3>
                    {cat.subcategories.length > 0 ? (
                      cat.subcategories.map((subcat) => (
                        <div key={subcat.id}>
                          <div className="w-full bg-gray-200 flex justify-between items-center p-2">
                            <h4 className="font-semibold">
                              {subcat.name.toUpperCase()}
                            </h4>
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
                      <ProductTable
                        products={cat.products}
                        onDelete={(productId) =>
                          handleDeleteProduct(supplier.id, productId)
                        }
                        onPriceChange={handlePriceChange}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Add Product Modal */}
      {modal.isOpen && (
        <div
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={() => setModal({ ...modal, isOpen: !modal.isOpen })}
        >
          <div
            className="bg-white rounded-lg p-6 w-[500px] max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-2">Legg til produkt</h2>
            <p className="text-sm text-gray-600 mb-4">{modal.supplierName}</p>

            <form onSubmit={handleSubmit}>
              {/* Category Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Kategori *
                </label>
                <select
                  value={formData.categoryId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      categoryId: e.target.value,
                      subcategoryId: "",
                    })
                  }
                  className="w-full border rounded p-2"
                  required
                >
                  <option value="">Velg kategori...</option>
                  {allCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory Selection (only if category has subcategories) */}
              {selectedCategory?.subcategories &&
                selectedCategory.subcategories.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Underkategori *
                    </label>
                    <select
                      value={formData.subcategoryId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          subcategoryId: e.target.value,
                        })
                      }
                      className="w-full border rounded p-2"
                      required={selectedCategory.subcategories.length > 0}
                    >
                      <option value="">Ingen (tilhører hovedkategori)</option>
                      {selectedCategory.subcategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              {/* Product Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Produktnavn *
                </label>
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

              {/* Price */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Pris eks. mva *
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

              {/* File upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Last opp PDF
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="w-full border rounded p-2"
                />
                {selectedFile && (
                  <p className="text-sm text-green-600 mt-1">
                    ✓ {selectedFile.name}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                  disabled={uploadingFile}
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                  disabled={uploadingFile}
                >
                  {uploadingFile ? "Laster opp..." : "Legg til"}
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
        { id: string; name: string; index?: number; products: Product[] }
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

    if (product.subcategory) {
      const subcatKey = product.subcategory.id;

      if (!category.subcategories.has(subcatKey)) {
        category.subcategories.set(subcatKey, {
          id: product.subcategory.id,
          name: product.subcategory.name,
          index: product.subcategory.index,
          products: [],
        });
      }

      category.subcategories.get(subcatKey)!.products.push(product);
    } else {
      category.products.push(product);
    }
  });

  return Array.from(categoryMap.values()).map((cat) => ({
    ...cat,
    subcategories: Array.from(cat.subcategories.values()).sort((a, b) => {
      // Assuming 'index' is a property of ProductSubcategory and is optional (can be undefined)
      // Sorts by index if available, otherwise maintains original order
      if (a.index !== undefined && b.index !== undefined) {
        return a.index - b.index;
      }
      if (a.index !== undefined) return -1; // a comes first if it has an index and b doesn't
      if (b.index !== undefined) return 1; // b comes first if it has an index and a doesn't
      return 0; // Maintain original order if neither has an index
    }),
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

  useEffect(() => {
    setLocalPrices(
      Object.fromEntries(products.map((p) => [p.id, String(p.price_ex_vat)]))
    );
  }, [products]);

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
              {!product.attachment ? (
                <p className="text-gray-400">Ingen PDF</p>
              ) : (
                <Link href={product.attachment} target="_blank">
                  Åpne pdf
                </Link>
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
                value={localPrices[product.id] ?? ""}
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
