"use client";
import { useAuth } from "@/context/AuthProvider";
import { addUserToInstallerGroupOrTeam } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

export default function OnboardingPage() {
  const { user } = useAuth();

  const router = useRouter();

  const [activeSelection, setActiveSelection] = useState("teams");
  const [code, setCode] = useState("");

  const handleAddUser = async () => {
    if (!user) {
      toast.error("Mangler bruker!");
      return;
    }
    const res = await addUserToInstallerGroupOrTeam(
      activeSelection,
      user.id,
      code
    );
    toast.success(`Lagt til i ${res}`);
    router.push("/overview");
    return;
  };

  return (
    <div>
      <h1>Onboarding</h1>
      <div>
        <div className="flex gap-2">
          <button
            className={`${
              activeSelection === "teams" ? "bg-blue-200" : "bg-slate-100"
            } px-3 py-1 rounded-md`}
            onClick={() => setActiveSelection("teams")}
          >
            Team
          </button>
          <button
            className={`${
              activeSelection === "installerGroups"
                ? "bg-blue-200"
                : "bg-slate-100"
            } px-3 py-1 rounded-md`}
            onClick={() => setActiveSelection("installerGroups")}
          >
            Installatørgruppe
          </button>
        </div>
        <h2>Skriv inn id du har mottat.</h2>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="bg-slate-100"
          type="text"
        />
        <button onClick={handleAddUser}>Legg til</button>
      </div>
    </div>
  );
}
