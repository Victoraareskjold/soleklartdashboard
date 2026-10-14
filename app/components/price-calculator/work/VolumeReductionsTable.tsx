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
            setMountVolumeReductions,
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
    reduction: MountVolumeReductionType,
  ) => {
    try {
      const updated = await updateMountVolumeReductions(
        installerGroupId,
        reduction,
      );

      setMountVolumeReductions((prev) =>
        prev.map((r) => (r.number === updated.number ? updated : r)),
      );

      toast.success("Lagret!");
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke lagre.");
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink">
        VOLUMREDUKSJON MONTERING (KOSTNAD PR.PANEL)
      </h3>
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="sk-table">
          <thead>
            <tr>
              <th className="w-1/2">Antall Paneler</th>
              <th className="text-right!">Reduksjon %</th>
            </tr>
          </thead>
          <tbody>
            {mountVolumeReductions.map((r) => {
              return (
                <tr key={r.number}>
                  <td className="py-1.5">
                    <div className="flex flex-row items-center gap-1.5 tabular-nums">
                      <input
                        type="text"
                        className="w-12 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                        value={r.amount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setMountVolumeReductions((prev) =>
                            prev.map((x) =>
                              x.number === r.number ? { ...x, amount: val } : x,
                            ),
                          );
                        }}
                        onBlur={() => handleSaveVolumeReduction(r)}
                      />
                      <span className="text-muted">–</span>
                      <input
                        type="text"
                        className="w-16 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                        value={r.amount2}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setMountVolumeReductions((prev) =>
                            prev.map((x) =>
                              x.number === r.number
                                ? { ...x, amount2: val }
                                : x,
                            ),
                          );
                        }}
                        onBlur={() => handleSaveVolumeReduction(r)}
                      />
                    </div>
                  </td>
                  <td className="py-1.5 text-right">
                    <input
                      type="number"
                      className="w-20 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                      value={r.reduction}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setMountVolumeReductions((prev) =>
                          prev.map((x) =>
                            x.number === r.number
                              ? { ...x, reduction: val }
                              : x,
                          ),
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
      </div>
    </div>
  );
}
