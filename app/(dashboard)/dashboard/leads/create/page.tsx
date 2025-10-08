"use client";

import SolarDataView, { SolarData } from "@/app/components/SolarDataView";
import { CLIENT_ROUTES } from "@/constants/routes";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { createEstimate, createLead } from "@/lib/api";

import { mapSolarDataToEstimate } from "@/lib/mappers";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

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

export default function CreateLead() {
  const { teamId } = useTeam();
  const { installerGroupId } = useInstallerGroup();

  // States
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Inputs
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) return toast.error("You must be logged in"), setLoading(false);
    if (!teamId) return toast.error("No team selected"), setLoading(false);
    if (!installerGroupId)
      return toast.error("No installergroup selected"), setLoading(false);

    try {
      const lead = await createLead({
        team_id: teamId,
        installer_group_id: installerGroupId,
        assigned_to: user.id,
        name,
        email,
        phone,
        address,
        status: "new",
        priority: "iron",
      });

      await createEstimate({
        ...mapSolarDataToEstimate(solarData, lead.id),
      });
      toast.success(
        <div>
          Lead &quot;<strong>{lead.name}</strong>&quot; created!{" "}
          <Link
            href={`${CLIENT_ROUTES.DASHBOARD}/leads/${lead.id}`}
            className="font-bold"
          >
            View
          </Link>
        </div>,
        { autoClose: 5000 }
      );
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    }

    setLoading(false);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "PVMAP_DATA") {
        const payload = event.data.payload;
        console.log("api:", payload);
        setSolarData(payload);
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
    <div>
      <button onClick={handleToggleModal} className="smallLightButton">
        Open PVMap
      </button>
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
      <form onSubmit={handleSubmit}>
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

        <SolarDataView solarData={solarData} setSolarData={setSolarData} />

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Lead"}
        </button>
      </form>
    </div>
  );
}
