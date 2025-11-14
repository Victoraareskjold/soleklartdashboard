import {
  getElectricalInstallationCategories,
  getElectricalInstallationItems,
} from "@/lib/api";
import { ProductCategory, ProductSubcategory } from "@/types/price_table";
import { useEffect, useState } from "react";
import { ElectricalInstallationItem } from "../supplier/Table";

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
    price_per: 0,
    extra_costs: 0,
  });

  useEffect(() => {
    getElectricalInstallationCategories(installerGroupId).then(
      setAllCategories
    );
    getElectricalInstallationItems(installerGroupId).then(setItems);
  }, [installerGroupId]);

  const handleDeleteItem = async (id: string) => {
    const confirmDelete = window.confirm("Slette?");
    if (!confirmDelete) return;
  };

  const openModal = () => {
    setShowModal(true);
    setFormData({
      category_id: formData.category_id,
      name: formData.name,
      price_per: Number(formData.price_per),
      extra_costs: Number(formData.extra_costs),
    });
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({
      category_id: "",
      name: "",
      price_per: 0,
      extra_costs: 0,
    });
  };

  // TODO opdater submit for. legge til produkt
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  };

  // TODO onchange update price funksjon

  return (
    <>
      <div className="overflow-auto p-2">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">ELEKTRISK INSTALLASJON ⚡</h2>
          <button
            onClick={openModal}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            + Legg til produkt
          </button>
        </div>
        {allCategories
          .map((cat) => ({
            ...cat,
            items: items.filter((item) => item.category?.id === cat.id),
          }))
          .filter((cat) => cat.items.length > 0)
          .map((cat) => (
            <div key={cat.id} className="mb-8">
              <h3 className="text-lg font-bold bg-gray-100 p-2">{cat.name}</h3>
              <ProductTable items={cat.items} onDelete={handleDeleteItem} />
            </div>
          ))}
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
                      {cat.name}
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
                  type="number"
                  step="0.01"
                  value={formData.price_per}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price_per: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded p-2"
                  required
                />
              </div>

              {/* Extra costs, kun for BATTERI */}
              {allCategories.find((cat) => cat.id === formData.category_id)
                ?.name === "BATTERI" && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Smådeler kostnad
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.extra_costs ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        extra_costs: Number(e.target.value),
                      })
                    }
                    className="w-full border rounded p-2"
                  />
                </div>
              )}

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
}: {
  items: ElectricalInstallationItem[];
  onDelete: (productId: string) => void;
}) {
  return (
    <table className="w-full border-collapse border border-gray-300">
      <thead>
        <tr className="bg-gray-100">
          <th className="border p-1 max-w-full">Navn</th>
          <th className="border p-1 w-64">Pris pr.</th>
          {items[0]?.category?.name === "BATTERI" ? (
            <th className="border p-1 w-64">Smådeler</th>
          ) : null}
          <th className="border p-1 w-64">Total pris</th>
          <th className="border p-1 w-10">🗑️</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td className="border">
              <input
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
                value={item.price_per}
                type="text"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                readOnly
              />
            </td>
            {item.category?.name === "BATTERI" ? (
              <td className="border p-1">
                <input
                  className="w-full p-1"
                  value={item.extra_costs || 0}
                  type="text"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                  readOnly
                />
              </td>
            ) : null}
            <td className="border">
              <input
                className="w-full p-1"
                type="text"
                value={item.price_per + (item.extra_costs || 0)}
                readOnly
                disabled
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
