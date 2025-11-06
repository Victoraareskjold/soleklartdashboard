import {
  getSuppliersWithCategories,
  updateSuppliersWithCategories,
} from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import LoadingScreen from "../../LoadingScreen";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { SupplierCategory } from "@/types/price_table";

export default function SupplierMarkupsTable() {
  const { installerGroupId } = useInstallerGroup();
  const [suppliersWithCategories, setSuppliersWithCategories] = useState<
    SupplierCategory[]
  >([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!installerGroupId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getSuppliersWithCategories(installerGroupId);
        setSuppliersWithCategories(data);
      } catch (error) {
        toast.error("Error fetching data:");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [installerGroupId]);

  const handleSaveSupplierMarkups = async (
    name: string,
    markup_percentage: number
  ) => {
    if (!installerGroupId) return;
    try {
      const updated = await updateSuppliersWithCategories(
        installerGroupId,
        name,
        markup_percentage
      );

      setSuppliersWithCategories((prev) =>
        prev.map((sup) => (sup.name === updated.name ? updated : sup))
      );

      toast.success("Lagret!");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke lagre.");
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <table className="w-full border-collapse border border-gray-300">
      <thead>
        <tr>
          <th colSpan={2} className="border p-2 bg-gray-100">
            PÅSLAG AV MATERIELL OG TJENESTER
          </th>
        </tr>
        <tr className="bg-gray-100">
          <th className="border p-2">Tjeneste</th>
          <th className="border p-2">Påslag %</th>
        </tr>
      </thead>
      <tbody>
        {suppliersWithCategories.map((sup) => {
          return (
            <tr key={sup.name}>
              <td className="p-1 border">
                <p>{sup.name}</p>
              </td>
              <td className="border p-1">
                <input
                  type="text"
                  className="w-12 p-1 rounded"
                  value={sup.markup_percentage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setSuppliersWithCategories((prev) =>
                      prev.map((x) =>
                        x.name === sup.name
                          ? { ...x, markup_percentage: val }
                          : x
                      )
                    );
                  }}
                  onBlur={() =>
                    handleSaveSupplierMarkups(sup.name, sup.markup_percentage)
                  }
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
