"use client";
import { SolarData } from "@/app/components/SolarDataView";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import {
  getEstimatesByLeadId,
  getInstallerDomain,
  getLead,
  getLeadTasks,
  getRoofTypes,
  getTeam,
  updateLead,
  getLeadNotes,
  getStoredLeadEmails,
  deleteEstimate,
} from "@/lib/api";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import LeadNotesSection from "@/app/components/leads/LeadNotesSection";
import LeadEmailSection from "@/app/components/leads/LeadEmailSection";
import EstimateSection from "@/app/components/leads/EstimateSection";
import EstimateDetailModal from "@/app/components/leads/EstimateDetailModal";
import {
  Estimate,
  LeadTask,
  RoofType,
  Team,
  LeadNoteAttachment,
  EmailAttachment,
} from "@/lib/types";
import Link from "next/link";
import {
  Activity,
  Building2,
  Calendar,
  ExternalLink,
  Eye,
  File,
  Home,
  ListTodo,
  Mail,
  MapPin,
  Paperclip,
  Plus,
  Receipt,
  Save,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";
import { useTeam } from "@/context/TeamContext";
import { useAuth } from "@/context/AuthProvider";
import LoadingScreen from "@/app/components/LoadingScreen";
import TaskSection from "@/app/components/leads/TaskSection";
import { getPanelWp } from "@/utils/getPanelWp";
import AcitivitySection from "@/app/components/leads/AcitivitySection";
import { toast } from "react-toastify";
import { LEAD_STATUSES } from "@/constants/leadStatuses";
import { CLIENT_ROUTES } from "@/constants/routes";

interface InputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date" | "email";
  input?: "input" | "select";
  placeholder?: string;
  options?: { label: string; value: string | number }[];
}

const inlineFieldClass =
  "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-sm text-ink hover:border-line hover:bg-gray-50 focus:bg-surface";

