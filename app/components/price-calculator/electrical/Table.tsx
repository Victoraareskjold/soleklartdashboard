import {
  addElectricalInstallationItem,
  deleteElectricalInstallationItem,
  getElectricalInstallationCategories,
  getElectricalInstallationItems,
  updateElectricalInstallationItem,
} from "@/lib/api";
import { ProductCategory, ProductSubcategory } from "@/types/price_table";
import { useEffect, useState } from "react";
import { ElectricalInstallationItem } from "../supplier/Table";
import { toast } from "react-toastify";
import { Plus, Trash2, X, Zap } from "lucide-react";

interface ElectricalInstallationTableProps {
  installerGroupId: string;
}

export interface CategoryWithSubcategories extends ProductCategory {
  subcategories?: ProductSubcategory[];
}

export default function ElectricalInstallationTable({
  installerGroupId,
}: ElectricalInstallationTableProps) {
  const [allCategories, setAllCategories] = useState<
    CategoryWithSubcategories[]
  >([]);
  const [items, setItems] = useState<ElectricalInstallationItem[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    category_id: "",
    name: "",
    price_per: "",
  });

  useEffect(() => {
    getElectricalInstallationCategories(installerGroupId).then(
      setAllCategories,
    );
    getElectricalInstallationItems(installerGroupId).then(setItems);
  }, [installerGroupId]);

  const openModal = () => {
    setShowModal(true);
    setFormData({
      category_id: "",
      name: "",
      price_per: "",
    });
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({
      category_id: "",
      name: "",
      price_per: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      installer_group_id: installerGroupId,
      category_id: formData.category_id,
      name: formData.name,
      price_per: Number(formData.price_per),
    };

    try {
      const newItem = await addElectricalInstallationItem(payload);

      setItems((prev) => [...prev, newItem]);

      closeModal();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePriceChange = async (id: string, value: string) => {
    const price = value === "" ? 0 : parseFloat(value);

    try {
      await updateElectricalInstallationItem(id, price);

      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, price_per: price } : item,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    const confirmDelete = window.confirm("Slette?");
    if (!confirmDelete) return;

    try {
      await deleteElectricalInstallationItem(id);

      setItems((prev) => prev.filter((item) => item.id !== id));

      toast.success("Produkt slettet");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke slette produkt");
    }
  };

  const sortOrder = ["solcelleanlegg", "batteri", "søknad"];
  const søknadOrder = ["uten", "delvis", "full"];

  const getSortedItems = (
    catName: string,
    items: ElectricalInstallationItem[],
  ) => {
    if (catName.toLowerCase() === "søknad") {
      return [...items].sort((a, b) => {
        const an = søknadOrder.findIndex((x) =>
          a.name.toLowerCase().includes(x),
        );
        const bn = søknadOrder.findIndex((x) =>
          b.name.toLowerCase().includes(x),
        );
        return (an === -1 ? 999 : an) - (bn === -1 ? 999 : bn);
      });
    }

    return items;
  };

  const mainCategories = allCategories
    .map((cat) => {
      const catItems = items.filter((item) => item.category?.id === cat.id);
      return {
        ...cat,
        items: getSortedItems(cat.name, catItems),
      };
    })
    .filter(
      (cat) =>
        cat.items.length > 0 && cat.name.toLowerCase() !== "tilleggskostnader",
    )
    .sort((a, b) => {
      const ai = sortOrder.indexOf(a.name.toLowerCase());
      const bi = sortOrder.indexOf(b.name.toLowerCase());
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  const additionalCostsCategory = allCategories
    .map((cat) => ({
      ...cat,
      items: items.filter((item) => item.category?.id === cat.id),
    }))
    .find(
      (cat) =>
        cat.items.length > 0 && cat.name.toLowerCase() === "tilleggskostnader",
    );

  return (
    <>
      <div className="overflow-auto">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
            ELEKTRISK INSTALLASJON <Zap size={14} className="text-accent" />
          </h3>
          <button
            onClick={openModal}
            className="sk-btn sk-btn-secondary sk-btn-sm"
          >
            <Plus size={14} />
            Legg til produkt
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Left column - Main categories */}
          <div className="flex flex-col gap-4">
            {mainCategories.map((cat) => (
              <div
                key={cat.id}
                className="overflow-hidden rounded-xl border border-line"
              >
                <h4 className="border-b border-line bg-gray-50 px-3 py-2 text-xs font-semibold tracking-wide text-ink">
                  {cat.name.toUpperCase()}
                </h4>
                <ProductTable
                  items={cat.items}
                  onDelete={handleDeleteItem}
                  onPriceChange={handlePriceChange}
                />
              </div>
            ))}
          </div>

          {/* Right column - Additional costs */}
          <div>
            {additionalCostsCategory && (
              <div className="overflow-hidden rounded-xl border border-line">
                <h4 className="border-b border-line bg-gray-50 px-3 py-2 text-xs font-semibold tracking-wide text-ink">
                  {additionalCostsCategory.name.toUpperCase()}
                </h4>
                <ProductTable
                  items={additionalCostsCategory.items}
                  onDelete={handleDeleteItem}
                  onPriceChange={handlePriceChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      {showModal && (
        <div className="sk-overlay" onClick={closeModal}>
          <div
            className="sk-modal max-w-[500px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="sk-section-title">Legg til arbeid</h2>
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
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category_id: e.target.value,
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

              {/* Product Name */}
              <div className="mb-4">
                <label className="sk-label">Produktnavn *</label>
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
                <label className="sk-label">Pris pr.</label>
                <input
                  type="text"
                  value={formData.price_per}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_per: e.target.value,
                    })
                  }
                  className="w-full border rounded p-2"
                  required
                />
              </div>

              <div className="-mx-6 -mb-5 mt-6 flex justify-end gap-2 border-t border-line bg-gray-50/60 px-6 py-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="sk-btn sk-btn-secondary"
                >
                  Avbryt
                </button>
                <button type="submit" className="sk-btn sk-btn-primary">
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

function ProductTable({
  items,
  onDelete,
  onPriceChange,
}: {
  items: ElectricalInstallationItem[];
  onDelete: (productId: string) => void;
  onPriceChange: (productId: string, newPrice: string) => void;
}) {
  const [localPrices, setLocalPrices] = useState(
    Object.fromEntries(items.map((i) => [i.id, String(i.price_per ?? "")])),
  );

  useEffect(() => {
    setLocalPrices(
      Object.fromEntries(items.map((i) => [i.id, String(i.price_per ?? "")])),
    );
  }, [items]);

  const handleChange = (id: string, value: string) => {
    if (/^\d*\.?\d*$/.test(value) || value === "") {
      setLocalPrices((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleSave = async (id: string) => {
    onPriceChange(id, localPrices[id]);
  };
  /* 
  const handleDelete = async (productId: string) => {
    onDelete(productId);
  }; */
  const getPriceColumnHeader = () => {
    const categoryName = items[0]?.category?.name?.toLowerCase();

    switch (categoryName) {
      case "solcelleanlegg":
        return "Pris pr. Inverter";
      case "batteri":
        return "Pris pr. Batterisystem";
      case "søknad":
        return "Pris pr. Søknad";
      case "tilleggskostnader":
        return "Pris pr. Tilleggskostnad";
      default:
        return "Pris pr.";
    }
  };

  return (
    <table className="sk-table">
      <thead>
        <tr>
          <th className="max-w-full py-2!">Navn</th>
          <th className="w-48 py-2! text-right!">
            {getPriceColumnHeader()} (eks. mva)
          </th>
          <th className="w-10 py-2!">
            <span className="sr-only">Slett</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className="py-1.5">
              <textarea
                className="block w-full resize-none bg-transparent p-0 text-sm text-ink field-sizing-content disabled:cursor-default disabled:bg-transparent disabled:text-ink"
                value={item.name}
                readOnly
                disabled
              />
            </td>
            <td className="whitespace-nowrap py-1.5 text-right">
              <input
                className="w-28 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                type="text"
                onChange={(e) => handleChange(item.id, e.target.value)}
                onBlur={() => handleSave(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                value={localPrices[item.id] ?? ""}
              />
              <span className="ml-0.5 text-xs text-muted">kr</span>
            </td>
            <td className="px-1! py-1.5 text-center">
              <button
                onClick={() => onDelete(item.id)}
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
