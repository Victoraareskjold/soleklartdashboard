import {
  getMountVolumeReductions,
  updateMountVolumeReductions,
} from "@/lib/api";
import { MountVolumeReductionType } from "@/lib/types";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import LoadingScreen from "../../LoadingScreen";

interface VolumeReductionsTableProps {
  installerGroupId: string;
}

export default function VolumeReductionsTable({
  installerGroupId,
}: VolumeReductionsTableProps) {
  const [mountVolumeReductions, setMountVolumeReductions] = useState<
    MountVolumeReductionType[]
  >([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          getMountVolumeReductions(installerGroupId).then(
            setMountVolumeReductions
          ),
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [installerGroupId]);

  const handleSaveVolumeReduction = async (
    reduction: MountVolumeReductionType
  ) => {
    try {
      const updated = await updateMountVolumeReductions(
        installerGroupId,
        reduction
      );

      setMountVolumeReductions((prev) =>
        prev.map((r) => (r.number === updated.number ? updated : r))
      );

      toast.success("Lagret!");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke lagre.");
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className="w-1/2 text-left">
            <h2 className="text-xl font-bold mb-4">
              VOLUMREDUKSJON MONTERING (KOSTNAD PR.PANEL)
            </h2>
          </th>
        </tr>
        <tr className="bg-gray-100">
          <th className="border p-2">Antall Paneler</th>
          <th className="border p-2">Reduksjon %</th>
        </tr>
      </thead>
      <tbody>
        {mountVolumeReductions.map((r) => {
          return (
            <tr key={r.number}>
              <td className="border p-1 flex flex-row items-center gap-2">
                <input
                  type="text"
                  className="w-10 p-1 rounded"
                  value={r.amount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setMountVolumeReductions((prev) =>
                      prev.map((x) =>
                        x.number === r.number ? { ...x, amount: val } : x
                      )
                    );
                  }}
                  onBlur={() => handleSaveVolumeReduction(r)}
                />
                -
                <input
                  type="text"
                  className="w-16 p-1 rounded"
                  value={r.amount2}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setMountVolumeReductions((prev) =>
                      prev.map((x) =>
                        x.number === r.number ? { ...x, amount2: val } : x
                      )
                    );
                  }}
                  onBlur={() => handleSaveVolumeReduction(r)}
                />
              </td>
              <td className="border p-1">
                <input
                  type="text"
                  className="w-12 p-1 rounded"
                  value={r.reduction}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setMountVolumeReductions((prev) =>
                      prev.map((x) =>
                        x.number === r.number ? { ...x, reduction: val } : x
                      )
                    );
                  }}
                  onBlur={() => handleSaveVolumeReduction(r)}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
