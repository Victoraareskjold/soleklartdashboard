"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { createTeam } from "@/lib/db/teams";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { CLIENT_ROUTES } from "@/constants/routes";

export default function OnboardingPage() {
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      toast.error("You must be logged in");
      setLoading(false);
      return;
    }

    try {
      const team = await createTeam(supabase, user.id, teamName);
      toast.success(`Team "${team.name}" created!`);
      setTeamName("");
      router.push(CLIENT_ROUTES.DASHBOARD);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    }

    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-4">
      <h1 className="text-xl font-bold mb-4">Onboarding</h1>
      <form onSubmit={handleSubmit}>
        <label className="block mb-2">
          Team Name
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="border p-2 w-full mt-1"
            required
          />
        </label>
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 mt-2"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Team"}
        </button>
      </form>
    </div>
  );
}
