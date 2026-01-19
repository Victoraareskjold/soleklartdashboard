"use client";
import { useEffect, useMemo } from "react";

type TeamMember = {
  user_id: string;
  name: string;
  role: string;
  installer_group_id?: string | null;
};

type Team = {
  members?: TeamMember[];
};

type Props = {
  team?: Team;
  selectedMember: string;
  onSelectMember: (userId: string) => void;
  defaultUser?: string;
  firstOption?: string;
  includeInstallers?: boolean;
  installerGroupId?: string | null;
};

export default function TeamMemberSelector({
  team,
  selectedMember,
  onSelectMember,
  defaultUser,
  firstOption = "Lead-innhenter",
  includeInstallers = false,
  installerGroupId = null,
}: Props) {
  const { teamMembers, installers } = useMemo(() => {
    const members = team?.members || [];

    const teamMembers = members.filter(
      (member) => member.role === "admin" || member.role === "member",
    );

    let installers: TeamMember[] = [];
    if (includeInstallers && installerGroupId) {
      installers = members.filter((member) => {
        return (
          member.role === "installer" &&
          member.installer_group_id === installerGroupId
        );
      });
    }

    return { teamMembers, installers };
  }, [team?.members, includeInstallers, installerGroupId]);

  useEffect(() => {
    const allSelectableMembers = [...teamMembers, ...installers];
    if (defaultUser && allSelectableMembers.length > 0 && !selectedMember) {
      const isUserInList = allSelectableMembers.some(
        (member) => member.user_id === defaultUser,
      );
      if (isUserInList) {
        onSelectMember(defaultUser);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultUser, teamMembers, installers, onSelectMember]);

  return (
    <select
      value={selectedMember}
      onChange={(e) => onSelectMember(e.target.value)}
      className="border p-2 rounded-md bg-gray-50"
    >
      <option value="">{firstOption}</option>
      {includeInstallers && installers.length > 0 ? (
        <>
          <optgroup label="Team">
            {teamMembers.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Installatører">
            {installers.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.name}
              </option>
            ))}
          </optgroup>
        </>
      ) : (
        teamMembers.map((member) => (
          <option key={member.user_id} value={member.user_id}>
            {member.name}
          </option>
        ))
      )}
    </select>
  );
}
