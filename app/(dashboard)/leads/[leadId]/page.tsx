"use client";
import { SolarData } from "@/app/components/SolarDataView";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { getEstimate, getLead, updateEstimate, updateLead } from "@/lib/api";
import { mapEstimateToSolarData, mapSolarDataToEstimate } from "@/lib/mappers";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import LeadNotesSection from "@/app/components/leads/LeadNotesSection";
import LeadEmailSection from "@/app/components/leads/LeadEmailSection";
import EstimateSection from "@/app/components/leads/EstimateSection";
import FacilityInfo from "@/app/components/price-calculator/result/FacilityInfo";

interface InputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void; // always string
  type?: "text" | "number" | "date" | "email";
  placeholder?: string;
}

const Input = ({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: InputProps) => (
  <div className="mb-3">
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  </div>
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
  const [phone, setPhone] = useState(0);
  const [personInfo, setPersonInfo] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [ownConsumtion, setOwnConsumtion] = useState(0);

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
        setPersonInfo(data.personInfo ?? "");
        setBirthDate(data.birthDate ?? "");
        setPhone(data.phone || 0);
        setAddress(data.address ?? "");
        setOwnConsumtion(data.ownConsumption || 0);
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
    ])
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [leadIdStr, installerGroupId]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateLead(leadIdStr!, {
        personInfo,
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
      <section className="w-1/4 p-2">
        <form>
          <Input
            label="E-postadresse"
            value={email}
            onChange={setEmail}
            placeholder="E-postadresse"
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
        </form>
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
          <div className="flex gap-2">
            <FacilityInfo />
            <div>
              <EstimateSection
                solarData={solarData}
                setSolarData={setSolarData}
              />
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
            </div>
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
