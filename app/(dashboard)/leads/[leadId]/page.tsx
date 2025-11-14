"use client";
import { SolarData } from "@/app/components/SolarDataView";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import {
  getEstimate,
  getLead,
  getRoofTypes,
  updateEstimate,
  updateLead,
} from "@/lib/api";
import { mapEstimateToSolarData, mapSolarDataToEstimate } from "@/lib/mappers";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import LeadNotesSection from "@/app/components/leads/LeadNotesSection";
import LeadEmailSection from "@/app/components/leads/LeadEmailSection";
import EstimateSection from "@/app/components/leads/EstimateSection";
import { RoofType } from "@/lib/types";

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
  <tr className="w-full">
    <td className="border w-1/2 text-sm font-medium text-gray-700">{label}</td>
    <td className="border w-full">
      {input === "input" ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full"
        />
      ) : (
        <select
          className="w-full"
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
    </td>
  </tr>
);

export default function LeadPage() {
  const { leadId } = useParams();
  const { installerGroupId } = useInstallerGroup();
  const leadIdStr = Array.isArray(leadId) ? leadId[0] : leadId;

  // States
  const [loading, setLoading] = useState(true);
  const [hasEstimate, setHasEstimate] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [estimateId, setEstimateId] = useState("");

  // Input
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [personInfo, setPersonInfo] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [ownConsumtion, setOwnConsumtion] = useState(0);

  // Customer info
  const [voltage, setVoltage] = useState(230);
  const voltageOptions = [
    { label: "230V", value: 230 },
    { label: "400V", value: 400 },
  ];
  const [phase, setPhase] = useState(3);
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
  const [roofSlope, setRoofSlope] = useState("6-15");
  const roofSlopeOptions = [
    { label: "0-5°", value: "0-5" },
    { label: "6-15°", value: "6-15" },
    { label: "16-25°", value: "16-25" },
    { label: "26-35°", value: "26-35" },
    { label: "36-45°", value: "36-45" },
    { label: "46+°", value: "46+" },
  ];
  const [roofAge, setRoofAge] = useState(5);

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
  });

  const [activeRoute, setActiveRoute] = useState("Estimat");
  const routes = ["Aktivitet", "Merknader", "E-poster"];

  useEffect(() => {
    if (!leadIdStr || !installerGroupId) return;

    setLoading(true);

    Promise.all([
      getLead(leadIdStr).then((data) => {
        setEmail(data.email ?? "");
        setPersonInfo(data.person_info ?? "");
        setBirthDate(data.birth_date ?? "");
        setPhone(data.phone ?? "");
        setAddress(data.address ?? "");
        setOwnConsumtion(data.own_consumption || 0);
      }),
      getEstimate(leadIdStr).then((data) => {
        setEstimateId(data.id);
        if (data) {
          setSolarData(mapEstimateToSolarData(data));
          setHasEstimate(true);
        } else {
          setHasEstimate(false);
        }
      }),
      getRoofTypes().then((data) => {
        setRoofTypes(data ?? []);
      }),
    ])
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
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
  }, [solarData.selectedRoofType, roofTypes, solarData]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateLead(leadIdStr!, {
        person_info: personInfo,
        email,
        phone,
        address,
      });
      if (hasEstimate && estimateId && leadIdStr) {
        const mappedSolarData = mapSolarDataToEstimate(solarData, leadIdStr);
        await updateEstimate(estimateId, mappedSolarData);
      }
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
        setHasEstimate(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleToggleModal = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(!isModalOpen);
  };

  return (
    <div className="flex flex-row">
      {/* Contact information */}
      <section className="w-1/4 p-2 flex flex-col gap-6">
        <table className="w-full">
          <tbody>
            <Input
              label="E-postadresse"
              value={email}
              onChange={setEmail}
              placeholder="E-postadresse"
            />
            <Input
              label="Telefon"
              value={phone}
              onChange={setPhone}
              placeholder="Telefon"
            />
            <Input
              label="Personinfo"
              value={personInfo}
              onChange={setPersonInfo}
              placeholder="Personinfo"
            />
            <Input
              label="Fødselsdato"
              value={birthDate}
              onChange={setBirthDate}
              type="date"
              placeholder="Fødselsdato"
            />
            <Input
              label="Bedrift"
              value={company}
              onChange={setCompany}
              placeholder="Bedrift"
            />
            <Input
              label="Gateadresse"
              value={address}
              onChange={setAddress}
              placeholder="Gateadresse"
            />
            <Input
              label="Eget forbruk"
              value={ownConsumtion}
              onChange={(val) => setOwnConsumtion(Number(val))}
              type="number"
              placeholder="Eget forbruk"
            />
          </tbody>
        </table>
        <table className="w-full">
          <tbody>
            <Input
              label="Spenning (nett)"
              value={voltage}
              onChange={(val) => setVoltage(Number(val))}
              input="select"
              options={voltageOptions}
              placeholder="Spenning (nett)"
            />
            <Input
              label="Faser"
              value={phase}
              onChange={(val) => setPhase(Number(val))}
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
          </tbody>
        </table>
        <table className="w-full">
          <tbody>
            <Input
              label="Taktype"
              value={roofType}
              onChange={(val) =>
                setSolarData((prev) => ({ ...prev, selectedRoofType: val }))
              }
              input="select"
              options={roofTypes.map((r) => ({ label: r.name, value: r.name }))}
              placeholder="Taktype"
            />
            <Input
              label="Helning på tak"
              value={roofSlope}
              onChange={setRoofSlope}
              input="select"
              options={roofSlopeOptions}
              placeholder="Helning på tak"
            />
            <Input
              label="Alder på tak i år"
              value={roofAge}
              onChange={(val) => setRoofAge(Number(val))}
              type="number"
              placeholder="Alder på tak i år"
            />
          </tbody>
        </table>
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

        {activeRoute === "Estimat" && hasEstimate && (
          <div>
            <div className="flex gap-2">
              <button
                className="py-2 px-3 bg-slate-100"
                onClick={handleToggleModal}
                disabled={loading}
              >
                Åpne pvmap
              </button>
              <button
                className="py-2 px-3 bg-orange-300"
                onClick={handleUpdate}
                disabled={loading}
              >
                {loading ? "Lagrer..." : "Lagre"}
              </button>
            </div>
            <EstimateSection
              solarData={solarData}
              setSolarData={setSolarData}
            />
          </div>
        )}
      </section>
      <section className="w-1/4 p-2">
        <h1>Noe tekst osv</h1>
        <div className="flex gap-2">
          <button
            className="bg-[#FF8E4C] text-white rounded p-2 px-3 w-46"
            onClick={() => setActiveRoute("Estimat")}
          >
            {hasEstimate ? "Vis tilbud" : "Opprett nytt tilbud"}
          </button>
        </div>
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
