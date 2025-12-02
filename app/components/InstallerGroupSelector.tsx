"use client";
import { useEffect, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { InstallerGroup } from "@/lib/types";
import { getInstallerGroups } from "@/lib/api";
import TeamSelector from "./TeamSelector";
import { useRoles } from "@/context/RoleProvider";

export default function InstallerGroupSelector() {
  const { teamId } = useTeam();
  const { teamRole, installer_group_id } = useRoles();
  const { installerGroupId, setInstallerGroupId } = useInstallerGroup();

  const [groups, setGroups] = useState<InstallerGroup[]>([]);

  useEffect(() => {
    if (!teamId || !teamRole) return;
    getInstallerGroups(teamId, installer_group_id, teamRole)
      .then((fetched) => {
        setGroups(fetched);
        const localGroup = localStorage.getItem("installerGroupId");
        if (localGroup) {
          setInstallerGroupId(localGroup);
          return;
        }
        if (!installerGroupId && fetched.length > 0) {
          setInstallerGroupId(fetched[0].id);
        }
      })
      .catch(console.error);
  }, [
    teamId,
    installerGroupId,
    setInstallerGroupId,
    installer_group_id,
    teamRole,
  ]);

  const getInstallerGroupName = (groups: InstallerGroup[]) => {
    const group = groups.find((group) => group.id === installerGroupId);
    if (!group) return "";

    return group.name
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\.[a-z]{2,}$/, "");
  };

  const handleSetInstallerGroup = (group: string) => {
    setInstallerGroupId(group);
    localStorage.setItem("installerGroupId", group);
  };

  if (!teamId) return <TeamSelector />;
  if (!teamRole) return null;
  if (teamRole === "installer") {
    return <p className="text-xl px-2 py-1">{getInstallerGroupName(groups)}</p>;
  }

  return (
    <select
      value={installerGroupId ?? ""}
      onChange={(e) => handleSetInstallerGroup(e.target.value)}
      className="text-xl rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer w-full"
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
