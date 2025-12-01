"use client";
import { useTeam } from "@/context/TeamContext";
import { getInstallerGroup, getTeam, addUserToTeam } from "@/lib/api";
import { Team } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { useRoles } from "@/context/RoleProvider";

export default function TeamPage() {
  const { teamId } = useTeam();
  const { teamRole, loading } = useRoles();

  const [teamData, setTeamData] = useState<Team>();
  const [installerGroupNames, setInstallerGroupNames] = useState<
    Record<string, string>
  >({});

  const [modalGroupId, setModalGroupId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "installer",
  });

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

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modalGroupId || !teamId) return;

    try {
      await addUserToTeam({
        name: formData.name,
        email: formData.email,
        role: formData.role,
        team_id: teamId,
        installer_group_id: modalGroupId,
      });

      // Refresh data
      getTeam(teamId).then(setTeamData);
      setModalGroupId(null);
      setFormData({ name: "", email: "", role: "installer" });
    } catch (error) {
      console.error("Failed to add member:", error);
    }
  };

  if (!teamData) return null;

  const teamMembers = teamData.members?.filter(
    (member) => member.role === "admin" || member.role === "member"
  );

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
            <h2 className="font-semibold mb-2">
              {installerGroupNames[groupId] || "Laster..."}
            </h2>

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
            <button onClick={() => setModalGroupId(groupId)}>
              Legg til medlem
            </button>
          </div>
        ))}
      </div>
      <>
        {modalGroupId && (
          <div
            className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
            onClick={() => setModalGroupId(null)}
          >
            <div
              className="bg-white rounded-lg p-6 w-[500px] max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-2">Legg til medlem</h2>

              <form onSubmit={handleAddMember}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Navn</label>
                  <input
                    type="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full border rounded p-2"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    E-post
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full border rounded p-2"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Rolle
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="w-full border rounded p-2"
                  >
                    <option value="installer">Installør</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalGroupId(null)}
                    className="px-4 py-2 border rounded hover:bg-gray-100"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                  >
                    Legg til
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    </div>
  );
}
