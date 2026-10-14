import { getTeamCommission, updateTeamCommission } from "@/lib/api";
import { TeamCommissionType } from "@/lib/types";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import LoadingScreen from "../../LoadingScreen";

interface TeamCommissionTableProps {
  teamId: string;
}

export default function TeamCommissionTable({
  teamId,
}: TeamCommissionTableProps) {
  const [teamCommissions, setTeamCommissions] = useState<TeamCommissionType[]>(
    [],
  );

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([getTeamCommission(teamId).then(setTeamCommissions)]);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId]);

  const handleSaveCommission = async (commission: TeamCommissionType) => {
    try {
      const updated = await updateTeamCommission(teamId, commission);

      setTeamCommissions((prev) =>
        prev.map((r) => (r.index === updated.index ? updated : r)),
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
        SOLEKLART KOMMISJON
      </h3>
      <div className="overflow-hidden rounded-xl border border-line">
        <table className="sk-table">
          <thead>
            <tr>
              <th className="w-1/2">Antall Paneler</th>
              <th className="text-right!">Kommisjon %</th>
            </tr>
          </thead>
          <tbody>
            {teamCommissions.map((r) => {
              return (
                <tr key={r.index}>
                  <td className="py-1.5">
                    <div className="flex flex-row items-center gap-1.5 tabular-nums">
                      <input
                        type="text"
                        className="w-12 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                        value={r.amount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setTeamCommissions((prev) =>
                            prev.map((x) =>
                              x.index === r.index ? { ...x, amount: val } : x,
                            ),
                          );
                        }}
                        onBlur={() => handleSaveCommission(r)}
                      />
                      {r.amount2 && <span className="text-muted">–</span>}
                      {r.amount2 ? (
                        <input
                          type="text"
                          className="w-16 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                          value={r.amount2}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setTeamCommissions((prev) =>
                              prev.map((x) =>
                                x.index === r.index
                                  ? { ...x, amount2: val }
                                  : x,
                              ),
                            );
                          }}
                          onBlur={() => handleSaveCommission(r)}
                        />
                      ) : (
                        <span className="text-muted">+</span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 text-right">
                    <input
                      type="number"
                      className="w-20 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-right text-sm tabular-nums text-ink hover:border-line hover:bg-white focus:bg-white"
                      value={r.commission}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setTeamCommissions((prev) =>
                          prev.map((x) =>
                            x.index === r.index ? { ...x, commission: val } : x,
                          ),
                        );
                      }}
                      onBlur={() => handleSaveCommission(r)}
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
