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
      <h1 className="text-lg mb-4">{teamData.name}</h1>
      <div>
        <p>Team members</p>
        {teamData.members?.map((member) => (
          <div
            key={member.user_id}
            className="flex flex-col gap-1 mb-2 bg-slate-100 p-2 rounded-md"
          >
            <p className="w-full">{member.name || "Ingen navn satt"}</p>
            <p>{member.role || "Ingen rolle satt"}</p>
            <p>{member.user_id || "Ingen id"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
