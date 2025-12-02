"use client";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";
import LoadingScreen from "@/app/components/LoadingScreen";
import { CLIENT_ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthProvider";
import { useTeam } from "@/context/TeamContext";
import { getTeam } from "@/lib/api";
import { Team } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ColdCallingPage() {
  const { teamId } = useTeam();
  const { user } = useAuth();

  const [team, setTeam] = useState<Team>();
  const [selectedMember, setSelectedMember] = useState<string>("");

  useEffect(() => {
    if (!teamId) return;

    getTeam(teamId)
      .then(setTeam)
      .catch((err) => console.error("Failed to fetch team members:", err));
  }, [teamId]);

  if (!user) return <LoadingScreen />;

  return (
    <div>
      <div className="flex flex-row justify-between">
        <div>
          <h1>Cold Calling</h1>

          <div className="flex flex-row gap-2">
            <TeamMemberSelector
              team={team}
              selectedMember={selectedMember}
              onSelectMember={setSelectedMember}
              defaultUser={user.id}
            />

            <select>
              <option>Ringeliste</option>
            </select>
          </div>

          <input type="text" placeholder="Søk etter navn eller beskrivelse" />
        </div>

        <div className="w-128 h-32 bg-red-500"></div>

        <div className="flex flex-col gap-2">
          <Link href={CLIENT_ROUTES.COLD_CALLING + "/import"}>Importer</Link>
          <button>Flytt</button>
        </div>
      </div>
    </div>
  );
}
