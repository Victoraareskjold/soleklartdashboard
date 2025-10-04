import { SupabaseClient } from "@supabase/supabase-js";

export async function getInstallerGroups(
  client: SupabaseClient,
  teamId: string
) {
  const { data: groups, error } = await client
    .from("installer_groups")
    .select("*")
    .eq("team_id", teamId);
  if (error) throw error;

  const groupsWithMembers = await Promise.all(
    groups.map(async (group) => {
      const { data: members, error: membersError } = await client
        .from("installer_group_members")
        .select("user_id, role")
        .eq("installer_group_id", group.id);
      if (membersError) throw membersError;
      return { ...group, members };
    })
  );

  return groupsWithMembers;
}

export async function getInstallerGroup(
  client: SupabaseClient,
  groupId: string
) {
  const { data: group, error } = await client
    .from("installer_groups")
    .select("*")
    .eq("id", groupId)
    .single();
  if (error) throw error;

  const { data: members, error: membersError } = await client
    .from("installer_group_members")
    .select("user_id, role")
    .eq("installer_group_id", groupId);
  if (membersError) throw membersError;

  return { ...group, members };
}

export async function createInstallerGroup(
  client: SupabaseClient,
  teamId: string,
  name: string,
  managerId?: string
) {
  const { data: group, error } = await client
    .from("installer_groups")
    .insert({ team_id: teamId, name, manager_id: managerId || null })
    .select()
    .single();
  if (error) throw error;
  return group;
}