const Input = ({
  label,
  value,
  onChange,
  type = "text",
  input = "input",
  placeholder,
  options = [],
}: InputProps) => (
  <div className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-2">
    <label className="truncate text-xs font-medium text-muted" title={label}>
      {label}
    </label>
    <div className="min-w-0">
      {input === "input" ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inlineFieldClass}
        />
      ) : (
        <select
          className={inlineFieldClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Velg...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  </div>
);

export default function LeadPage() {
  const { leadId } = useParams();
  const { teamId } = useTeam();
  const { user } = useAuth();
  const { installerGroupId } = useInstallerGroup();

  const router = useRouter();

  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  const leadIdStr = Array.isArray(leadId) ? leadId[0] : leadId;

  const [team, setTeam] = useState<Team>();

  const [allAttachments, setAllAttachments] = useState<
    (LeadNoteAttachment | EmailAttachment)[]
  >([]);

  useEffect(() => {
    if (!leadIdStr || !installerGroupId) return;

    const fetchAttachments = async () => {
      try {
        const [notesData, emailsResponse] = await Promise.all([
          getLeadNotes(leadIdStr),
          getStoredLeadEmails(leadIdStr, installerGroupId),
        ]);

        const noteAttachments = notesData.flatMap(
          (note) => note.attachments || [],
        );

        const emailAttachments = emailsResponse.success
          ? emailsResponse.emails.flatMap((email) => email.attachments || [])
          : [];

        const combined = [...noteAttachments, ...emailAttachments];

        combined.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        setAllAttachments(combined as (LeadNoteAttachment | EmailAttachment)[]);
      } catch (error) {
        console.error("Failed to fetch attachments:", error);
      }
    };

    fetchAttachments();
  }, [leadIdStr, installerGroupId]);

  // States
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Input
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [personInfo, setPersonInfo] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [company, setCompany] = useState("");
  const [orgNr, setOrgNr] = useState("");
  const [address, setAddress] = useState("");
  const [ownConsumtion, setOwnConsumtion] = useState(0);
  const [status, setStatus] = useState(0);
  const [priority, setPriority] = useState("iron");
  const [role, setRole] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [updatedPrice, setUpdatedPrice] = useState<number | null>(null);
  const [domain, setDomain] = useState("");
  const [leadSource, setLeadSource] = useState("");

  const LEAD_SOURCES = [
    { label: "Organic", value: "organic" },
    { label: "Google", value: "google" },
    { label: "Facebook", value: "facebook" },
    { label: "Cold Calling", value: "coldcall" },
  ];

  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(
    null,
  );
  const [showdetailedView, setShowDetailedView] = useState(false);

  // Customer info
  const [voltage, setVoltage] = useState(230);
  const voltageOptions = [
    { label: "230V", value: 230 },
    { label: "400V", value: 400 },
  ];
  const [phases, setPhases] = useState(3);
  const phaseOptions = [
    { label: "1-fase", value: 1 },
    { label: "3-fase", value: 3 },
  ];
  const [mainFuse, setMainFuse] = useState(25);

  const [roofTypes, setRoofTypes] = useState<RoofType[]>([]);
  const [roofTypeId, setRoofTypeId] = useState("");
  const [roofSlope, setRoofSlope] = useState(0);

  const [roofAge, setRoofAge] = useState(0);

  const [tasks, setTasks] = useState<LeadTask[]>([]);

  const [solarData, setSolarData] = useState<SolarData>({
    totalPanels: 0,
    selectedPanelType: "",
    selectedRoofType: "",
    checkedRoofData: [],
    selectedElPrice: 0,
    yearlyCost: 0,
    yearlyCost2: 0,
    yearlyProd: 0,
    desiredKwh: 0,
    coveragePercentage: 0,
    imageUrl: "",
    voltage: 0,
  });
  const [estimates, setEstimates] = useState<Estimate[]>();

  const [activeRoute, setActiveRoute] = useState(tab || "Aktivitet");
  const routes = ["Aktivitet", "Merknader", "E-poster", "Oppgaver", "Befaring"];
  const sideMenuRoutes = [
    { label: "Merknader", icon: File },
    { label: "E-poster", icon: Mail },
    { label: "Oppgaver", icon: ListTodo },
    { label: "Befaring", icon: Calendar },
  ];

  const [newlyCreatedEstimate, setNewlyCreatedEstimate] =
    useState<Estimate | null>(null);

  useEffect(() => {
    if (roofTypeId && roofTypes.length > 0) {
      const selectedRoof = roofTypes.find((rt) => rt.id === roofTypeId);
      if (selectedRoof) {
        setSolarData((prev) => ({
          ...prev,
          selectedRoofType: selectedRoof.name,
        }));
      }
    }
  }, [roofTypeId, roofTypes, setSolarData]);

  const handleEstimateCreated = (newEstimate: Estimate) => {
    setEstimates((prev) => (prev ? [newEstimate, ...prev] : [newEstimate]));
    setNewlyCreatedEstimate(newEstimate);
    setActiveRoute("E-poster");
  };

  const PRIORITIES = ["iron", "gold", "diamond"];

  useEffect(() => {
    if (!leadIdStr || !installerGroupId || !teamId) return;

    setLoading(true);

    Promise.all([
      getLead(leadIdStr).then((data) => {
        setEmail(data.email ?? "");
        setPersonInfo(data.person_info ?? "");
        setBirthDate(data.birth_date ?? "");
        setCompany(data.company ?? "");
        setOrgNr(data.org_nr ?? "");
        setPhone(data.phone ?? "");
        setMobile(data.mobile ?? "");
        setAddress(data.address ?? "");
        setOwnConsumtion(data.own_consumption || 0);
        setVoltage(data.voltage ?? 230);
        setPhases(data.phases ?? 0);
        setMainFuse(data.main_fuse ?? 25);
        setRoofSlope(data.roof_slope ?? 0);
        setRoofAge(data.roof_age ?? 0);
        setRoofTypeId(data.roof_type_id ?? "");
        setStatus(data.status ?? 0);
        setPriority(data.priority ?? "iron");
        setRole(data.role ?? "");
        setAssignedTo(data.assigned_to ?? "");
        setCreatedBy(data.created_by ?? "");
        setBirthDate(data.birth_date ?? "");
        setUpdatedPrice(data.updated_price ?? null);
        setLeadSource(data.lead_source ?? "");
      }),
      getEstimatesByLeadId(leadIdStr).then((data) => {
        setEstimates(data ?? []);
      }),
      getRoofTypes().then((data) => {
        setRoofTypes(data ?? []);
      }),
      getLeadTasks(leadIdStr).then(setTasks),
      getTeam(teamId).then(setTeam),
      getInstallerDomain(installerGroupId).then(setDomain),
    ])
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIdStr, installerGroupId]);

  const [roofType, setRoofType] = useState("");

  useEffect(() => {
    if (!solarData || !roofTypes.length) return;

    if (solarData.selectedRoofType) {
      const matchingRoofType = roofTypes.find(
        (rt) =>
          rt.name === solarData.selectedRoofType ||
          rt.id === solarData.selectedRoofType,
      );

      if (matchingRoofType) {
        setRoofType(matchingRoofType.name);
        if (solarData.selectedRoofType !== matchingRoofType.name) {
          setSolarData((prev) => ({
            ...prev,
            selectedRoofType: matchingRoofType.name,
          }));
        }
      }
    }
    if (solarData.checkedRoofData && solarData.checkedRoofData.length > 0) {
      setRoofSlope(solarData.checkedRoofData[0].angle || 0);
    }
  }, [solarData.selectedRoofType, roofTypes, solarData]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateLead(leadIdStr!, {
        mobile: mobile || null,
        phone: phone || null,
        email: email || null,
        address: address || null,
        person_info: personInfo || null,
        role: role || null,
        company: company || null,
        org_nr: orgNr || null,
        roof_type_id: roofTypeId || null,
        own_consumption: ownConsumtion || null,
        voltage: voltage || null,
        phases: phases || null,
        main_fuse: mainFuse || null,
        roof_slope: roofSlope || null,
        roof_age: roofAge || null,
        birth_date: birthDate || null,
        lead_source: leadSource || null,
      });
    } catch (err) {
      console.error("Failed to update:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssigneeChange = (userId: string) => {
    setAssignedTo(userId);
    updateSingleField("assigned_to", userId);
  };

  const handleOwnerChange = (userId: string) => {
    setCreatedBy(userId);
    updateSingleField("created_by", userId);
  };

  const updateSingleField = async <K extends string>(
    field: K,
    value: string | number,
  ) => {
    setLoading(true);

    try {
      await updateLead(leadIdStr!, {
        [field]: value,
      });
    } catch (err) {
      console.error("Failed to update:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PVMAP_DATA") {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { selectedRoofType, ...rest } = event.data.payload;

        setSolarData((prev) => ({
          ...prev,
          ...rest,
        }));
        setActiveRoute("Estimat");
        setIsModalOpen(false);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleToggleModal = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(!isModalOpen);
  };

  const handleCreateNewEstimate = () => {
    setIsModalOpen(true);
  };

  const formatDateForInput = (
    dateString: string | null | undefined,
  ): string => {
    if (!dateString) return "";

    try {
      const datePart = dateString.split(" ")[0];

      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return datePart;
      }

      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }

      return "";
    } catch {
      return "";
    }
  };

  const getkWp = (selectedPanelType: string, totalPanels: number) => {
    const panelWp = getPanelWp(selectedPanelType);
    return (totalPanels * panelWp) / 1000;
  };
  const nextTask = tasks
    .filter((t) => t.created_at)
    .sort(
      (a, b) =>
        new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime(),
    )[0];

  let dueText = "Ingen oppgave";

  if (nextTask) {
    const now = new Date().getTime();
    const due = new Date(nextTask.due_date!).getTime();
    const diffMs = due - now;

    if (diffMs <= 0) {
      dueText = "forfalt";
    } else if (diffMs < 1000 * 60 * 60 * 24) {
      const hours = Math.ceil(diffMs / (1000 * 60 * 60));
      dueText = `forfaller om ${hours} time${hours > 1 ? "r" : ""}`;
    } else {
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      dueText = `forfaller om ${days} dag${days > 1 ? "er" : ""}`;
    }
  }

  const getLatestEstimate = (): Estimate | null => {
    if (!estimates || estimates.length === 0) return null;

    return [...estimates].sort(
      (a, b) =>
        new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime(),
    )[0];
  };

  const latest = getLatestEstimate();
  const totalExMva = latest ? Number(latest.price_data?.total ?? 0) : null;
  const totalInklMva = latest
    ? Number(latest.price_data?.["total inkl. alt"] ?? 0)
    : null;

  const handleLeadUpdatedPriceChange = async (value: number) => {
    setUpdatedPrice(value);

    try {
      await updateLead(leadIdStr!, { updated_price: value });
    } catch (err) {
      console.error("Failed to update estimate price", err);
    }
  };

  const handleDeleteEstimate = async (estimateId: string) => {
    if (!estimateId) return;
    if (!window.confirm("Er du sikker på at du vil slette?")) return;
    try {
      await deleteEstimate(estimateId);
      setEstimates((prev) => prev?.filter((t) => t.id !== estimateId));
      toast.success("Estimat slettet!");
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Noe gikk galt ved sletting",
      );
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!leadId) return;
    if (!window.confirm("Er du sikker på at du vil slette?")) return;
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kunne ikke slette lead");
      toast.success("Lead slettet!");
      router.push(CLIENT_ROUTES.LEADS);
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt ved sletting");
    }
  };

  if (!user) return <LoadingScreen />;

  const displayName = company || personInfo || "Mangler navn";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "?";
  const currentStatus = LEAD_STATUSES.find((s) => s.value === status);
  const dueBadgeClass =
    dueText === "forfalt"
      ? "sk-badge-danger"
      : dueText === "Ingen oppgave"
        ? "sk-badge-neutral"
        : "sk-badge-warning";
  // Estimatet trenger hele bredden: sidekolonnene skjules mens det lages.
  // Klikk på en annen fane for å få dem tilbake.
  const estimateMode = activeRoute === "Estimat";
  const tabIcons: Record<string, typeof File> = {
    Aktivitet: Activity,
    ...Object.fromEntries(sideMenuRoutes.map((r) => [r.label, r.icon])),
  };

  return (
    <div className={`sk-page ${estimateMode ? "!max-w-none" : ""}`}>
      {/* Header */}
      <header className="sk-card mb-5 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 font-display text-base font-semibold text-white shadow-[0_4px_12px_-2px_rgba(24,105,255,0.35)]">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="sk-eyebrow">Lead</p>
              <h1 className="truncate font-display text-xl font-semibold text-ink">
                {displayName}
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                <MapPin size={14} className="shrink-0" />
                <span className="truncate">
                  {address || "Mangler adresse"}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="sk-badge sk-badge-neutral">
                  {company ? <Building2 size={12} /> : <Home size={12} />}
                  {company ? "Næring" : "Privat"}
                </span>
                <span className={`sk-badge ${dueBadgeClass}`}>
                  <ListTodo size={12} />
                  Oppgave: {dueText}
                </span>
                {estimates && estimates.length > 0 && (
                  <span className="sk-badge sk-badge-brand">
                    <Receipt size={12} />
                    {estimates.length} estimat
                    {estimates.length === 1 ? "" : "er"}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="sk-btn sk-btn-danger-ghost"
              onClick={() => handleDeleteLead(leadIdStr!)}
            >
              <Trash2 size={15} />
              Slett lead
            </button>
            <button
              className="sk-btn sk-btn-primary"
              onClick={handleCreateNewEstimate}
              disabled={loading}
            >
              <Plus size={16} />
              Opprett nytt estimat
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line bg-gray-50/60 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Fase</span>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-2.5 top-1/2 size-2.5 -translate-y-1/2 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: currentStatus?.color ?? "#c8d1dc" }}
              />
              <select
                className="h-8 max-w-[280px] rounded-full border border-line bg-surface pl-7 text-xs font-semibold text-ink"
                value={status}
                onChange={(e) => {
                  const newStatus = Number(e.target.value);
                  setStatus(newStatus);
                  updateSingleField("status", newStatus);
                }}
              >
                {LEAD_STATUSES.map((stat) => (
                  <option key={stat.value} value={stat.value}>
                    {stat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Prioritet</span>
            <div className="flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/icons/${priority}.png`}
                alt={priority}
                className="size-5"
              />
              <select
                className="h-8 rounded-full border border-line bg-surface pl-3 text-xs font-semibold text-ink"
                value={priority}
                onChange={(e) => {
                  const newPriority = e.target.value;
                  setPriority(newPriority);
                  updateSingleField("priority", newPriority);
                }}
              >
                {PRIORITIES.map((prio) => (
                  <option key={prio} value={prio}>
                    {prio.charAt(0).toUpperCase() + prio.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Kilde</span>
            <select
              className="h-8 rounded-full border border-line bg-surface pl-3 text-xs font-semibold text-ink"
              value={leadSource}
              onChange={(e) => {
                const newSource = e.target.value;
                setLeadSource(newSource);
                updateSingleField("lead_source", newSource);
              }}
            >
              <option value="">Mangler lead kilde</option>
              {LEAD_SOURCES.map((src) => (
                <option key={src.value} value={src.value}>
                  {src.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div
        className={
          estimateMode
            ? "grid grid-cols-1 gap-5"
            : "grid grid-cols-1 gap-5 xl:grid-cols-[300px_minmax(0,1fr)_290px] 2xl:grid-cols-[340px_minmax(0,1fr)_320px]"
        }
      >
        {/* Left column — contact & technical info */}
        <aside
          className={`flex min-w-0 flex-col gap-5 ${estimateMode ? "hidden" : ""}`}
        >
          <div className="sk-card">
            <div className="sk-card-header py-3">
              <h3 className="sk-section-title text-sm">Person info</h3>
            </div>
            <div className="flex flex-col gap-1 p-3">
              <Input
                label="Mobil"
                value={mobile}
                onChange={setMobile}
                placeholder="Mobil"
              />
              <Input
                label="Telefon"
                value={phone}
                onChange={setPhone}
                placeholder="Telefon"
              />
              <Input
                label="E-postadresse"
                value={email}
                onChange={setEmail}
                placeholder="E-postadresse"
              />
              <Input
                label="Adresse"
                value={address}
                onChange={setAddress}
                placeholder="Adresse"
              />
              <Input
                label="Navn"
                value={personInfo}
                onChange={setPersonInfo}
                placeholder="Navn"
              />
              <Input
                label="Fødselsdato"
                value={formatDateForInput(birthDate)}
                onChange={setBirthDate}
                type="date"
                placeholder="Fødselsdato"
              />
              <Input
                label="Rolle"
                value={role}
                onChange={setRole}
                type="text"
                placeholder="Rolle"
              />
              <Input
                label="Firma navn"
                value={company}
                onChange={setCompany}
                placeholder="Firma navn"
              />
              <Input
                label="Org.Nr"
                value={orgNr}
                onChange={setOrgNr}
                placeholder="Organisasjonsnummer"
              />
            </div>
          </div>

          <div className="sk-card">
            <div className="sk-card-header py-3">
              <h3 className="sk-section-title text-sm">Teknisk info</h3>
              <span className="sk-badge sk-badge-neutral">
                {company ? <Building2 size={12} /> : <Home size={12} />}
                {company ? "Næring" : "Privat"}
              </span>
            </div>
            <div className="flex flex-col gap-1 p-3">
              <Input
                label="Taktype"
                value={roofTypeId || roofType} // Bruk ID'en
                onChange={(val) => {
                  setRoofTypeId(val); // Sett ID'en
                  // Finn navnet for å oppdatere solarData
                  const selectedRoof = roofTypes.find((rt) => rt.id === val);
                  if (selectedRoof) {
                    setSolarData((prev) => ({
                      ...prev,
                      selectedRoofType: selectedRoof.name,
                    }));
                  }
                }}
                input="select"
                options={roofTypes.map((r) => ({ label: r.name, value: r.id }))} // ID som value
                placeholder="Taktype"
              />
              <Input
                label="Eget forbruk"
                value={ownConsumtion}
                onChange={(val) => setOwnConsumtion(Number(val))}
                type="number"
                placeholder="Eget forbruk"
              />
              <Input
                label="Spenning (nett)"
                value={(voltage || solarData.voltage) ?? 230}
                onChange={(val) => setVoltage(Number(val))}
                input="select"
                options={voltageOptions}
                placeholder="Spenning (nett)"
              />
              <Input
                label="Faser"
                value={phases}
                onChange={(val) => setPhases(Number(val))}
                input="select"
                options={phaseOptions}
                placeholder="Faser"
              />
              <Input
                label="Hovedsikring (A)"
                value={mainFuse}
                onChange={(val) => setMainFuse(Number(val))}
                type="number"
                placeholder="HovedSikring (A)"
              />
              <Input
                label="Helning på tak"
                value={roofSlope.toFixed(0)}
                onChange={(val) => setRoofSlope(Number(val))}
                type="number"
                placeholder="Helning på tak"
              />
              <Input
                label="Alder på tak i år"
                value={roofAge}
                onChange={(val) => setRoofAge(Number(val))}
                type="number"
                placeholder="Alder på tak i år"
              />
            </div>
            <div className="border-t border-line p-3">
              <button
                className="sk-btn sk-btn-primary w-full"
                onClick={handleUpdate}
                disabled={loading}
              >
                <Save size={15} />
                {loading ? "Lagrer..." : "Lagre"}
              </button>
            </div>
          </div>

          <div className="sk-card">
            <div className="sk-card-header py-3">
              <h3 className="sk-section-title text-sm">Ansvarlige</h3>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="w-full">
                <p className="sk-label">Avtaleeier</p>
                <TeamMemberSelector
                  team={team}
                  selectedMember={createdBy}
                  onSelectMember={handleOwnerChange}
                  defaultUser={createdBy}
                  firstOption="Avtaleeier"
                />
              </div>
              <div className="w-full">
                <p className="sk-label">Lead-innhenter</p>
                <TeamMemberSelector
                  team={team}
                  selectedMember={assignedTo}
                  onSelectMember={handleAssigneeChange}
                  defaultUser={assignedTo}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Center section */}
        <section className="flex min-w-0 flex-col gap-4">
          <div className="overflow-x-auto">
            <div className="sk-tabs">
              {routes.map((route) => {
                const Icon = tabIcons[route];
                return (
                  <button
                    key={route}
                    className={`sk-tab inline-flex items-center gap-1.5 ${
                      activeRoute === route ? "sk-tab-active" : ""
                    }`}
                    onClick={() => setActiveRoute(route)}
                  >
                    {Icon && <Icon size={15} />}
                    {route}
                  </button>
                );
              })}
              {activeRoute === "Estimat" && (
                <span className="sk-tab sk-tab-active inline-flex items-center gap-1.5">
                  <Sun size={15} />
                  Estimat
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 animate-fade-in" key={activeRoute}>
            {activeRoute === "Aktivitet" && (
              <AcitivitySection leadId={leadIdStr!} />
            )}

            {activeRoute === "Merknader" && (
              <LeadNotesSection leadId={leadIdStr!} />
            )}

            {activeRoute === "E-poster" && (
              <LeadEmailSection
                leadId={leadIdStr!}
                leadEmail={email}
                newEstimate={newlyCreatedEstimate}
                leadName={personInfo || company}
                domain={domain}
                estimates={estimates}
              />
            )}

            {activeRoute === "Estimat" && (
              <div>
                <EstimateSection
                  solarData={solarData}
                  setSolarData={setSolarData}
                  onEstimateCreated={handleEstimateCreated}
                  ownConsumption={ownConsumtion}
                  leadCompany={company}
                />
              </div>
            )}

            {activeRoute === "Oppgaver" && <TaskSection leadId={leadIdStr!} />}
          </div>
        </section>

        {/* Right section */}
        <aside
          className={`flex min-w-0 flex-col gap-5 ${estimateMode ? "hidden" : ""}`}
        >
          <div className="sk-card">
            <div className="sk-card-header py-3">
              <h3 className="sk-section-title text-sm">Estimater</h3>
              <button
                className="sk-btn sk-btn-secondary sk-btn-sm"
                onClick={handleCreateNewEstimate}
                disabled={loading}
              >
                <Plus size={14} />
                Nytt
              </button>
            </div>
            <div className="p-3">
              {estimates && estimates.length > 0 ? (
                <ul className="flex w-full flex-col gap-2.5">
                  {estimates
                    .sort(
                      (a, b) =>
                        new Date(b.created_at!).getTime() -
                        new Date(a.created_at!).getTime(),
                    )
                    .map((e) => {
                      const estimateUrl = e.finished
                        ? `https://www.${domain}.no/estimat/${e.id}?f=1`
                        : `https://www.${domain}.no/estimat/${e.id}`;

                      const currentPanel = e.price_data?.suppliers?.find(
                        (i) => i.category === "solcellepanel",
                      );

                      // Bruk din getkWp funksjon med det spesifikke panelet
                      const kwp = e.kwp
                        ? e.kwp
                        : currentPanel
                          ? getkWp(
                              currentPanel.product || e.selected_panel_type!,
                              e.total_panels!,
                            )
                          : 0;

                      return (
                        <li
                          key={e.id}
                          className="group rounded-xl border border-line bg-surface p-3 transition-shadow hover:border-gray-300 hover:shadow-card"
                        >
                          <Link
                            target="_blank"
                            href={estimateUrl}
                            className="block"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-ink group-hover:text-brand">
                                Tilbud - {kwp.toFixed(1)} kWp
                              </p>
                              {e.finished &&
                                (e.signed_at ? (
                                  <span className="sk-badge sk-badge-success">
                                    Signert
                                  </span>
                                ) : (
                                  <span className="sk-badge sk-badge-warning">
                                    Uavklart
                                  </span>
                                ))}
                            </div>
                            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                              <ExternalLink size={11} className="shrink-0" />
                              <span className="truncate">{estimateUrl}</span>
                            </p>
                          </Link>

                          <div className="mt-3 flex items-end justify-between gap-2">
                            <div>
                              <p className="text-[11px] text-muted">
                                Total eks. mva
                              </p>
                              <p className="text-sm font-semibold tabular-nums text-ink">
                                {Number(e.price_data?.total ?? 0).toLocaleString(
                                  "nb-NO",
                                  {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                  },
                                )}{" "}
                                kr
                              </p>
                            </div>
                            <p className="text-[11px] tabular-nums text-muted">
                              {e.created_at
                                ? new Date(e.created_at).toLocaleString("nb-NO")
                                : "N/A"}
                            </p>
                          </div>

                          <div className="mt-3 flex items-center gap-1.5 border-t border-gray-100 pt-2.5">
                            <button
                              className="sk-btn sk-btn-secondary sk-btn-sm flex-1"
                              onClick={() => {
                                setSelectedEstimate(e);
                                setShowDetailedView(true);
                              }}
                            >
                              <Eye size={14} />
                              Se detaljert visning
                            </button>
                            <button
                              className="sk-btn sk-btn-danger-ghost sk-btn-sm"
                              onClick={() => handleDeleteEstimate(e.id)}
                              disabled={Boolean(e.signed_at)}
                              title={
                                e.signed_at
                                  ? "Signerte tilbud kan ikke slettes"
                                  : "Slett"
                              }
                            >
                              <Trash2 size={14} />
                              Slett
                            </button>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-xs text-muted">
                  <Receipt size={18} className="text-gray-400" />
                  Ingen estimater ennå
                </div>
              )}
            </div>
          </div>

          <div className="sk-card">
            <div className="sk-card-header py-3">
              <h3 className="sk-section-title text-sm">Vedlegg</h3>
              {allAttachments.length > 0 && (
                <span className="sk-badge sk-badge-neutral">
                  {allAttachments.length}
                </span>
              )}
            </div>
            <ul className="flex w-full flex-col gap-1 p-2">
              {allAttachments.length > 0 ? (
                allAttachments.map((att) => (
                  <li key={att.id}>
                    <a
                      href={att.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-gray-50"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                        <Paperclip size={14} />
                      </span>
                      <span className="min-w-0">
                        <span
                          className="block truncate text-sm font-medium text-ink"
                          title={att.file_name}
                        >
                          {att.file_name}
                        </span>
                        <span className="block text-[11px] text-muted">
                          {new Date(att.created_at).toLocaleString("nb-NO")}
                        </span>
                      </span>
                    </a>
                  </li>
                ))
              ) : (
                <p className="px-2 py-3 text-sm text-muted">
                  Ingen vedlegg funnet.
                </p>
              )}
            </ul>
          </div>

          <div className="sk-card">
            <div className="sk-card-header py-3">
              <h3 className="sk-section-title text-sm">Fakturering</h3>
            </div>
            <div className="flex w-full flex-col gap-3 p-4">
              <div>
                <label className="sk-label">Pris eks. mva (kr)</label>
                <input
                  type="number"
                  className="sk-input tabular-nums"
                  value={updatedPrice?.toFixed(2) ?? totalExMva?.toFixed(2) ?? ""}
                  placeholder={
                    totalExMva !== null
                      ? totalExMva.toLocaleString("nb-NO")
                      : "Ingen estimat"
                  }
                  onChange={(e) => {
                    const val =
                      e.target.value === "" ? null : Number(e.target.value);
                    setUpdatedPrice(val);
                  }}
                  onBlur={(e) => {
                    const val =
                      e.target.value === "" ? null : Number(e.target.value);
                    if (val !== null) handleLeadUpdatedPriceChange(val);
                  }}
                />
              </div>
              <div>
                <label className="sk-label">Pris inkl. mva (kr)</label>
                <input
                  type="number"
                  className="sk-input tabular-nums"
                  value={
                    updatedPrice != null
                      ? Math.round(updatedPrice * 1.25).toFixed(2)
                      : (totalInklMva ?? "")
                  }
                  placeholder={
                    totalInklMva !== null
                      ? totalInklMva.toLocaleString("nb-NO")
                      : "Ingen estimat"
                  }
                  onChange={(e) => {
                    const val =
                      e.target.value === "" ? null : Number(e.target.value);
                    setUpdatedPrice(
                      val !== null ? Math.round(val / 1.25) : null,
                    );
                  }}
                  onBlur={(e) => {
                    const val =
                      e.target.value === "" ? null : Number(e.target.value);
                    if (val !== null)
                      handleLeadUpdatedPriceChange(Math.round(val / 1.25));
                  }}
                />
              </div>
              {updatedPrice !== null &&
                totalExMva !== null &&
                updatedPrice !== totalExMva && (
                  <p className="sk-hint">
                    Estimat: {totalExMva.toLocaleString("nb-NO")} kr eks. mva
                  </p>
                )}
            </div>
          </div>
        </aside>
      </div>

      {/* Modals */}
      {isModalOpen && (
        <section className="fixed inset-0 z-[60] flex animate-fade-in p-6">
          <>
            <div
              className="absolute inset-0 bg-ink/40 backdrop-blur-[3px]"
              onClick={handleToggleModal}
            ></div>
            <div className="relative m-auto h-5/6 w-5/6 animate-pop-in overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
              <button
                type="button"
                className="sk-icon-btn absolute right-3 top-3 z-10 bg-surface/90 shadow-card"
                onClick={handleToggleModal}
                aria-label="Lukk"
              >
                <X size={18} />
              </button>
              <iframe
                src={`https://pvmap.vercel.app/?site=${domain}&embed=dashboard&preAdr=${address}&aerial=0`}
                className="h-full w-full"
              />
            </div>
          </>
        </section>
      )}
      {showdetailedView && selectedEstimate && (
        <EstimateDetailModal
          estimate={selectedEstimate}
          onClose={() => setShowDetailedView(false)}
          onSaved={(updated) => {
            setEstimates((prev) =>
              (prev ?? []).map((e) => (e.id === updated.id ? updated : e)),
            );
            setSelectedEstimate(updated);
          }}
        />
      )}
    </div>
  );
}
