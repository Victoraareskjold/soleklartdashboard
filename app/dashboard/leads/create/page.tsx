"use client";

import LoadingScreen from "@/app/components/LoadingScreen";
import SolarDataView, { SolarData } from "@/app/components/SolarDataView";
import { CLIENT_ROUTES } from "@/constants/routes";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { createLead } from "@/lib/api";

import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Map as MapIcon, UserPlus, X } from "lucide-react";

interface InputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
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
  <div>
    <label className="sk-label">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="sk-input"
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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [personInfo, setPersonInfo] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [company, setCompany] = useState("");
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

    if (!user) return (toast.error("You must be logged in"), setLoading(false));
    if (!teamId) return (toast.error("No team selected"), setLoading(false));
    if (!installerGroupId)
      return (toast.error("No installergroup selected"), setLoading(false));

    try {
      const lead = await createLead({
        team_id: teamId,
        installer_group_id: installerGroupId,
        assigned_to: user.id,
        person_info: personInfo,
        email,
        phone,
        address,
        status: 7,
        priority: "iron",
        lead_source: "coldcall",
      });
      toast.success(
        <div>
          Lead &quot;<strong>{lead.person_info}</strong>&quot; created!{" "}
          <Link
            href={`${CLIENT_ROUTES.LEADS}/${lead.id}`}
            className="font-bold"
          >
            View
          </Link>
        </div>,
        { autoClose: 5000 },
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

  if (loading) return <LoadingScreen />;

  return (
    <div className="sk-page">
      <div className="sk-page-header">
        <div>
          <p className="sk-eyebrow">Leads</p>
          <h1 className="sk-page-title">Create Lead</h1>
        </div>
        <button
          onClick={handleToggleModal}
          className="sk-btn sk-btn-secondary"
        >
          <MapIcon size={16} />
          Open PVMap
        </button>
      </div>
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
                src="https://pvmap.vercel.app/?site=solarinstallationdashboard&aerial=0"
                className="h-full w-full"
              />
            </div>
          </>
        </section>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="sk-card">
          <div className="sk-card-header">
            <h2 className="sk-section-title">Kontaktinformasjon</h2>
          </div>
          <div className="sk-card-body grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          </div>
        </div>

        <div className="sk-card">
          <div className="sk-card-header">
            <h2 className="sk-section-title">Soldata</h2>
          </div>
          <div className="sk-card-body">
            <SolarDataView solarData={solarData} setSolarData={setSolarData} />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="sk-btn sk-btn-primary sk-btn-lg"
          >
            <UserPlus size={16} />
            {loading ? "Creating..." : "Create Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}
