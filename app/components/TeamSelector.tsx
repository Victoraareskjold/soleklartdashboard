"use client";

import { useRoles } from "@/context/RoleProvider";
import { useTeam } from "@/context/TeamContext";
import { getTeams } from "@/lib/api";
import { Team } from "@/lib/types";
import { useEffect, useState } from "react";

export default function TeamSelector() {
  const { teamId, setTeamId } = useTeam();
  const { teamRole } = useRoles();
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    getTeams()
      .then(setTeams)
      .catch((err) => console.error("Failed to fetch teams:", err));
  }, []);

  if (!teamRole) return null;

  if (teamId || teamRole === "installer") return null;

  return (
    <select
      onChange={(e) => setTeamId(e.target.value)}
      className="h-8 w-full border border-line px-2 text-sm"
      defaultValue=""
    >
      <option value="" disabled>
        Choose team...
      </option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  );
}
