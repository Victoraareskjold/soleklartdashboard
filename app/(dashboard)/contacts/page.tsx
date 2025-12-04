"use client";
import LoadingScreen from "@/app/components/LoadingScreen";
import { useAuth } from "@/context/AuthProvider";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { getTeam } from "@/lib/api";
import { Team } from "@/lib/types";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";

export type ContactLead = {
  id: string;
  person_info: string | null;
  address: string | null;
  mobile: string | null;
  phone: string | null;
  email: string | null;
  assigned_to: string | null;
};

export default function ContactsPage() {
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();
  const { user } = useAuth();

  const [team, setTeam] = useState<Team>();
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [coldCalls, setColdCalls] = useState<ContactLead[]>([]);

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
        gtStatus: "5",
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

  const headers = [
    "",
    "Adresse",
    "Navn",
    "E-post",
    "Mobil",
    "Telefon",
    "Leadinnhenter",
  ];
  const fields: (keyof ContactLead)[] = [
    "address",
    "person_info",
    "email",
    "mobile",
    "phone",
  ];

  if (!user || !team) return <LoadingScreen />;

  const assignedTo = team?.members?.find(
    (member) => member.user_id === user.id
  );

  return (
    <div>
      <h1>Kontakter</h1>
      <div className="flex flex-row justify-between">
        <div className="flex flex-col">
          <TeamMemberSelector
            team={team}
            selectedMember={selectedMember}
            onSelectMember={setSelectedMember}
            defaultUser={user.id}
          />
          <input type="text" placeholder="Søk etter navn eller beskrivelse" />
        </div>
        <button>Opprett konktakt</button>
      </div>

      <table>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th className="border p-2 w-1/6" key={index}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {coldCalls.map((coldCall) => (
            <tr key={coldCall.id}>
              <td className="w-1/8">
                <button>Opprett konktakt</button>
              </td>
              {fields.map((field) => (
                <td className="border p-1 w-1/7" key={field}>
                  {coldCall[field]}
                </td>
              ))}
              <td className="border p-1 w-1/7">
                {assignedTo?.name ||
                  assignedTo?.user_id ||
                  "Ingen leadinnhenter"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
