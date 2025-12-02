"use client";
import { useTeam } from "@/context/TeamContext";
import { getInstallerGroups, getTeam } from "@/lib/api";
import { InstallerGroup, Team } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { useRoles } from "@/context/RoleProvider";
import { Copy } from "lucide-react";
import { toast } from "react-toastify";

export default function TeamPage() {
  const { teamId } = useTeam();
  const { teamRole, loading, installer_group_id } = useRoles();

  const [teamData, setTeamData] = useState<Team>();
  const [installerGroups, setInstallerGroups] = useState<InstallerGroup[]>([]);

  useEffect(() => {
    if (!teamId || !teamRole) return;

    getTeam(teamId).then(setTeamData);
    getInstallerGroups(teamId, installer_group_id, teamRole)
      .then(setInstallerGroups)
      .catch((err) => console.error("Failed to fetch installer groups:", err));
  }, [teamId, installer_group_id, teamRole]);

  const installers = useMemo(
    () =>
      teamData?.members?.filter(
        (member) => member.role === "installer" || member.role === "viewer"
      ),
    [teamData?.members]
  );

  const membersByInstallerGroup = useMemo(() => {
    if (!installers) return {};
    return installers.reduce<Record<string, typeof installers>>(
      (acc, member) => {
        const groupId = member.installer_group_id || "unknown";
        if (!acc[groupId]) acc[groupId] = [];
        acc[groupId].push(member);
        return acc;
      },
      {}
    );
  }, [installers]);

  if (!teamData) return null;

  const teamMembers = teamData.members?.filter(
    (member) => member.role === "admin" || member.role === "member"
  );

  const copyId = (groupId: string, groupName: string) => {
    navigator.clipboard.writeText(
      `www.soleklartdashboard.vercel.app/auth?inviteLink=${groupId}`
    );
    toast.success(`Link kopiert for ${groupName}!`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (teamRole !== "admin") {
    return <div>You do not have permission to view this page.</div>;
  }

  return (
    <div>
      <h1 className="text-lg mb-4">{teamData.name}</h1>
      <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
        {teamMembers?.map((member) => (
          <div
            key={member.user_id}
            className="flex flex-col gap-1 mb-2 bg-slate-100 p-2 rounded-md"
          >
            <p className="w-full">{member.name || "Ingen navn satt"}</p>
            <p className="opacity-60">
              {member.role.charAt(0).toUpperCase() + member.role.slice(1) ||
                "Ingen rolle satt"}
            </p>
          </div>
        ))}
      </div>

      <h1 className="text-lg mb-4">Installatørgrupper</h1>
      <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
        {installerGroups.map((group) => {
          const members = membersByInstallerGroup[group.id] || [];

          return (
            <div
              key={group.id}
              className="mb-2 w-full bg-slate-200 p-2 rounded-md shadow-lg"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-semibold mb-2">{group.name}</h2>
                <Copy
                  onClick={() => copyId(group.id, group.name)}
                  className="cursor-pointer"
                  size={16}
                />
              </div>

              <div className="flex flex-row gap-2 flex-wrap">
                {members.length === 0 && (
                  <p className="text-sm text-slate-500">Ingen medlemmer</p>
                )}

                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex flex-col gap-1 bg-white p-2 rounded-md w-full"
                  >
                    <p>{member.name || "Ingen navn satt"}</p>
                    <p className="opacity-60">
                      {member.role.charAt(0).toUpperCase() +
                        member.role.slice(1) || "Ingen rolle satt"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
