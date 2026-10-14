"use client";
import { useTeam } from "@/context/TeamContext";
import { getInstallerGroups, getTeam } from "@/lib/api";
import { InstallerGroup, Team } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
import { useRoles } from "@/context/RoleProvider";
import { Link2, Loader2, Users } from "lucide-react";
import { toast } from "react-toastify";

const initials = (name?: string | null) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
};

const roleBadgeClass = (role?: string | null) => {
  switch (role) {
    case "admin":
      return "sk-badge sk-badge-brand";
    case "installer":
      return "sk-badge sk-badge-warning";
    case "member":
    case "viewer":
    default:
      return "sk-badge sk-badge-neutral";
  }
};

function Avatar({
  name,
  tone = "brand",
}: {
  name?: string | null;
  tone?: "brand" | "accent";
}) {
  const toneClass =
    tone === "brand"
      ? "bg-gradient-to-br from-blue-500 to-blue-700 text-white"
      : "bg-gradient-to-br from-orange-300 to-orange-500 text-ink";
  return (
    <span
      className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] ${toneClass}`}
    >
      {initials(name)}
    </span>
  );
}

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
    return (
      <div className="sk-page">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  const coreMembers =
    teamData.members?.filter(
      (m) => m.role === "admin" || m.role === "member",
    ) ?? [];

  return (
    <div className="sk-page">
      <div className="sk-page-header">
        <div>
          <p className="sk-eyebrow">Team</p>
          <h1 className="sk-page-title">{teamData.name}</h1>
        </div>
      </div>

      <section className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="sk-section-title">Medlemmer</h2>
          <span className="sk-badge sk-badge-neutral tabular-nums">
            {coreMembers.length}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {coreMembers.map((member) => (
            <div
              key={member.user_id}
              className="sk-card flex items-center gap-3 p-4 transition-shadow hover:shadow-pop"
            >
              <Avatar name={member.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {member.name || "Ingen navn"}
                </p>
                <span className={`${roleBadgeClass(member.role)} mt-1 capitalize`}>
                  {member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="sk-section-title">
            {teamRole === "installer"
              ? "Min Installatørgruppe"
              : "Installatørgrupper"}
          </h2>
          <span className="sk-badge sk-badge-neutral tabular-nums">
            {visibleGroups.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {/* Vi mapper over visibleGroups i stedet for installerGroups */}
          {visibleGroups.map((group) => {
            const members = membersByInstallerGroup[group.id] || [];

            return (
              <div key={group.id} className="sk-card flex flex-col">
                <div className="sk-card-header">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Users size={15} />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">
                        {group.name}
                      </h3>
                      <p className="text-xs text-muted tabular-nums">
                        {members.length}{" "}
                        {members.length === 1 ? "medlem" : "medlemmer"}
                      </p>
                    </div>
                  </div>
                  {(teamRole === "admin" || teamRole === "installer") && (
                    <button
                      type="button"
                      onClick={() => copyId(group.id, group.name)}
                      className="sk-btn sk-btn-secondary sk-btn-sm"
                      title="Kopier invitasjonslenke"
                    >
                      <Link2 size={14} />
                      Kopier lenke
                    </button>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-1 p-2">
                  {members.length === 0 ? (
                    <p className="px-3 py-4 text-center text-sm text-muted">
                      Ingen medlemmer
                    </p>
                  ) : (
                    members.map((member) => (
                      <div
                        key={member.user_id}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50"
                      >
                        <Avatar name={member.name} tone="accent" />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                          {member.name || "Ingen navn"}
                        </p>
                        <span
                          className={`${roleBadgeClass(member.role)} capitalize`}
                        >
                          {member.role}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
