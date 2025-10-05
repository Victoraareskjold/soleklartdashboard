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
