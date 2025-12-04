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
    if (!installerGroupId || !teamId) return;

    const fetchLeadsForUser = async () => {
      const params = new URLSearchParams({
        userId: selectedMember,
        installerGroupId,
        teamId,
        // Status 6 betyr contact, har ingen annen referanse
        status: "5",
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
    "Adresse",
    "Navn",
    "E-post",
    "Mobil",
    "Telefon",
    "Lead-innhenter",
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

  const handleCreateLead = async (id: string) => {
    try {
      const res = await fetch("/api/coldCalling/contact/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id),
      });

      if (!res.ok) throw new Error("Feil ved oppretelse av avtale");

      toast.success("Avtale opprettet!");
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt");
    }
  };

  return (
    <div>
      <h1>Kontakter</h1>
      <div className="flex flex-row justify-between mb-4">
        <div className="flex flex-col gap-2">
          <TeamMemberSelector
            team={team}
            selectedMember={selectedMember}
            onSelectMember={setSelectedMember}
            defaultUser={user.id}
          />
          <input
            type="text"
            placeholder="Søk etter navn eller beskrivelse"
            className="border p-2 rounded-md"
          />
        </div>
        <div>
          <button className="w-42 text-center rounded-sm px-4 py-2 bg-[#FF8E4C] text-white">
            Opprett konktakt
          </button>
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr>
            <th className="w-1/10 text-left"></th>
            {headers.map((header, index) => (
              <th className="border p-2 w-1/8 text-left" key={index}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {coldCalls.map((coldCall) => (
            <tr key={coldCall.id}>
              <td className="w-1/10 border">
                <button
                  onClick={() => handleCreateLead(coldCall.id)}
                  className="w-full bg-[#FF8E4C] h-14 text-white"
                >
                  Opprett avtale
                </button>
              </td>
              {fields.map((field) => (
                <td className="border p-1 w-1/8" key={field}>
                  {coldCall[field]}
                </td>
              ))}
              <td className="border p-1 w-1/8">
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
