"use client";
import LoadingScreen from "@/app/components/LoadingScreen";
import { useAuth } from "@/context/AuthProvider";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { getRoofTypes, getTeam } from "@/lib/api";
import { RoofType, Team } from "@/lib/types";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";
import { useRouter } from "next/navigation";
import { CLIENT_ROUTES } from "@/constants/routes";
import { CalendarPlus, Plus, Search, UserRound, Users, X } from "lucide-react";

export type ContactLead = {
  id: string;
  person_info: string | null;
  address: string | null;
  mobile: string | null;
  phone: string | null;
  email: string | null;
  assigned_to: string | null;
  note: string | null;
};

export type CreateLead = {
  team_id: string;
  installer_group_id: string;
  email: string | null;
  person_info: string | null;
  address: string | null;
  mobile: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  assigned_to: string | null;
  created_by: string | null;
  roof_type_id: string | null;
  own_consumption: number | null;
  voltage: number | null;
  roof_slope: number | null;
  roof_age: number | null;
  note: string | null;
};

export default function ContactsPage() {
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();
  const { user } = useAuth();

  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [team, setTeam] = useState<Team>();
  const [selectedMember, setSelectedMember] = useState<string>("");

  const [coldCalls, setColdCalls] = useState<ContactLead[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [roofTypes, setRoofTypes] = useState<RoofType[]>([]);

  const [formData, setFormData] = useState<CreateLead>({
    team_id: teamId!,
    installer_group_id: installerGroupId!,
    email: null,
    person_info: null,
    address: null,
    mobile: null,
    phone: null,
    company: null,
    role: null,
    assigned_to: selectedMember,
    created_by: null,
    roof_type_id: null,
    own_consumption: null,
    voltage: null,
    roof_slope: null,
    roof_age: null,
    note: null,
  });

  useEffect(() => {
    if (!teamId) return;

    getTeam(teamId).then(setTeam);
    getRoofTypes()
      .then(setRoofTypes)
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

  useEffect(() => {
    setFormData((prev) => ({ ...prev, assigned_to: selectedMember }));
  }, [selectedMember]);

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
    type: "text" | "select" | "number" | "textarea";
    options?: { value: string | number; label: string }[];
  }[] = [
    { label: "E-post", value: "email", type: "text" },
    { label: "Navn", value: "person_info", type: "text" },
    { label: "Firma", value: "company", type: "text" },
    { label: "Rolle", value: "role", type: "text" },
    { label: "Mobil", value: "mobile", type: "text" },
    { label: "Telefon", value: "phone", type: "text" },
    { label: "Adresse", value: "address", type: "text" },
    {
      label: "Taktekke",
      value: "roof_type_id",
      type: "select",
    },
    { label: "Eget forbruk", value: "own_consumption", type: "number" },
    {
      label: "Nettspenning",
      value: "voltage",
      type: "select",
      options: [
        { value: 230, label: "230V" },
        { value: 400, label: "400V" },
      ],
    },
    { label: "Helning på tak", value: "roof_slope", type: "number" },
    { label: "Alder på tak", value: "roof_age", type: "number" },
    { label: "Merknad", value: "note", type: "textarea" },
  ];

  if (!user || !team) return <LoadingScreen />;

  const filteredColdCalls = coldCalls.filter((lead) => {
    const query = searchQuery.toLowerCase();
    return (
      (lead.person_info && lead.person_info.toLowerCase().includes(query)) ||
      (lead.address && lead.address.toLowerCase().includes(query)) ||
      (lead.email && lead.email.toLowerCase().includes(query)) ||
      (lead.mobile && lead.mobile.toLowerCase().includes(query)) ||
      (lead.phone && lead.phone.toLowerCase().includes(query))
    );
  });

  const handleUpdateToLead = async (contact: ContactLead) => {
    try {
      const res = await fetch("/api/coldCalling/contact/upsert", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: contact.id,
          userId: user!.id,
          note: contact.note,
        }),
      });

      if (!res.ok) throw new Error("Feil ved oppretelse av avtale");

      toast.success("Avtale opprettet!");
      router.push(`${CLIENT_ROUTES.LEADS}/${contact.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt");
    }
  };

  const handleCreateLead = async () => {
    const createContact = {
      ...formData,
      team_id: teamId,
      installer_group_id: installerGroupId,
    };
    try {
      const res = await fetch("/api/coldCalling/contact/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createContact),
      });

      if (!res.ok) throw new Error("Feil ved oppretelse av avtale");

      const data = await res.json();

      toast.success("Avtale opprettet!");
      router.push(`${CLIENT_ROUTES.LEADS}/${data.id}`);
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt");
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({
      team_id: teamId!,
      installer_group_id: installerGroupId!,
      email: null,
      person_info: null,
      address: null,
      mobile: null,
      phone: null,
      company: null,
      role: null,
      assigned_to: user.id,
      created_by: user.id,
      roof_type_id: null,
      own_consumption: null,
      voltage: null,
      roof_slope: null,
      roof_age: null,
      note: null,
    });
    setSelectedMember(user.id);
    setIsModalOpen(true);
  };

  const inputClass = "sk-input";

  return (
    <>
      <div className="sk-page">
        <div className="sk-page-header">
          <div>
            <h1 className="sk-page-title">Kontakter</h1>
            <p className="sk-page-subtitle">
              <span className="font-semibold text-ink tabular-nums">
                {filteredColdCalls.length}
              </span>{" "}
              kontakter klare for avtale
            </p>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="sk-btn sk-btn-primary"
          >
            <Plus size={16} />
            Opprett kontakt
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="w-56">
            <TeamMemberSelector
              team={team}
              selectedMember={selectedMember}
              onSelectMember={setSelectedMember}
            />
          </div>
          <div className="relative w-full max-w-sm">
            <Search
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Søk etter navn eller beskrivelse"
              className="sk-input pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="sk-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="sk-table">
              <thead>
                <tr>
                  {headers.map((header, index) => (
                    <th key={index}>{header}</th>
                  ))}
                  <th className="w-px"></th>
                </tr>
              </thead>
              <tbody>
                {filteredColdCalls.map((coldCall) => {
                  const collector =
                    team?.members?.find(
                      (m) => m.user_id === coldCall.assigned_to,
                    )?.name || coldCall.assigned_to;
                  return (
                    <tr key={coldCall.id}>
                      {fields.map((field) => (
                        <td
                          key={field}
                          className={
                            field === "address" || field === "person_info"
                              ? "font-medium text-ink!"
                              : field === "mobile" || field === "phone"
                                ? "whitespace-nowrap tabular-nums"
                                : ""
                          }
                        >
                          {coldCall[field] || (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      ))}
                      <td>
                        {collector ? (
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                            <UserRound size={13} className="text-muted" />
                            {collector}
                          </span>
                        ) : (
                          <span className="sk-badge sk-badge-neutral">
                            Ingen leadinnhenter
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleUpdateToLead(coldCall)}
                          className="sk-btn sk-btn-accent sk-btn-sm"
                        >
                          <CalendarPlus size={14} />
                          Opprett avtale
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredColdCalls.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-sm text-muted">
              <span className="flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Users size={18} />
              </span>
              <span className="font-medium text-ink">Ingen kontakter</span>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="sk-overlay">
          <div className="sk-modal flex max-w-2xl flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <UserRound size={17} />
                </span>
                <h2 className="font-display text-lg font-semibold text-ink">
                  Opprett kontakt
                </h2>
              </div>
              <button
                className="sk-icon-btn"
                onClick={() => setIsModalOpen(false)}
                title="Lukk"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                {formDataFields.map((field) => (
                  <div
                    key={field.value}
                    className={field.type === "textarea" ? "col-span-2" : ""}
                  >
                    <label className="sk-label">{field.label}</label>
                    {field.type === "text" && (
                      <input
                        className={inputClass}
                        type="text"
                        placeholder={field.label}
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
                        className={`${inputClass} tabular-nums`}
                        type="number"
                        placeholder={field.label}
                        value={formData[field.value] ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            [field.value]: e.target.value,
                          }))
                        }
                      />
                    )}
                    {field.type === "textarea" && (
                      <textarea
                        className="sk-textarea min-h-20"
                        placeholder={field.label}
                        value={formData[field.value] ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            [field.value]: e.target.value,
                          }))
                        }
                      />
                    )}
                    {field.type === "select" && (
                      <select
                        className={`${inputClass} cursor-pointer`}
                        value={formData[field.value] ?? ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            [field.value]: e.target.value,
                          }))
                        }
                      >
                        <option value="">
                          Velg {field.label.toLowerCase()}
                        </option>

                        {field.value === "roof_type_id"
                          ? roofTypes.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))
                          : (field.options || []).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                      </select>
                    )}
                  </div>
                ))}
                <div>
                  <label className="sk-label">Lead-innhenter</label>
                  <TeamMemberSelector
                    team={team}
                    selectedMember={selectedMember}
                    onSelectMember={setSelectedMember}
                    defaultUser={selectedMember}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line bg-gray-50/60 px-6 py-4">
              <button
                className="sk-btn sk-btn-secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Avbryt
              </button>
              <button className="sk-btn sk-btn-primary" onClick={handleCreateLead}>
                <Plus size={16} />
                Opprett
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
