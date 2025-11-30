import { SupabaseClient } from "@supabase/supabase-js";
import { TeamMember } from "../types";

export async function getTeamsForUser(client: SupabaseClient, userId: string) {
  const { data: memberships, error } = await client
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", userId);
  if (error) throw error;

  const teamIds = memberships.map((m) => m.team_id);

  const { data: teams, error: teamsError } = await client
    .from("teams")
    .select("*")
    .in("id", teamIds);
  if (teamsError) throw teamsError;

  return teams.map((team) => {
    const membership = memberships.find((m) => m.team_id === team.id);
    return { ...team, role: membership?.role };
  });
}

export async function getTeam(client: SupabaseClient, teamId: string) {
  const { data: team, error } = await client
    .from("teams")
    .select("*")
    .eq("id", teamId)
    .single();
  if (error) throw error;

  const { data: members, error: membersError } = await client
    .from("team_members")
    .select("user_id, role, installer_group_id, users(name)")
    .eq("team_id", teamId);
  if (membersError) throw membersError;

  const formattedMembers: TeamMember[] = (members ?? []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    name: (m.users as unknown as { name: string } | null)?.name ?? "Ukjent",
    installer_group_id: m.installer_group_id,
  }));

  return { ...team, members: formattedMembers };
}

export async function createTeam(
  client: SupabaseClient,
  userId: string,
  name: string
) {
  const { data: team, error: teamError } = await client
    .from("teams")
    .insert({ name, leader_id: userId })
    .select()
    .single();
  if (teamError) throw teamError;

  const { error: memberError } = await client
    .from("team_members")
    .insert({ team_id: team.id, user_id: userId, role: "admin" });
  if (memberError) throw memberError;

  return team;
}
