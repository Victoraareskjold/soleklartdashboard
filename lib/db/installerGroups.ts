import { SupabaseClient } from "@supabase/supabase-js";

export async function getInstallerGroups(
  client: SupabaseClient,
  teamId: string
) {
  const { data: installerGroups, error } = await client
    .from("installer_groups")
    .select("*")
    .eq("team_id", teamId);
  if (error) throw error;

  return installerGroups;
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

  return { ...group };
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
