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
    markup_percentage: number,
  ) => {
    if (!installerGroupId) return;
    try {
      const updated = await updateSuppliersWithCategories(
        installerGroupId,
        name,
        markup_percentage,
      );

      setSuppliersWithCategories((prev) =>
        prev.map((sup) => (sup.name === updated.name ? updated : sup)),
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
    <div className="flex flex-col gap-3">
      {installerData?.name && (
        <div className="flex w-full flex-row items-center justify-between gap-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
            PÅSLAG AV MATERIELL OG TJENESTER
          </h3>
          <div className="relative h-8 w-48">
            <Image
              fill
              alt={installerData.name + " logo"}
              src={getLogoPath(installerData.name)}
              className="object-contain"
            />
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="sk-table">
          <thead>
            <tr>
              <th className="w-1/2">Tjeneste</th>
              <th className="text-right!">Påslag %</th>
            </tr>
          </thead>
          <tbody>
            {suppliersWithCategories.map((sup) => {
              return (
                <tr key={sup.name}>
                  <td className="py-1.5 font-medium text-ink">
                    <p>
                      {sup.name.charAt(0).toUpperCase() + sup.name.slice(1)}
                    </p>
                  </td>
                  <td className="py-1.5 text-right">
                    <input
                      type="number"
                      className="w-20 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                      value={sup.markup_percentage}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setSuppliersWithCategories((prev) =>
                          prev.map((x) =>
                            x.name === sup.name
                              ? { ...x, markup_percentage: val }
                              : x,
                          ),
                        );
                      }}
                      onBlur={() =>
                        handleSaveSupplierMarkups(
                          sup.name,
                          sup.markup_percentage,
                        )
                      }
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
