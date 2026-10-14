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
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Trash2,
  X,
} from "lucide-react";

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

  const [collapsedSuppliers, setCollapsedSuppliers] = useState<
    Record<string, boolean>
  >({});

  const toggleSupplier = (id: string) => {
    setCollapsedSuppliers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const supabase = createSupabaseAdminClient();

  useEffect(() => {
    getCategories().then(setAllCategories);
  }, []);

  if (!suppliers || suppliers.length === 0)
    return <div className="sk-empty">Ingen supplierdata</div>;

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
            : supplier,
        ),
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
            p.id === productId ? { ...p, price_ex_vat: price } : p,
          ),
        })),
      );
      toast.success("Pris oppdatert!");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke oppdatere pris");
    }
  };

  const openModal = (
    supplierId: string,
    supplierName: string,
    categoryId?: string,
    subcategoryId?: string,
  ) => {
    setModal({
      isOpen: true,
      supplierId,
      supplierName,
    });
    setFormData({
      categoryId: categoryId || "",
      subcategoryId: subcategoryId || "",
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
            : s,
        ),
      );

      toast.success("Produkt lagt til!");
      closeModal();
    } catch (error) {
      console.error("Error adding product:", error);
      toast.error("Kunne ikke legge til produkt");
    }
  };

  const selectedCategory = allCategories.find(
    (c) => c.id === formData.categoryId,
  );

  return (
    <>
      <div className="flex flex-col gap-3 overflow-auto">
        {suppliers.map((supplier) => {
          const categories = buildCategoriesFromProducts(
            supplier.products,
            allCategories,
          );

          return (
            <div
              key={supplier.id}
              className="overflow-hidden rounded-xl border border-line bg-surface"
            >
              <div
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  collapsedSuppliers[supplier.id]
                    ? "border-b border-line bg-gray-50/60"
                    : ""
                }`}
              >
                <button
                  onClick={() => toggleSupplier(supplier.id)}
                  className="group flex min-w-0 items-center gap-3 text-left"
                >
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted group-hover:bg-gray-100 group-hover:text-ink">
                    {collapsedSuppliers[supplier.id] ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="sk-eyebrow">
                      {supplier.category.charAt(0).toUpperCase() +
                        supplier.category.slice(1)}
                    </span>
                    <span className="truncate font-display text-[15px] font-semibold text-ink">
                      {supplier.name}
                    </span>
                  </span>
                  <span className="sk-badge sk-badge-neutral tabular-nums">
                    {supplier.products.length}
                  </span>
                </button>

                <button
                  onClick={() => openModal(supplier.id, supplier.name)}
                  className="sk-btn sk-btn-secondary sk-btn-sm"
                >
                  <Plus size={14} />
                  Legg til produkt
                </button>
              </div>

              {collapsedSuppliers[supplier.id] && (
                <div className="flex flex-col gap-4 p-4">
                  {categories.length === 0 ? (
                    <div className="sk-empty py-8">
                      Ingen produkter ennå. Klikk Legg til produkt for å starte.
                    </div>
                  ) : (
                    categories.map((cat) => (
                      <div
                        key={cat.id}
                        className="overflow-hidden rounded-lg border border-line"
                      >
                        <h3 className="border-b border-line bg-gray-50 px-3 py-2 text-xs font-semibold tracking-wide text-ink">
                          {cat.name.toUpperCase()}
                        </h3>
                        {cat.subcategories.length > 0 ? (
                          cat.subcategories.map((subcat) => (
                            <div
                              key={subcat.id}
                              className="border-b border-line last:border-b-0"
                            >
                              <div className="flex w-full items-center justify-between border-b border-gray-100 bg-white px-3 py-1.5">
                                <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                                  {subcat.name.toUpperCase()}
                                </h4>
                                <button
                                  onClick={() =>
                                    openModal(
                                      supplier.id,
                                      supplier.name,
                                      cat.id,
                                      subcat.id,
                                    )
                                  }
                                  className="sk-btn sk-btn-ghost h-7 px-2 text-xs text-brand hover:text-brand-hover"
                                >
                                  <Plus size={13} />
                                  Legg til produkt
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
              )}
            </div>
          );
        })}
      </div>

      {/* Add Product Modal */}
      {modal.isOpen && (
        <div
          className="sk-overlay"
          onClick={() => setModal({ ...modal, isOpen: !modal.isOpen })}
        >
          <div
            className="sk-modal max-w-[500px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
              <div>
                <h2 className="sk-section-title">Legg til produkt</h2>
                <p className="mt-0.5 text-xs text-muted">
                  {modal.supplierName}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="sk-icon-btn size-8"
                aria-label="Lukk"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5">
              {/* Category Selection */}
              <div className="mb-4">
                <label className="sk-label">Kategori *</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      categoryId: e.target.value,
                      subcategoryId: "",
                    })
                  }
                  className="sk-input"
                  required
                >
                  <option value="">Velg kategori...</option>
                  {allCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name.charAt(0).toUpperCase() +
                        cat.name.slice(1)}{" "}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory Selection (only if category has subcategories) */}
              {selectedCategory?.subcategories &&
                selectedCategory.subcategories.length > 0 && (
                  <div className="mb-4">
                    <label className="sk-label">Underkategori *</label>
                    <select
                      value={formData.subcategoryId}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          subcategoryId: e.target.value,
                        })
                      }
                      className="sk-input"
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
                <label className="sk-label">Produktnavn *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="sk-input"
                  required
                />
              </div>

              {/* Price */}
              <div className="mb-4">
                <label className="sk-label">Pris eks. mva *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price_ex_vat}
                  onChange={(e) =>
                    setFormData({ ...formData, price_ex_vat: e.target.value })
                  }
                  className="sk-input"
                  required
                />
              </div>

              {/* File upload */}
              <div className="mb-4">
                <label className="sk-label">Last opp PDF</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileSelect}
                  className="w-full cursor-pointer rounded-lg border border-dashed border-gray-300 bg-gray-50/60 p-2 text-sm text-muted hover:border-gray-400 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink file:shadow-card"
                />
                {selectedFile && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <Check size={13} /> {selectedFile.name}
                  </p>
                )}
              </div>

              <div className="-mx-6 -mb-5 mt-6 flex justify-end gap-2 border-t border-line bg-gray-50/60 px-6 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="sk-btn sk-btn-secondary"
                  disabled={uploadingFile}
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="sk-btn sk-btn-primary"
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

function buildCategoriesFromProducts(
  products: Product[],
  allCategories: CategoryWithSubcategories[],
) {
  const categoryMap = new Map<
    string,
    {
      id: string;
      name: string;
      index?: number;
      products: Product[];
      subcategories: Map<
        string,
        { id: string; name: string; index?: number; products: Product[] }
      >;
    }
  >();

  const categoryIndexLookup = Object.fromEntries(
    allCategories.map((c) => [c.id, c.index]),
  );

  const subcategoryIndexLookup = Object.fromEntries(
    allCategories.flatMap((c) =>
      (c.subcategories ?? []).map((s) => [s.id, s.index]),
    ),
  );

  products.forEach((product) => {
    if (!product.category) return;

    const categoryKey = product.category.id;

    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, {
        id: product.category.id,
        name: product.category.name,
        index: categoryIndexLookup[product.category.id],
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
          index: subcategoryIndexLookup[product.subcategory.id],
          products: [],
        });
      }

      category.subcategories.get(subcatKey)!.products.push(product);
    } else {
      category.products.push(product);
    }
  });

  const sorter = (
    a: { index?: number | null; name: string },
    b: { index?: number | null; name: string },
  ) => {
    const aHasIndex = a.index != null;
    const bHasIndex = b.index != null;

    if (aHasIndex && bHasIndex) {
      return a.index! - b.index!;
    }
    if (aHasIndex) return -1;
    if (bHasIndex) return 1;

    return a.name.localeCompare(b.name);
  };

  const categories = Array.from(categoryMap.values()).sort(sorter);

  return categories.map((cat) => ({
    ...cat,
    subcategories: Array.from(cat.subcategories.values()).sort(sorter),
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
    Object.fromEntries(products.map((p) => [p.id, String(p.price_ex_vat)])),
  );

  useEffect(() => {
    setLocalPrices(
      Object.fromEntries(products.map((p) => [p.id, String(p.price_ex_vat)])),
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
    <table className="sk-table">
      <thead>
        <tr>
          <th className="w-32 py-2!">Vedlegg</th>
          <th className="max-w-full py-2!">Navn</th>
          <th className="w-48 py-2! text-right!">Pris eks. mva</th>
          <th className="w-10 py-2!">
            <span className="sr-only">Slett</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {products.map((product) => (
          <tr key={product.id}>
            <td className="py-1.5">
              {!product.attachment ? (
                <p className="text-xs text-gray-400">Ingen PDF</p>
              ) : (
                <Link
                  href={product.attachment}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                >
                  <FileText size={13} />
                  Åpne pdf
                </Link>
              )}
            </td>
            <td className="py-1.5">
              <input
                className="w-full bg-transparent p-0 text-sm text-ink disabled:cursor-default disabled:bg-transparent disabled:text-ink"
                value={product.name}
                type="text"
                readOnly
                disabled
              />
            </td>
            <td className="whitespace-nowrap py-1.5 text-right">
              <input
                className="w-28 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
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
              <span className="ml-0.5 text-xs text-muted">kr</span>
            </td>
            <td className="px-1! py-1.5 text-center">
              <button
                onClick={() => onDelete(product.id)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-red-600"
                aria-label="Slett"
              >
                <Trash2 size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
