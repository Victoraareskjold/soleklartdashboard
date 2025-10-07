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
        if (data) setSolarData(mapEstimateToSolarData(data));
      }),
    ])
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [leadIdStr]);

  const handleUpdateLead = () => {};

  if (loading) return <LoadingScreen />;

  return (
    <div>
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

        {solarData && (
          <SolarDataView solarData={solarData} setSolarData={setSolarData} />
        )}

        <button onClick={handleUpdateLead} disabled={loading}>
          {loading ? "Lagrer..." : "Lagre"}
        </button>
      </form>
    </div>
  );
}
