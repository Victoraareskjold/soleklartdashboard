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
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Inbox,
  MapPin,
  Pencil,
  Search,
  Upload,
  X,
} from "lucide-react";
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
};

export type FormData = {
  [leadId: string]: FormDataFields;
};

// The editable basic-info fields shown in the table row
type BasicLeadEdit = {
  address: string;
  person_info: string;
  role: string;
  company: string;
  mobile: string;
  phone: string;
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

  // ── Inline editing state ──────────────────────────────────────────────────
  // leadId of the row currently being edited, or null
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  // Scratch-pad for the values being edited
  const [editDraft, setEditDraft] = useState<BasicLeadEdit>({
    address: "",
    person_info: "",
    role: "",
    company: "",
    mobile: "",
    phone: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────

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

    return () => controller.abort();
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
        if ((err as Error)?.name !== "AbortError") {
          console.error("Failed to fetch leads:", err);
        }
      }
    };

    fetchLeadsForUser();
    return () => controller.abort();
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

  // ── Inline-edit helpers ───────────────────────────────────────────────────
  const startEditing = (lead: ColdCallLead) => {
    setEditingLeadId(lead.id);
    setEditDraft({
      address: lead.address ?? "",
      person_info: lead.person_info ?? "",
      role: lead.role ?? "",
      company: lead.company ?? "",
      mobile: lead.mobile ?? "",
      phone: lead.phone ?? "",
    });
  };

  const cancelEditing = () => {
    setEditingLeadId(null);
  };

  const saveEditing = async (leadId: string) => {
    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/coldCalling/updateBasicInfo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, ...editDraft }),
      });

      if (!res.ok) throw new Error("Feil ved oppdatering");

      // Optimistically update the local list
      setColdCalls((prev) =>
        prev.map((lead) =>
          lead.id === leadId ? { ...lead, ...editDraft } : lead,
        ),
      );

      toast.success("Lead oppdatert!");
      setEditingLeadId(null);
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt ved lagring");
    } finally {
      setIsSavingEdit(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleMove = async () => {
    if (status >= 5 && status != 22) {
      const allLeads = coldCalls.map((lead) => {
        const data = formData[lead.id] || {};
        return { id: lead.id, ...data, status: "6" };
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
        setColdCalls([]);
      } catch (err) {
        console.error(err);
        toast.error("Noe gikk galt");
      }
      return;
    }

    const completeLeads = coldCalls
      .map((lead) => {
        const data = formData[lead.id];
        if (!data) return null;

        const newStatus = data.status;
        if (newStatus === null || newStatus === undefined) return null;
        if (newStatus === String(lead.status)) return null;

        const leadUpdateData: { [key: string]: unknown } = { ...data };

        if (newStatus === "") {
          if (status !== 0) {
            leadUpdateData.status = "0";
          } else {
            return null;
          }
        }

        return { id: lead.id, ...leadUpdateData };
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

  const headers = [
    "Adresse",
    "Navn",
    "Rolle",
    "Firmanavn",
    "Mobil",
    "Telefon",
    "",
  ];
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
        color = "#CCCCCC";
      } else if (status > 5 && status !== 22) {
        label = "Vil ha tilbud";
        color = "#69FF59";
      } else {
        const info = LeadStatus.find((s) => s.value === status);
        if (!info) return acc;
        label = info.label;
        color = info.color;
      }

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

  const totalSummary = leadSummaryWithColor.reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const pageStart = filteredColdCalls.length ? sliceAmount - 4 : 0;
  const pageEnd = Math.min(sliceAmount, filteredColdCalls.length);

  return (
    <div className="sk-page">
      {/* ── Header ── */}
      <div className="sk-page-header">
        <div className="flex items-center gap-4">
          <div className="relative h-10 w-32 shrink-0 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <Image
              fill
              alt={installerData?.name + " logo"}
              src={getLogoPath(installerData?.name)}
              className="object-contain p-1.5"
            />
          </div>
          <div>
            <h1 className="sk-page-title">Cold calling</h1>
            <p className="sk-page-subtitle">
              {installerData?.name} ·{" "}
              <span className="font-semibold text-ink tabular-nums">
                {filteredColdCalls.length}
              </span>{" "}
              leads i listen
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 0 && (
            <Link
              className="sk-btn sk-btn-secondary"
              href={CLIENT_ROUTES.COLD_CALLING + "/import"}
            >
              <Upload size={15} />
              Importer
            </Link>
          )}
          <button className="sk-btn sk-btn-primary" onClick={handleMove}>
            {status >= 5 && status !== 22 ? "Flytt til kontakter" : "Flytt"}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* ── Filters + stats ── */}
      <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="sk-card-pad flex flex-col justify-between gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="sk-label">Status</label>
              <TeamMemberSelector
                team={team}
                selectedMember={selectedMember}
                onSelectMember={setSelectedMember}
                defaultUser={user.id}
              />
            </div>
            <div>
              <label className="sk-label">Cold caller</label>
              <select
                className="sk-input cursor-pointer"
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

          <div className="relative">
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

        <div className="sk-card-pad flex items-center gap-6">
          <div className="relative size-36 shrink-0">
            <LeadStatusChart summary={leadSummary} />
            {totalSummary > 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-xl font-semibold text-ink tabular-nums">
                  {totalSummary}
                </span>
                <span className="text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">
                  Leads
                </span>
              </div>
            )}
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {leadSummaryWithColor.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-sm hover:bg-gray-50"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: item.color }}
                  ></span>
                  <span className="truncate text-body">{item.label}</span>
                </span>
                <span className="font-semibold text-ink tabular-nums">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lead cards ── */}
      <div className="space-y-4">
        {filteredColdCalls.length === 0 && (
          <div className="sk-empty">
            <span className="flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Inbox size={18} />
            </span>
            <span className="font-medium text-ink">Ingen leads her</span>
            <span className="text-xs">
              Prøv et annet filter eller importer nye leads.
            </span>
          </div>
        )}

        {filteredColdCalls
          .slice(sliceAmount - 5, sliceAmount)
          .map((lead, i) => {
            const isEditing = editingLeadId === lead.id;

            return (
              <div
                key={i}
                className={`sk-card overflow-hidden transition-shadow hover:shadow-pop ${
                  isEditing ? "ring-2 ring-brand/30" : ""
                }`}
              >
                {/* ── Lead header: address + controls ── */}
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-semibold text-brand tabular-nums">
                      {sliceAmount - 4 + i}
                    </span>
                    {isEditing ? (
                      <div className="w-full max-w-md">
                        <input
                          className="sk-input h-8"
                          placeholder={headers[0]}
                          value={editDraft.address}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              address: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        title="Kopier adresse"
                        className="group flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-gray-50"
                        onClick={() => handleCopyAddress(lead.address)}
                      >
                        <MapPin size={15} className="shrink-0 text-muted" />
                        <span className="truncate font-display text-[15px] font-semibold text-ink">
                          {lead.address || "—"}
                        </span>
                        <Copy
                          size={13}
                          className="shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100"
                        />
                      </button>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {isEditing ? (
                      <>
                        <button
                          title="Avbryt"
                          onClick={cancelEditing}
                          className="sk-btn sk-btn-ghost sk-btn-sm"
                        >
                          <X size={14} />
                          Avbryt
                        </button>
                        <button
                          title="Lagre"
                          disabled={isSavingEdit}
                          onClick={() => saveEditing(lead.id)}
                          className="sk-btn sk-btn-primary sk-btn-sm"
                        >
                          <Check size={14} />
                          Lagre
                        </button>
                      </>
                    ) : (
                      <button
                        title="Rediger"
                        onClick={() => startEditing(lead)}
                        className="sk-icon-btn size-8"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Basic info ── */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 md:grid-cols-3 xl:grid-cols-5">
                  {fields.map((field, idx) => {
                    const draftKey = field as keyof BasicLeadEdit;
                    const value = lead[field];
                    const isPhone = field === "mobile" || field === "phone";
                    return (
                      <div key={field} className="min-w-0">
                        <div className="mb-1 text-[11px] font-semibold text-muted">
                          {headers[idx + 1]}
                        </div>
                        {isEditing ? (
                          <input
                            className="sk-input h-8"
                            value={editDraft[draftKey]}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                [draftKey]: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          <div
                            className={`truncate text-sm ${
                              value
                                ? isPhone
                                  ? "font-semibold text-ink tabular-nums"
                                  : "font-medium text-ink"
                                : "text-gray-400"
                            }`}
                          >
                            {value || "—"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Call outcome ── */}
                <div className="border-t border-line bg-gray-50/60 px-5 py-4">
                  <RenderInputFields
                    lead={lead}
                    index={i}
                    formData={formData}
                    onFormDataChange={handleFormDataChange}
                    roofTypeOptions={roofTypeOptions}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* ── Pagination ── */}
      {filteredColdCalls.length > 0 && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-muted">
            Viser{" "}
            <span className="font-semibold text-ink tabular-nums">
              {pageStart}–{pageEnd}
            </span>{" "}
            av{" "}
            <span className="font-semibold text-ink tabular-nums">
              {filteredColdCalls.length}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <button
              className="sk-btn sk-btn-secondary sk-btn-sm"
              disabled={sliceAmount <= 5}
              onClick={() => setSliceAmount(sliceAmount - 5)}
            >
              <ChevronLeft size={15} /> Tilbake
            </button>
            <button
              disabled={sliceAmount >= filteredColdCalls.length}
              className="sk-btn sk-btn-secondary sk-btn-sm"
              onClick={() => setSliceAmount(sliceAmount + 5)}
            >
              Neste
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
