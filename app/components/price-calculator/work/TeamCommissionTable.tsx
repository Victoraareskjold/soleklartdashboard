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
    []
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
        prev.map((r) => (r.index === updated.index ? updated : r))
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
              TEAMPROVISJON
            </h2>
          </th>
        </tr>
        <tr className="bg-gray-100">
          <th className="border p-2">Antall</th>
          <th className="border p-2">Provisjon %</th>
        </tr>
      </thead>
      <tbody>
        {teamCommissions.map((r) => {
          return (
            <tr key={r.index}>
              <td className="border p-1 flex flex-row items-center gap-2">
                <input
                  type="text"
                  className="w-10 p-1 rounded"
                  value={r.amount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setTeamCommissions((prev) =>
                      prev.map((x) =>
                        x.index === r.index ? { ...x, amount: val } : x
                      )
                    );
                  }}
                  onBlur={() => handleSaveCommission(r)}
                />
                {r.amount2 && <>-</>}
                {r.amount2 ? (
                  <input
                    type="text"
                    className="w-16 p-1 rounded"
                    value={r.amount2}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setTeamCommissions((prev) =>
                        prev.map((x) =>
                          x.index === r.index ? { ...x, amount2: val } : x
                        )
                      );
                    }}
                    onBlur={() => handleSaveCommission(r)}
                  />
                ) : (
                  "+"
                )}
              </td>
              <td className="border p-1">
                <input
                  type="text"
                  className="w-12 p-1 rounded"
                  value={r.commission}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setTeamCommissions((prev) =>
                      prev.map((x) =>
                        x.index === r.index ? { ...x, commission: val } : x
                      )
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
  );
}
