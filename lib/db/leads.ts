import { SupabaseClient } from "@supabase/supabase-js";

export async function getLeads(
  client: SupabaseClient,
  teamId: string,
  installerGroupId: string
) {
  const { data, error } = await client
    .from("leads")
    .select("*")
    .eq("team_id", teamId)
    .eq("installer_group_id", installerGroupId);

  if (error) throw error;
  return data;
}

export async function createLead(
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
