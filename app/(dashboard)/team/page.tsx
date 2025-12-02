"use client";
import { useTeam } from "@/context/TeamContext";
import { getInstallerGroup, getTeam } from "@/lib/api";
import { Team } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { useRoles } from "@/context/RoleProvider";
import { Copy } from "lucide-react";

export default function TeamPage() {
  const { teamId } = useTeam();
  const { teamRole, loading } = useRoles();

  const [teamData, setTeamData] = useState<Team>();
  const [installerGroupNames, setInstallerGroupNames] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!teamId) return;

    getTeam(teamId)
      .then(setTeamData)
      .catch((err) => console.error("Failed to fetch teams:", err));
  }, [teamId]);

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

  const groupIds = useMemo(
    () => Object.keys(membersByInstallerGroup),
    [membersByInstallerGroup]
  );

  useEffect(() => {
    const fetchNames = async () => {
      const groupIdsToFetch = groupIds.filter(
        (groupId) => !installerGroupNames[groupId] && groupId !== "unknown"
      );

      if (groupIdsToFetch.length === 0) return;

      const entries = await Promise.all(
        groupIdsToFetch.map(async (groupId) => {
          try {
            const group = await getInstallerGroup(groupId);
            return [groupId, group.name] as [string, string];
          } catch (err) {
            console.error(`Failed to fetch installer group ${groupId}:`, err);
            return [groupId, "Ukjent gruppe"];
          }
        })
      );
      setInstallerGroupNames((prev) => ({
        ...prev,
        ...Object.fromEntries(entries),
      }));
    };

    if (groupIds.length > 0) {
      fetchNames();
    }
  }, [groupIds, installerGroupNames]);

  if (!teamData) return null;

  const teamMembers = teamData.members?.filter(
    (member) => member.role === "admin" || member.role === "member"
  );

  const copyId = (groupId: string) => {
    navigator.clipboard.writeText(
      `www.soleklartdashboard.vercel.app/auth?inviteLink=${groupId}`
    );
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
      <div className="flex flex-row gap-2">
        {teamMembers?.map((member) => (
          <div
            key={member.user_id}
            className="flex flex-col gap-1 mb-2 bg-slate-100 p-2 rounded-md w-64"
          >
            <p className="w-full">{member.name || "Ingen navn satt"}</p>
            <p>{member.role || "Ingen rolle satt"}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-row gap-2">
        {Object.entries(membersByInstallerGroup).map(([groupId, members]) => (
          <div key={groupId} className="mb-6">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold mb-2">
                {installerGroupNames[groupId] || "Laster..."}
              </h2>
              <Copy
                onClick={() => copyId(groupId)}
                className="cursor-pointer"
                size={16}
              />
            </div>

            <div className="flex flex-row gap-2 flex-wrap">
              {members?.map((member) => (
                <div
                  key={member.user_id}
                  className="flex flex-col gap-1 bg-slate-100 p-2 rounded-md w-64"
                >
                  <p>{member.name || "Ingen navn satt"}</p>
                  <p>{member.role || "Ingen rolle satt"}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
