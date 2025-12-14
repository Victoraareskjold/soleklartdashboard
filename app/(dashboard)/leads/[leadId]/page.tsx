"use client";
import { SolarData } from "@/app/components/SolarDataView";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import {
  getEstimatesByLeadId,
  getLead,
  getRoofTypes,
  getTeam,
  updateLead,
} from "@/lib/api";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import LeadNotesSection from "@/app/components/leads/LeadNotesSection";
import LeadEmailSection from "@/app/components/leads/LeadEmailSection";
import EstimateSection from "@/app/components/leads/EstimateSection";
import { Estimate, RoofType, Team } from "@/lib/types";
import Link from "next/link";
import { LEAD_STATUSES } from "@/app/components/LeadsTable";
import { Calendar, File, ListTodo, Mail } from "lucide-react";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";
import { useTeam } from "@/context/TeamContext";
import { useAuth } from "@/context/AuthProvider";
import LoadingScreen from "@/app/components/LoadingScreen";

interface InputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date" | "email";
  input?: "input" | "select";
  placeholder?: string;
  options?: { label: string; value: string | number }[];
}

const Input = ({
  label,
  value,
  onChange,
  type = "text",
  input = "input",
  placeholder,
  options = [],
}: InputProps) => (
  <div className="w-full">
    <label className="w-1/2 text-xs font-medium text-gray-700">{label}</label>
    <div className="w-full">
      {input === "input" ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full text-sm"
        />
      ) : (
        <select
          className="w-full text-sm"
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

  const leadIdStr = Array.isArray(leadId) ? leadId[0] : leadId;

  const [team, setTeam] = useState<Team>();
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [selectedMember2, setSelectedMember2] = useState<string>("");

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
  const [address, setAddress] = useState("");
  const [ownConsumtion, setOwnConsumtion] = useState(0);
  const [status, setStatus] = useState(0);
  const [priority, setPriority] = useState("iron");
  const [role, setRole] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [createdBy, setCreatedBy] = useState("");

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
  const mainFuseOptions = [
    { label: "25 A", value: 25 },
    { label: "32 A", value: 32 },
    { label: "40 A", value: 40 },
    { label: "50 A", value: 50 },
    { label: "63 A", value: 63 },
    { label: "80 A", value: 80 },
    { label: "100 A", value: 100 },
    { label: "125 A+", value: 125 },
  ];
  const [roofTypes, setRoofTypes] = useState<RoofType[]>([]);
  const [roofTypeId, setRoofTypeId] = useState("");
  const [roofSlope, setRoofSlope] = useState(0);

  const [roofAge, setRoofAge] = useState(0);

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

  const [activeRoute, setActiveRoute] = useState("Aktivitet");
  const routes = ["Aktivitet", "Merknader", "E-poster", "Oppgaver", "Befaring"];
  const sideMenuRoutes = [
    { label: "Merknader", icon: File },
    { label: "E-poster", icon: Mail },
    { label: "Oppgaver", icon: ListTodo },
    { label: "Befaring", icon: Calendar },
  ];

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
        setPhone(data.phone ?? "");
        setMobile(data.mobile ?? "");
        setAddress(data.address ?? "");
        setOwnConsumtion(data.own_consumption || 0);
        setVoltage(data.voltage ?? 230);
        setPhases(data.phases ?? 0);
        setRoofSlope(data.roof_slope ?? 0);
        setRoofAge(data.roof_age ?? 0);
        setRoofType(data.roof_type_id ?? "");
        setStatus(data.status ?? 0);
        setPriority(data.priority ?? "iron");
        setRole(data.role ?? "");
        setAssignedTo(data.assigned_to ?? "");
        setCreatedBy(data.created_by ?? "");
        setBirthDate(data.birth_date ?? "");
      }),
      getEstimatesByLeadId(leadIdStr).then((data) => {
        setEstimates(data ?? []);
      }),
      getRoofTypes().then((data) => {
        setRoofTypes(data ?? []);
      }),
      getTeam(teamId).then(setTeam),
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
          rt.id === solarData.selectedRoofType
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
        roof_type_id: roofTypeId || null,
        own_consumption: ownConsumtion || null,
        voltage: voltage || null,
        phases: phases || null,
        roof_slope: roofSlope || null,
        roof_age: roofAge || null,
        birth_date: birthDate || null,
      });
    } catch (err) {
      console.error("Failed to update:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateSingleField = async <K extends string>(
    field: K,
    value: string | number
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
        const payload = event.data.payload;
        setSolarData(payload);
        setActiveRoute("Estimat");
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
    dateString: string | null | undefined
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

  if (!user) return <LoadingScreen />;

  return (
    <div className="flex flex-row">
      {/* Contact information */}
      <section className="w-1/3 p-2 pr-4 flex flex-col gap-6">
        {/*  */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-medium">
            {company || personInfo || "Mangler navn"} -{" "}
            {address || "Mangler adresse"}
          </h1>
          <p>
            <strong>Oppgave status:</strong> TODO
          </p>
          <div className="flex flex-row items-center gap-1">
            <p>
              <strong>Fase: </strong>{" "}
            </p>
            <select
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

          <div className="w-full flex justify-between mt-4">
            {sideMenuRoutes.map(({ label, icon: Icon }) => (
              <div key={label} className="text-center">
                <button
                  className="rounded-full p-2 bg-[#F2F8FF] border border-[#20A6D3]"
                  onClick={() => setActiveRoute(label)}
                >
                  <Icon stroke="#000" />
                </button>
                <p className="text-xs mt-2">{label}</p>
              </div>
            ))}
          </div>
        </div>
        {/*  */}

        {/* Info del */}
        <div className="grid grid-cols-2 border-t border-b border-black py-3 gap-y-3">
          <h3 className="font-medium text-lg">Person info</h3>
          <h3 className="font-medium text-lg">Teknisk info</h3>
          <div className="pr-4 flex flex-col gap-3">
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
          </div>
          <div className="border-l pl-4 flex flex-col gap-3">
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
              input="select"
              options={mainFuseOptions}
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
            <div className="w-full">
              <label className="w-1/2 text-sm font-medium text-gray-700">
                Privat / Næring
              </label>
              <div className="w-full">
                {company ? "Næring 🏭" : "Privat 🏠"}
              </div>
            </div>
          </div>
        </div>
        {/*  */}

        {/*  */}
        <div>
          <div className="flex flex-row items-center gap-1">
            <p>
              <strong>Prioritet: </strong>{" "}
            </p>
            <select
              value={priority}
              onChange={(e) => {
                const newPriority = e.target.value;
                setPriority(newPriority);
                updateSingleField("priority", newPriority);
              }}
            >
              {PRIORITIES.map((prio) => (
                <option key={prio} value={prio}>
                  {prio}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-row items-center gap-1 mt-2">
            <div className="w-full">
              <p>Avtaleeier</p>
              <TeamMemberSelector
                team={team}
                selectedMember={selectedMember2}
                onSelectMember={setSelectedMember2}
                defaultUser={createdBy}
              />
            </div>

            <div className="w-full">
              <p>Leadinnhenter</p>
              <TeamMemberSelector
                team={team}
                selectedMember={selectedMember}
                onSelectMember={setSelectedMember}
                defaultUser={assignedTo}
              />
            </div>
          </div>
        </div>
        {/*  */}

        <button
          className="py-2 px-3 bg-orange-300"
          onClick={handleUpdate}
          disabled={loading}
        >
          {loading ? "Lagrer..." : "Lagre"}
        </button>
      </section>
      {/* Center section */}
      <section className="w-full bg-blue-100 p-2 [min-height:calc(100vh-3rem)]">
        <div className="w-full gap-2 flex mb-4">
          {routes.map((route) => (
            <button
              key={route}
              className={`px-3 py-1 rounded-md font-medium ${
                activeRoute === route
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-300"
              }`}
              onClick={() => setActiveRoute(route)}
            >
              {route}
            </button>
          ))}
        </div>

        {activeRoute === "Merknader" && (
          <LeadNotesSection leadId={leadIdStr!} />
        )}

        {activeRoute === "E-poster" && (
          <LeadEmailSection leadId={leadIdStr!} leadEmail={email} />
        )}

        {activeRoute === "Estimat" && (
          <div>
            <EstimateSection
              solarData={solarData}
              setSolarData={setSolarData}
            />
          </div>
        )}
      </section>
      <section className="w-1/4 p-2">
        <h1>Estimater</h1>
        <div className="flex gap-2">
          <ul>
            {estimates?.map((e) => (
              <li className="underline" key={e.id}>
                <Link
                  target="_blank"
                  // TODO: ekte link
                  href={`https://www.lynelektrosol.no?estimateId=${e.id}`}
                >
                  {e.created_at
                    ? new Date(e.created_at).toLocaleDateString("NO")
                    : "N/A"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        {/* <button
          className="py-2 px-3 bg-slate-100"
          onClick={handleToggleModal}
          disabled={loading}
        >
          Åpne pvmap
        </button> */}
        <button
          className="py-2 px-3 bg-slate-100"
          onClick={handleCreateNewEstimate}
          disabled={loading}
        >
          Opprett nytt estimat
        </button>
      </section>
      {/* Modals */}
      {isModalOpen && (
        <section className="flex h-full absolute inset-0 overflow-none">
          <>
            <div
              className="flex h-full w-full absolute bg-black opacity-25"
              onClick={handleToggleModal}
            ></div>
            <iframe
              src="https://pvmap.vercel.app/?site=solarinstallationdashboard"
              className="h-5/6 w-5/6 relative z-100 m-auto rounded-xl"
            />
          </>
        </section>
      )}
    </div>
  );
}
