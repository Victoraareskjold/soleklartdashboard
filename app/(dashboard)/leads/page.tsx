"use client";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";
import LeadsTable from "@/app/components/LeadsTable";
import LoadingScreen from "@/app/components/LoadingScreen";
import { useAuth } from "@/context/AuthProvider";
import { useTeam } from "@/context/TeamContext";
import { getTeam } from "@/lib/api";
import { Team } from "@/lib/types";
import { useEffect, useState } from "react";

export default function LeadsPage() {
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
      <div className="p-4">
        <h1>Avtaler</h1>
        <div className="mt-2 flex flex-row items-center">
          {/* TODO Koble til getLeads å faktisk funke */}
          <TeamMemberSelector
            team={team}
            selectedMember={selectedMember}
            onSelectMember={setSelectedMember}
            defaultUser={user.id}
          />
        </div>
      </div>
      <LeadsTable selectedMember={selectedMember} />
    </div>
  );
}
