"use client";
import RenderInputFields from "@/app/components/cold-calling/RenderInputFields";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";
import LoadingScreen from "@/app/components/LoadingScreen";
import { CLIENT_ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthProvider";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { getRoofTypes, getTeam } from "@/lib/api";
import { RoofType, Team } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export type ColdCallLead = {
  id: string;
  person_info: string | null;
  role: string | null;
  company: string | null;
  address: string | null;
  mobile: string | null;
  phone: string | null;
};

export type FormDataFields = {
  status: string | null;
  gtStatus: string | null;
};

export type FormData = {
  [leadId: string]: FormDataFields;
};

export default function ColdCallingPage() {
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();
  const { user } = useAuth();

  const [team, setTeam] = useState<Team>();
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [coldCalls, setColdCalls] = useState<ColdCallLead[]>([]);

  const [formData, setFormData] = useState<FormData>({});
  const [roofTypeOptions, setRoofTypeOptions] = useState<RoofType[]>([]);

  useEffect(() => {
    if (!teamId) return;

    getTeam(teamId).then(setTeam);
    getRoofTypes()
      .then(setRoofTypeOptions)
      .catch((err) => console.error("Failed to fetch team members:", err));
  }, [teamId]);

  useEffect(() => {
    if (!selectedMember || !installerGroupId || !teamId) return;

    const fetchLeadsForUser = async () => {
      const params = new URLSearchParams({
        userId: selectedMember,
        installerGroupId,
        teamId,
        status: "0",
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

  const handleFormDataChange = (
    leadId: string,
    fieldKey: string,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [leadId]: {
        ...(prev[leadId] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const handleMove = async () => {
    const requiredFields = [
      "email",
      "roof_type_id",
      "own_consumption",
      "main_fuse",
      "roof_age",
      "status",
    ];

    const completeLeads = coldCalls
      .map((lead) => {
        const data = formData[lead.id];
        if (!data) return null;

        const allRequiredFilled = requiredFields.every((key) => {
          const value = (data as Record<string, string | number>)[key];
          return (
            value !== undefined &&
            value !== null &&
            value.toString().trim() !== ""
          );
        });

        if (!allRequiredFilled) return null;

        return {
          id: lead.id,
          ...data,
        };
      })
      .filter(Boolean);

    if (!completeLeads.length) return;

    try {
      const res = await fetch("/api/coldCalling/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completeLeads),
      });

      if (!res.ok) throw new Error("Feil ved oppdatering av leads");

      toast.success("Leads flyttet!");
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt");
    }
  };

  const headers = ["Adresse", "Navn", "Rolle", "Firmanavn", "Mobil", "Telefon"];
  const fields: (keyof ColdCallLead)[] = [
    "address",
    "person_info",
    "role",
    "company",
    "mobile",
    "phone",
  ];
  const [sliceAmount, setSliceAmount] = useState(5);

  if (!user) return <LoadingScreen />;

  console.log(coldCalls);

  return (
    <div>
      <div className="flex flex-row justify-between">
        <div>
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
          <button onClick={handleMove}>Flytt</button>
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

                <RenderInputFields
                  lead={lead}
                  formData={formData}
                  onFormDataChange={handleFormDataChange}
                  roofTypeOptions={roofTypeOptions}
                />
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
