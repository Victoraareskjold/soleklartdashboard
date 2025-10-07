"use client";
import LoadingScreen from "@/app/components/LoadingScreen";
import SolarDataView, { SolarData } from "@/app/components/SolarDataView";
import { getEstimate, getLead } from "@/lib/api";
import { mapEstimateToSolarData } from "@/lib/mappers";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
  const leadIdStr = Array.isArray(leadId) ? leadId[0] : leadId;

  // States
  const [loading, setLoading] = useState(true);
  const [hasEstimate, setHasEstimate] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  useEffect(() => {
    if (!leadIdStr) return;

    setLoading(true);

    Promise.all([
      getLead(leadIdStr).then((data) => {
        setName(data.name ?? "");
        setEmail(data.email ?? "");
        setPhone(data.phone ?? "");
        setAddress(data.address ?? "");
      }),
      getEstimate(leadIdStr).then((data) => {
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
  }, [leadIdStr]);

  const handleUpdateLead = () => {};

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PVMAP_DATA") {
        const payload = event.data.payload;
        console.log("api:", payload);
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
    <div>
      {isModalOpen && (
        <section className="flex h-full absolute inset-0 overflow-none">
          <>
            <div
              className="flex h-full w-full absolute bg-black opacity-25"
              onClick={handleToggleModal}
            ></div>
            <iframe
              src="https://pvmap.vercel.app/?site=solarinstallationdashboard"
              className="h-5/6 w-5/6 relative z-50 m-auto rounded-xl"
            />
          </>
        </section>
      )}
      <form>
        <Input
          label="Name"
          value={name}
          onChange={setName}
          placeholder="Lead name"
        />
        <Input
          label="Email"
          value={email}
          onChange={setEmail}
          type="email"
          placeholder="Lead email"
        />
        <Input
          label="Phone"
          value={phone}
          onChange={setPhone}
          placeholder="Lead phone"
        />
        <Input
          label="Address"
          value={address}
          onChange={setAddress}
          placeholder="Lead address"
        />
        {hasEstimate && (
          <SolarDataView solarData={solarData} setSolarData={setSolarData} />
        )}
        <div className="flex gap-2">
          {!hasEstimate && (
            <button onClick={handleToggleModal}>Opprett estimat</button>
          )}
          <button onClick={handleUpdateLead} disabled={loading}>
            {loading ? "Lagrer..." : "Lagre"}
          </button>
        </div>
      </form>
    </div>
  );
}
