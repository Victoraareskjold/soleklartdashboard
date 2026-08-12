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

  const visibleGroups = useMemo(() => {
    if (teamRole === "installer") {
      // Hvis brukeren er installer, vis kun gruppen de tilhører
      return installerGroups.filter((group) => group.id === installer_group_id);
    }
    // Hvis brukeren er admin/member, vis alle grupper
    return installerGroups;
  }, [installerGroups, teamRole, installer_group_id]);

  const installers = useMemo(
    () =>
      teamData?.members?.filter(
        (member) => member.role === "installer" || member.role === "viewer",
      ),
    [teamData?.members],
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
      {},
    );
  }, [installers]);

  if (!teamData) return null;

  const copyId = (groupId: string, groupName: string) => {
    navigator.clipboard.writeText(
      `www.soleklart.com/auth?inviteLink=${groupId}`,
    );
    toast.success(`Link kopiert for ${groupName}!`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <>
        <h1 className="text-lg mb-4">{teamData.name}</h1>
        <div className="grid grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
          {teamData.members
            ?.filter((m) => m.role === "admin" || m.role === "member")
            .map((member) => (
              <div key={member.user_id} className="bg-slate-100 p-2 rounded-md">
                <p>{member.name || "Ingen navn"}</p>
                <p className="text-xs opacity-60 capitalize">{member.role}</p>
              </div>
            ))}
        </div>
      </>

      <h1 className="text-lg mb-4">
        {teamRole === "installer"
          ? "Min Installatørgruppe"
          : "Installatørgrupper"}
      </h1>

      <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
        {/* Vi mapper over visibleGroups i stedet for installerGroups */}
        {visibleGroups.map((group) => {
          const members = membersByInstallerGroup[group.id] || [];

          return (
            <div
              key={group.id}
              className="mb-2 w-full bg-slate-200 p-2 rounded-md shadow-lg"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-semibold mb-2">{group.name}</h2>
                {(teamRole === "admin" || teamRole === "installer") && (
                  <Copy
                    onClick={() => copyId(group.id, group.name)}
                    className="cursor-pointer hover:text-blue-500"
                    size={16}
                  />
                )}
              </div>

              <div className="flex flex-row gap-2 flex-wrap">
                {members.length === 0 ? (
                  <p className="text-sm text-slate-500">Ingen medlemmer</p>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.user_id}
                      className="bg-white p-2 rounded-md w-full text-sm"
                    >
                      <p>{member.name || "Ingen navn"}</p>
                      <p className="opacity-60 text-xs capitalize">
                        {member.role}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
