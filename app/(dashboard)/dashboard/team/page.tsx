"use client";
import { useTeam } from "@/context/TeamContext";
import { getTeam } from "@/lib/api";
import { Team } from "@/lib/types";
import { useEffect, useState } from "react";

export default function TeamPage() {
  const { teamId } = useTeam();
  const [teamData, setTeamData] = useState<Team>();

  useEffect(() => {
    if (!teamId) return;

    getTeam(teamId)
      .then(setTeamData)
      .catch((err) => console.error("Failed to fetch teams:", err));
  }, [teamId]);

  if (!teamData) return null;

  return (
    <div>
      <h1>{teamData.name}</h1>
      <p>{teamData.id}</p>
      <div>
        <p>Team member</p>
        {teamData.members?.map((member) => (
          <div
            key={member.id + member.name}
            className="flex flex-row gap-2 bg-slate-100"
          >
            <p>{member.role || "Ukjent"}</p>
            <p>{member.name || "Ukjent"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
