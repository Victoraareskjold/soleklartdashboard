"use client";
import TeamMemberSelector from "@/app/components/cold-calling/TeamMemberSelector";
import LeadsTable from "@/app/components/LeadsTable";
import LoadingScreen from "@/app/components/LoadingScreen";
import { useAuth } from "@/context/AuthProvider";
import { useRoles } from "@/context/RoleProvider";
import { useTeam } from "@/context/TeamContext";
import { getTeam } from "@/lib/api";
import { Team } from "@/lib/types";
import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";

export default function LeadsPage() {
  const { teamId } = useTeam();
  const { user } = useAuth();
  const { userName } = useRoles();

  const [team, setTeam] = useState<Team>();
  const [leadOwner, setLeadOwner] = useState<string>("");
  const [leadCollector, setLeadCollector] = useState<string>("");
  const [taskDueDateFilter, setTaskDueDateFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!teamId) return;

    getTeam(teamId)
      .then(setTeam)
      .catch((err) => console.error("Failed to fetch team members:", err));
  }, [teamId]);

  if (!user) return <LoadingScreen />;

  return (
    <div className="sk-page">
      <div className="sk-page-header">
        <div>
          <p className="sk-eyebrow">Pipeline</p>
          <h1 className="sk-page-title mt-1">Avtaler</h1>
          <p className="sk-page-subtitle">
            Dra kortene mellom kolonnene for å oppdatere status.
          </p>
        </div>
      </div>

      <div className="sk-card mb-5 flex flex-wrap items-end gap-3 p-3">
        <div className="relative min-w-64 flex-1">
          <label className="sk-label">Søk</label>
          <SearchIcon
            size={15}
            className="pointer-events-none absolute bottom-2.5 left-3 text-gray-400"
          />
          <input
            type="text"
            placeholder="Søk etter navn, adresse, eller kontaktinfo..."
            className="sk-input pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-col">
          <label className="sk-label">Oppgave</label>
          <select
            className="sk-input w-44"
            value={taskDueDateFilter}
            onChange={(e) => setTaskDueDateFilter(e.target.value)}
          >
            <option value="">Alle oppgaver</option>
            <option value="overdue">Forfalt</option>
            <option value="today">I dag</option>
            <option value="this_week">Denne uken</option>
            <option value="next_week">Neste uke</option>
            <option value="this_month">Denne måneden</option>
            <option value="next_month">Neste måned</option>
            <option value="this_year">Dette året</option>
            <option value="next_year">Neste år</option>
            <option value="none">Ingen oppgave</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="sk-label">Avtaleeier</label>
          <TeamMemberSelector
            team={team}
            selectedMember={leadCollector}
            onSelectMember={setLeadCollector}
            defaultUser={""}
            firstOption="Avtaleeier"
          />
        </div>

        <div className="flex flex-col">
          <label className="sk-label">Lead-innhenter</label>
          <TeamMemberSelector
            team={team}
            selectedMember={leadOwner}
            onSelectMember={setLeadOwner}
            defaultUser={
              userName === "Driv"
                ? "1fa66993-1595-413f-94b6-e35a3a1e4560"
                : userName === "Elliot Havik"
                  ? "21cc0443-4e44-4f4e-ab72-e5c47313a675"
                  : ""
            }
            disabled={userName === "Driv" || userName === "Elliot Havik"}
          />
        </div>
      </div>

      <LeadsTable
        leadOwner={leadOwner}
        leadCollector={leadCollector}
        taskDueDateFilter={taskDueDateFilter}
        searchQuery={searchQuery}
      />
    </div>
  );
}
