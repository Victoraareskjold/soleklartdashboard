"use client";

import { useEffect, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { InstallerGroup } from "@/lib/types";
import { getInstallerGroups } from "@/lib/api";
import TeamSelector from "./TeamSelector";

interface InstallerGroupSelectorProps {
  selectedInstallerGroup?: string;
  setSelectedInstallerGroup?: (id: string) => void;
}

export default function InstallerGroupSelector({
  selectedInstallerGroup,
  setSelectedInstallerGroup,
}: InstallerGroupSelectorProps) {
  const { teamId } = useTeam();
  const [groups, setGroups] = useState<InstallerGroup[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    if (!teamId) return;

    getInstallerGroups(teamId)
      .then((fetched) => {
        setGroups(fetched);
        if (!selected && fetched.length > 0) {
          const firstId = fetched[0].id;
          setSelected(firstId);
          setSelectedInstallerGroup?.(firstId);
        }
      })
      .catch(console.error);
  }, [teamId, selected, setSelectedInstallerGroup]);

  useEffect(() => {
    if (selectedInstallerGroup) {
      setSelected(selectedInstallerGroup);
    }
  }, [selectedInstallerGroup]);

  if (!teamId) {
    return <TeamSelector />;
  }

  return (
    <select
      value={selected}
      onChange={(e) => {
        setSelected(e.target.value);
        setSelectedInstallerGroup?.(e.target.value);
      }}
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
