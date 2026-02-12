"use client";
import LeadStatusChart from "@/app/components/cold-calling/LeadStatusChart";
import RenderInputFields from "@/app/components/cold-calling/RenderInputFields";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";
import LoadingScreen from "@/app/components/LoadingScreen";
import { LeadStatus } from "@/constants/leadStatuses";
import { CLIENT_ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthProvider";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { getInstallerGroup, getRoofTypes, getTeam } from "@/lib/api";
import { InstallerGroup, RoofType, Team } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import EditableField from "@/app/components/cold-calling/EditableField";
import Image from "next/image";
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
  email: string | null;
  roof_type_id: string | null;
  own_consumption: number | string | null;
  voltage: number | string | null;
  roof_age: number | string | null;
  note: string | null;
  status: number | string | null;
};

export type FormDataFields = {
  status?: string | null;
  gtStatus?: string | null;
  email?: string | null;
  roof_type_id?: string | null;
  own_consumption?: string | null;
  voltage?: string | null;
  roof_age?: string | null;
  note?: string | null;
  person_info?: string | null;
  role?: string | null;
  company?: string | null;
  address?: string | null;
  mobile?: string | null;
  phone?: string | null;
};

export type FormData = {
  [leadId: string]: FormDataFields;
};

export default function ColdCallingPage() {
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();
  const { user } = useAuth();

  const [installerData, setInstallerData] = useState<InstallerGroup | null>();

  const [team, setTeam] = useState<Team>();
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [coldCalls, setColdCalls] = useState<ColdCallLead[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState<FormData>({});
  const [roofTypeOptions, setRoofTypeOptions] = useState<RoofType[]>([]);

  const [status, setStatus] = useState(0);

  const [leadSummary, setLeadSummary] = useState<
    { status: number; count: number }[]
  >([]);

  useEffect(() => {
    if (!teamId || !installerGroupId) return;

    const fetchData = async () => {
      const data2 = await getInstallerGroup(installerGroupId);
      setInstallerData(data2);
    };

    fetchData();

    getTeam(teamId).then(setTeam);
    getRoofTypes()
      .then(setRoofTypeOptions)
      .catch((err) => console.error("Failed to fetch team members:", err));
  }, [teamId, installerGroupId]);

  useEffect(() => {
    if (!user || !teamId || !installerGroupId) return;

    const controller = new AbortController();
    const { signal } = controller;

    fetch(
      `/api/leads/status-summary?userId=${user.id}&teamId=${teamId}&installerGroupId=${installerGroupId}&selectedMember=${selectedMember}`,
      { signal },
    )
      .then((res) => res.json())
      .then(setLeadSummary)
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch lead summary:", err);
        }
      });

    return () => {
      controller.abort();
    };
  }, [user, teamId, installerGroupId, selectedMember]);

  useEffect(() => {
    if (!installerGroupId || !teamId) return;
    const controller = new AbortController();
    const { signal } = controller;

    const fetchLeadsForUser = async () => {
      const params = new URLSearchParams({
        userId: selectedMember,
        installerGroupId,
        teamId,
        status: String(status),
      });

      try {
        const res = await fetch(`/api/coldCalling?${params.toString()}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal,
        });

        if (!res.ok) {
          toast.error("Error ved henting av leads");
          return;
        }

        const data = await res.json();
        setColdCalls(data || []);
        if (data) {
          const initialFormData = data.reduce(
            (acc: FormData, lead: ColdCallLead) => {
              const toStringOrNull = (
                val: string | number | null | undefined,
              ) => (val !== null && val !== undefined ? String(val) : null);

              acc[lead.id] = {
                gtStatus: null,
                email: toStringOrNull(lead.email),
                roof_type_id: toStringOrNull(lead.roof_type_id),
                own_consumption: toStringOrNull(lead.own_consumption),
                voltage: toStringOrNull(lead.voltage),
                roof_age: toStringOrNull(lead.roof_age),
                note: toStringOrNull(lead.note),
                status: toStringOrNull(lead.status),
                person_info: toStringOrNull(lead.person_info),
                role: toStringOrNull(lead.role),
                company: toStringOrNull(lead.company),
                address: toStringOrNull(lead.address),
                mobile: toStringOrNull(lead.mobile),
                phone: toStringOrNull(lead.phone),
              };
              return acc;
            },
            {} as FormData,
          );
          setFormData(initialFormData);
        } else {
          setFormData({});
        }
      } catch (err) {
        if (err !== "AbortError") {
          console.error("Failed to fetch leads:", err);
          toast.error("Noe gikk galt under henting av leads");
        }
      }
    };
    fetchLeadsForUser();

    return () => {
      controller.abort();
    };
  }, [installerGroupId, selectedMember, teamId, status]);

  const handleFormDataChange = (
    leadId: string,
    fieldKey: string,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [leadId]: {
        ...(prev[leadId] || {}),
        [fieldKey]: value,
      },
    }));
  };

  const handleSaveFieldChange = async (
    leadId: string,
    fieldKey: keyof ColdCallLead,
    value: string,
  ) => {
    try {
      const updateData = {
        id: leadId,
        [fieldKey]: value,
      };

      const res = await fetch("/api/coldCalling/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([updateData]), // Send as an array
      });

      if (!res.ok) {
        throw new Error("Feil ved oppdatering av lead felt");
      }
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt under lagring av felt");
    }
  };

  const handleMove = async () => {
    // Hvis status >= 5, flytt alle leads til kontakter (status 6)
    if (status >= 5) {
      const allLeads = coldCalls.map((lead) => {
        const data = formData[lead.id] || {};

        return {
          id: lead.id,
          ...data,
          status: "6",
        };
      });

      if (!allLeads.length) return;

      try {
        const res = await fetch("/api/coldCalling/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(allLeads),
        });

        if (!res.ok) throw new Error("Feil ved oppdatering av leads");

        toast.success("Leads flyttet til kontakter!");
        setColdCalls([]); // Fjern alle leads fra listen
      } catch (err) {
        console.error(err);
        toast.error("Noe gikk galt");
      }
      return;
    }

    // Original logikk for status < 5
    const completeLeads = coldCalls
      .map((lead) => {
        const data = formData[lead.id];
        if (!data) return null;

        const newStatus = data.status;

        if (newStatus === null || newStatus === undefined) {
          return null;
        }

        if (newStatus === String(lead.status)) {
          return null;
        }

        const leadUpdateData: { [key: string]: unknown } = { ...data };

        if (newStatus === "") {
          if (status !== 0) {
            leadUpdateData.status = "0";
          } else {
            return null;
          }
        }

        return {
          id: lead.id,
          ...leadUpdateData,
        };
      })
      .filter((lead): lead is NonNullable<typeof lead> => lead !== null);

    if (!completeLeads.length) return;

    try {
      const res = await fetch("/api/coldCalling/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completeLeads),
      });

      if (!res.ok) throw new Error("Feil ved oppdatering av leads");

      toast.success("Leads flyttet!");
      setColdCalls((prev) =>
        prev.filter((lead) => {
          const data = formData[lead.id];
          if (!data) return true;

          const newStatus = data.status;

          if (newStatus === String(lead.status)) return true;
          if (newStatus === "" && status === 0) return true;

          return false;
        }),
      );
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt");
    }
  };

  const headers = ["Adresse", "Navn", "Rolle", "Firmanavn", "Mobil", "Telefon"];
  const fields: (keyof ColdCallLead)[] = [
    "person_info",
    "role",
    "company",
    "mobile",
    "phone",
  ];
  const [sliceAmount, setSliceAmount] = useState(5);

  const handleCopyAddress = (addr: string | null) => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    toast.success("Adresse kopiert til utklippstavle");
  };

  const getLogoPath = (name: string) => {
    const filename = name.toLowerCase().replace(/\s+/g, "");
    return `/installerLogos/${filename}.png`;
  };

  if (!user || !installerData) return <LoadingScreen />;

  const filteredColdCalls = coldCalls.filter((lead) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const searchableFields = [
      lead.person_info,
      lead.address,
      lead.email,
      lead.mobile,
      lead.phone,
      lead.company,
      lead.role,
      lead.note,
    ];
    return searchableFields.some(
      (field) => field && field.toString().toLowerCase().includes(query),
    );
  });

  const leadSummaryWithColor = leadSummary.reduce(
    (acc, { status, count }) => {
      let label: string;
      let color: string;

      if (status === 0) {
        label = "Ingen status";
        color = "#CCCCCC"; // grå for udefinert
      } else if (status > 5) {
        label = "Vil ha tilbud";
        color = "#69FF59";
      } else {
        const info = LeadStatus.find((s) => s.value === status);
        if (!info) return acc;
        label = info.label;
        color = info.color;
      }

      // Summer tellerne per label
      const existing = acc.find((a) => a.label === label);
      if (existing) {
        existing.count += count;
      } else {
        acc.push({ label, count, color });
      }

      return acc;
    },
    [] as { label: string; count: number; color: string }[],
  );

  return (
    <div>
      <div className="flex flex-row justify-between items-center gap-4 mb-4">
        <div>
          <div className="relative w-64 w-full self-left justify-center h-8">
            <Image
              fill
              alt={installerData?.name + " logo"}
              src={getLogoPath(installerData?.name)}
              className="object-contain"
            />
          </div>
          <div className="flex flex-row gap-2 my-2">
            <div className="flex flex-col">
              <h1>Status</h1>
              <TeamMemberSelector
                team={team}
                selectedMember={selectedMember}
                onSelectMember={setSelectedMember}
                defaultUser={user.id}
              />
            </div>
            <div className="flex flex-col">
              <h1>Cold caller</h1>
              <select
                className="border p-2 rounded-md"
                onChange={(e) => setStatus(Number(e.target.value))}
              >
                <option value={0}>Ringeliste</option>
                {LeadStatus.sort((a, b) => a.value - b.value).map((stat) => (
                  <option key={stat.value} value={stat.value}>
                    {stat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <input
            type="text"
            placeholder="Søk etter navn eller beskrivelse"
            className="border p-2 rounded-md w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-4 items-center">
          <div className="w-64 h-48">
            <LeadStatusChart summary={leadSummary} />
          </div>

          <div className="flex flex-col gap-1">
            {leadSummaryWithColor.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: item.color }}
                ></span>
                <span>
                  {item.label}: {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {status === 0 && (
            <Link
              className="w-42 text-center rounded-sm px-4 py-2 bg-[#FF8E4C] text-white"
              href={CLIENT_ROUTES.COLD_CALLING + "/import"}
            >
              Importer
            </Link>
          )}
          <button
            className="w-42 text-center rounded-sm px-4 py-2 bg-green-500 text-white"
            onClick={handleMove}
          >
            {status >= 5 ? "Flytt til kontakter" : "Flytt"}
          </button>
        </div>
      </div>

      <div>
        {filteredColdCalls && (
          <>
            <table className="w-full">
              <thead>
                <tr>
                  {headers.map((header, index) => (
                    <th className="border p-2 w-1/6 bg-blue-500" key={index}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>

            {filteredColdCalls
              .slice(sliceAmount - 5, sliceAmount)
              .map((lead, i) => (
                <div key={i} className="mb-4">
                  <table className="w-full mb-1">
                    <tbody>
                      <tr aria-hidden="true">
                        <td colSpan={fields.length} className="h-4"></td>
                      </tr>

                      <tr
                        className={`${
                          i % 2 == 0 ? "bg-[#82CCEB]" : "bg-[#BFE6F5]"
                        }`}
                      >
                        <EditableField
                          leadId={lead.id}
                          fieldKey="address"
                          initialValue={lead.address}
                          onFormDataChange={handleFormDataChange}
                          onSave={handleSaveFieldChange}
                          isAddressField={true}
                          handleCopyAddress={handleCopyAddress}
                          className="pr-4 cursor-pointer"
                        />

                        {fields.map((field) => (
                          <EditableField
                            key={field}
                            leadId={lead.id}
                            fieldKey={field}
                            initialValue={lead[field]}
                            onFormDataChange={handleFormDataChange}
                            onSave={handleSaveFieldChange}
                            inputType={
                              field === "mobile" || field === "phone"
                                ? "tel"
                                : "text"
                            }
                          />
                        ))}
                      </tr>
                    </tbody>
                  </table>

                  <RenderInputFields
                    lead={lead}
                    index={i}
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
            disabled={sliceAmount >= filteredColdCalls.length}
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
