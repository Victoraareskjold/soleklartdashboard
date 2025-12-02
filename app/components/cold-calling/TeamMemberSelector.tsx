"use client";
import { useEffect, useMemo } from "react";

type TeamMember = {
  user_id: string;
  name: string;
  role: string;
};

type Team = {
  members?: TeamMember[];
};

type Props = {
  team?: Team;
  selectedMember: string;
  onSelectMember: (userId: string) => void;
  defaultUser?: string;
};

export default function TeamMemberSelector({
  team,
  selectedMember,
  onSelectMember,
  defaultUser,
}: Props) {
  const teamMembers = useMemo(() => {
    return (
      team?.members?.filter(
        (member) => member.role === "admin" || member.role === "member"
      ) || []
    );
  }, [team?.members]);

  // ✅ Sett defaultUser som valgt når team er lastet og ingen er valgt
  useEffect(() => {
    if (defaultUser && teamMembers.length > 0 && !selectedMember) {
      const isUserInTeam = teamMembers.some(
        (member) => member.user_id === defaultUser
      );
      if (isUserInTeam) {
        onSelectMember(defaultUser);
      }
    }
  }, [defaultUser, teamMembers, selectedMember, onSelectMember]);

  return (
    <select
      value={selectedMember}
      onChange={(e) => onSelectMember(e.target.value)}
      className="border p-2 my-2 rounded-md"
    >
      <option value="">Velg teammedlem</option>
      {teamMembers.map((member) => (
        <option key={member.user_id} value={member.user_id}>
          {member.name}
        </option>
      ))}
    </select>
  );
}
