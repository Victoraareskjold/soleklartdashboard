import {
  getInstallerGroup,
  getSuppliersWithCategories,
  updateSuppliersWithCategories,
} from "@/lib/api";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import LoadingScreen from "../../LoadingScreen";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { SupplierCategory } from "@/types/price_table";
import Image from "next/image";
import { InstallerGroup } from "@/lib/types";

export default function SupplierMarkupsTable() {
  const { installerGroupId } = useInstallerGroup();
  const [suppliersWithCategories, setSuppliersWithCategories] = useState<
    SupplierCategory[]
  >([]);
  const [installerData, setInstallerData] = useState<InstallerGroup | null>();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!installerGroupId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getSuppliersWithCategories(installerGroupId);
        const data2 = await getInstallerGroup(installerGroupId);
        setSuppliersWithCategories(data);
        setInstallerData(data2);
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

  const getLogoPath = (name: string) => {
    const filename = name.toLowerCase().replace(/\s+/g, "");
    return `/installerLogos/${filename}.png`;
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="flex flex-col">
      {installerData?.name && (
        <div className="flex flex-row items-center gap-4 w-full">
          <h2 className="text-xl font-bold">
            PÅSLAG AV MATERIELL OG TJENESTER
          </h2>
          <div className="relative w-64 self-left justify-center h-8">
            <Image
              fill
              alt={installerData.name + " logo"}
              src={getLogoPath(installerData.name)}
              className="object-contain"
            />
          </div>
        </div>
      )}
      <table className="w-full mt-4">
        <thead>
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
                  <p>{sup.name.charAt(0).toUpperCase() + sup.name.slice(1)}</p>
                </td>
                <td className="border p-1">
                  <input
                    type="number"
                    className="w-16 p-1 rounded"
                    value={sup.markup_percentage}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
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
    </div>
  );
}
