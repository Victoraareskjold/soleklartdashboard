"use client";
import LoadingScreen from "@/app/components/LoadingScreen";
import PriceCalculatorTable from "@/app/components/PriceCalculator/PriceCalculatorTable";
import SolarDataView, { SolarData } from "@/app/components/SolarDataView";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import {
  getEstimate,
  getLead,
  getPriceTable,
  updateEstimate,
  updateLead,
} from "@/lib/api";
import { mapEstimateToSolarData, mapSolarDataToEstimate } from "@/lib/mappers";
import { PriceTable } from "@/types/price";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import LeadNotesSection from "@/app/components/leads/LeadNotesSection";

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
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

  const [priceTable, setPriceTable] = useState<PriceTable | null>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [hasEstimate, setHasEstimate] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [estimateId, setEstimateId] = useState("");

  // Input
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

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

  const [activeRoute, setActiveRoute] = useState("Aktivitet");
  const routes = ["Aktivitet", "Merknader", "E-poster"];

  useEffect(() => {
    if (!leadIdStr || !installerGroupId) return;

    setLoading(true);

    Promise.all([
      getLead(leadIdStr).then((data) => {
        setName(data.name ?? "");
        setEmail(data.email ?? "");
        setPhone(data.phone ?? "");
        setAddress(data.address ?? "");
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
      getPriceTable(installerGroupId).then((data) => {
        setPriceTable(data);
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
        name,
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

  if (loading) return <LoadingScreen />;

  return (
    <div className="flex flex-row">
      {/* Contact information */}
      <section className="w-1/4 p-2">
        <form>
          <Input
            label="Navn"
            value={name}
            onChange={setName}
            placeholder="Navn"
          />
          <Input
            label="E-post"
            value={email}
            onChange={setEmail}
            type="email"
            placeholder="E-postaddresse"
          />
          <Input
            label="Telefon"
            value={phone}
            onChange={setPhone}
            placeholder="Telefonnummer"
          />
          <Input
            label="Addresse"
            value={address}
            onChange={setAddress}
            placeholder="Addresse"
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

        {activeRoute === "Estimat" && hasEstimate && (
          <>
            <SolarDataView solarData={solarData} setSolarData={setSolarData} />
            {priceTable && (
              <PriceCalculatorTable
                table={priceTable}
                items={priceTable.prices}
                totalPanels={solarData.totalPanels}
              />
            )}
            <button onClick={handleUpdate} disabled={loading}>
              {loading ? "Lagrer..." : "Lagre"}
            </button>
            <button onClick={handleToggleModal} disabled={loading}>
              Åpne
            </button>
          </>
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
