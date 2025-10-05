"use client";

import { useEffect, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { InstallerGroup } from "@/lib/types";
import { getInstallerGroups } from "@/lib/api";
import TeamSelector from "./TeamSelector";

export default function InstallerGroupSelector() {
  const { teamId } = useTeam();
  const { installerGroupId, setInstallerGroupId } = useInstallerGroup();
  const [groups, setGroups] = useState<InstallerGroup[]>([]);

  useEffect(() => {
    if (!teamId) return;

    getInstallerGroups(teamId)
      .then((fetched) => {
        setGroups(fetched);
        if (!installerGroupId && fetched.length > 0) {
          setInstallerGroupId(fetched[0].id);
        }
      })
      .catch(console.error);
  }, [teamId, installerGroupId, setInstallerGroupId]);

  if (!teamId) return <TeamSelector />;

  return (
    <select
      value={installerGroupId ?? ""}
      onChange={(e) => setInstallerGroupId(e.target.value)}
      className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
    >
      <option value="" disabled>
        Select group
      </option>
      {groups.map((group) => {
        const cleanDomain = group.name
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/\.[a-z]{2,}$/, "");
        return (
          <option key={group.id} value={group.id}>
            {cleanDomain}
          </option>
        );
      })}
    </select>
  );
}
