"use client";

import { useTeam } from "@/context/TeamContext";
import { getTeams } from "@/lib/api";
import { Team } from "@/lib/types";
import { useEffect, useState } from "react";

export default function TeamSelector() {
  const { teamId, setTeamId } = useTeam();
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    getTeams()
      .then(setTeams)
      .catch((err) => console.error("Failed to fetch teams:", err));
  }, []);

  if (teamId) return null;

  return (
    <select
      onChange={(e) => setTeamId(e.target.value)}
      className="bg-white border border-slate-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
