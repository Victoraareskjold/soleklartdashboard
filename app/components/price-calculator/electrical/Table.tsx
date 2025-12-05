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
      setAllCategories
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
          item.id === id ? { ...item, price_per: price } : item
        )
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
    items: ElectricalInstallationItem[]
  ) => {
    if (catName.toLowerCase() === "søknad") {
      return [...items].sort((a, b) => {
        const an = søknadOrder.findIndex((x) =>
          a.name.toLowerCase().includes(x)
        );
        const bn = søknadOrder.findIndex((x) =>
          b.name.toLowerCase().includes(x)
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
        cat.items.length > 0 && cat.name.toLowerCase() !== "tilleggskostnader"
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
        cat.items.length > 0 && cat.name.toLowerCase() === "tilleggskostnader"
    );

  return (
    <>
      <div className="overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">ELEKTRISK INSTALLASJON ⚡</h2>
          <button
            onClick={openModal}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            + Legg til produkt
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Left column - Main categories */}
          <div>
            {mainCategories.map((cat) => (
              <div key={cat.id} className="mb-4">
                <h3 className="text-lg font-bold bg-gray-100 p-2">
                  {cat.name.toUpperCase()}
                </h3>
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
              <div className="mb-4">
                <h3 className="text-lg font-bold bg-gray-100 p-2">
                  {additionalCostsCategory.name.toUpperCase()}
                </h3>
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
        <div
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg p-6 w-[500px] max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-2">Legg til arbeid</h2>

            <form onSubmit={handleSubmit}>
              {/* Category Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Kategori *
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category_id: e.target.value,
                    })
                  }
                  className="w-full border rounded p-2"
                  required
                >
                  <option value="">Velg kategori...</option>
                  {allCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}{" "}
                    </option>
                  ))}
                </select>
              </div>

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
                  Pris pr.
                </label>
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
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
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
    Object.fromEntries(items.map((i) => [i.id, String(i.price_per ?? "")]))
  );

  useEffect(() => {
    setLocalPrices(
      Object.fromEntries(items.map((i) => [i.id, String(i.price_per ?? "")]))
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
    <table className="w-full border-collapse border border-gray-300">
      <thead>
        <tr className="bg-gray-100">
          <th className="border p-1 max-w-full text-left">Navn</th>
          <th className="border p-1 w-72 text-left">
            {getPriceColumnHeader()} (eks. mva)
          </th>
          <th className="border p-1 w-10">🗑️</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className="border">
              <textarea
                className="w-full p-1"
                value={item.name}
                type="text"
                readOnly
                disabled
              />
            </td>
            <td className="border">
              <input
                className="w-full p-1"
                type="text"
                onChange={(e) => handleChange(item.id, e.target.value)}
                onBlur={() => handleSave(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                value={localPrices[item.id] ?? ""}
              />
            </td>
            <td className="border">
              <button
                onClick={() => onDelete(item.id)}
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
