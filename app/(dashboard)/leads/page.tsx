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
  const [leadOwner, setLeadOwner] = useState<string>("");
  const [leadCollector, setLeadCollector] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

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
        <h1 className="font-semibold text-lg">Avtaler</h1>
        <div className="mt-2 flex flex-row items-center gap-4">
          {/* TODO Koble til getLeads å faktisk funke */}
          <div className="flex flex-col">
            <p>Avtaleeier</p>
            <TeamMemberSelector
              team={team}
              selectedMember={leadCollector}
              onSelectMember={setLeadCollector}
              defaultUser={user.id}
              firstOption="Avtaleeier"
            />
          </div>

          <div className="flex flex-col">
            <p>Lead-innhenter</p>
            <TeamMemberSelector
              team={team}
              selectedMember={leadOwner}
              onSelectMember={setLeadOwner}
              defaultUser={user.id}
            />
          </div>
        </div>
        <div className="flex flex-col mt-4">
          <input
            type="text"
            placeholder="Søk etter navn, adresse, eller kontaktinfo..."
            className="border p-2 rounded-md w-96"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <LeadsTable
        leadOwner={leadOwner}
        leadCollector={leadCollector}
        searchQuery={searchQuery}
      />
    </div>
  );
}
