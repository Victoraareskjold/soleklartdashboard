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

export type CreateLead = {
  email: string | null;
  person_info: string | null;
  address: string | null;
  mobile: string | null;
  phone: string | null;
  assigned_to: string | null;
};

export default function ContactsPage() {
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();
  const { user } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [team, setTeam] = useState<Team>();
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [coldCalls, setColdCalls] = useState<ContactLead[]>([]);

  const [formData, setFormData] = useState<CreateLead>({} as CreateLead);

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
        status: "6",
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

  const formDataFields: {
    label: string;
    value: keyof CreateLead;
    type: "text" | "select" | "number";
  }[] = [
    { label: "E-post", value: "email", type: "text" },
    { label: "Navn", value: "person_info", type: "text" },
    { label: "Mobil", value: "mobile", type: "text" },
    { label: "Telefon", value: "phone", type: "text" },
    { label: "Adresse", value: "address", type: "text" },
  ];

  if (!user || !team) return <LoadingScreen />;

  const assignedTo = team?.members?.find(
    (member) => member.user_id === user.id
  );

  const handleUpdateToLead = async (id: string) => {
    try {
      const res = await fetch("/api/coldCalling/contact/upsert", {
        method: "PATCH",
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

  const handleCreateLead = async () => {
    try {
      const res = await fetch("/api/coldCalling/contact/upsert", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Feil ved oppretelse av avtale");

      toast.success("Avtale opprettet!");
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt");
    }
  };

  return (
    <>
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
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-42 text-center rounded-sm px-4 py-2 bg-[#FF8E4C] text-white"
            >
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
                    onClick={() => handleUpdateToLead(coldCall.id)}
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
      {isModalOpen && (
        <div className="absolute top-0 right-0 w-156 bg-blue-50 h-full shadow-lg z-10">
          <div className="bg-[#85F2AD] p-4">
            <h1 className="text-2xl font-semibold text-white">
              Opprett kontakt
            </h1>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2">
              {formDataFields.map((field) => (
                <div key={field.value} className="flex flex-col gap-1">
                  <label>{field.label}</label>
                  {field.type === "text" && (
                    <input
                      className="border p-1.5 rounded-md"
                      type="text"
                      value={formData[field.value] ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          [field.value]: e.target.value,
                        }))
                      }
                    />
                  )}
                  {field.type === "number" && (
                    <input
                      className="border p-1.5 rounded-md"
                      type="number"
                      value={formData[field.value] ?? ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          [field.value]: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label>Lead-innhenter</label>
                <TeamMemberSelector
                  team={team}
                  selectedMember={selectedMember}
                  onSelectMember={setSelectedMember}
                  defaultUser={user.id}
                />
              </div>
            </div>
            <div>
              <button onClick={handleCreateLead}>Opprett</button>
              <button onClick={() => setIsModalOpen(false)}>Avbryt</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
