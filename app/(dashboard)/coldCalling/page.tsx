"use client";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";
import LoadingScreen from "@/app/components/LoadingScreen";
import { CLIENT_ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthProvider";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { getTeam } from "@/lib/api";
import { Team } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export default function ColdCallingPage() {
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();
  const { user } = useAuth();

  const [team, setTeam] = useState<Team>();
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [coldCalls, setColdCalls] = useState([]);

  useEffect(() => {
    if (!teamId) return;

    getTeam(teamId)
      .then(setTeam)
      .catch((err) => console.error("Failed to fetch team members:", err));
  }, [teamId]);

  useEffect(() => {
    if (!selectedMember || !installerGroupId || !teamId) return;

    const fetchLeadsForUser = async () => {
      const params = new URLSearchParams({
        userId: selectedMember,
        installerGroupId,
        teamId,
      });

      const res = await fetch(`/api/coldCalling?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        toast.error("Error ved henting av leads");
        return;
      }

      const data = await res.json();
      setColdCalls(data || []);
    };
    fetchLeadsForUser();
  }, [installerGroupId, selectedMember, teamId]);

  const headers = ["Adresse", "Navn", "Rolle", "Firmanavn", "Mobil", "Telefon"];
  const fields = [
    "address",
    "person_info",
    "role",
    "company",
    "mobile",
    "phone",
  ];
  const [sliceAmount, setSliceAmount] = useState(5);

  if (!user) return <LoadingScreen />;

  return (
    <div>
      <div className="flex flex-row justify-between">
        <div>
          <h1>Cold Calling</h1>

          <div className="flex flex-row gap-2">
            <TeamMemberSelector
              team={team}
              selectedMember={selectedMember}
              onSelectMember={setSelectedMember}
              defaultUser={user.id}
            />

            <select>
              <option>Ringeliste</option>
            </select>
          </div>

          <input type="text" placeholder="Søk etter navn eller beskrivelse" />
        </div>

        <div className="w-128 h-32 bg-red-500"></div>

        <div className="flex flex-col gap-2">
          <Link href={CLIENT_ROUTES.COLD_CALLING + "/import"}>Importer</Link>
          <button>Flytt</button>
        </div>
      </div>

      <div>
        {coldCalls && (
          <>
            <table className="w-full">
              <thead>
                <tr>
                  {headers.map((header, index) => (
                    <th className="border p-2 w-1/6" key={index}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>

            {coldCalls.slice(sliceAmount - 5, sliceAmount).map((lead, i) => (
              <div key={i} className="mb-4">
                <table className="w-full">
                  <tbody>
                    <tr aria-hidden="true">
                      <td colSpan={fields.length} className="h-4"></td>
                    </tr>

                    <tr>
                      {fields.map((field) => (
                        <td className="border p-1 w-1/6" key={field}>
                          {lead[field]}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>

                {/* Input-rad: 7 like kolonner, 100% bredde */}
                <div className="grid grid-cols-7">
                  {Array.from({ length: 7 }).map((_, idx) => (
                    <div key={idx} className="border p-1">
                      <input
                        type="text"
                        placeholder="E-post"
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
        <div className="flex flex-row items-center gap-8 justify-center p-2">
          <button
            className="flex flex-row items-center gap-2"
            disabled={sliceAmount <= 5}
            onClick={() => setSliceAmount(sliceAmount - 5)}
          >
            <ChevronLeft size={16} /> Tilbake
          </button>
          <button
            disabled={sliceAmount >= coldCalls.length}
            className="flex flex-row items-center gap-2"
            onClick={() => setSliceAmount(sliceAmount + 5)}
          >
            Neste
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
