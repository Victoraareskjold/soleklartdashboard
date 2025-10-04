import { SupabaseClient } from "@supabase/supabase-js";

export async function getLeads(
  client: SupabaseClient,
  teamId: string,
  installerGroupId?: string
) {
  let query = client.from("leads").select("*").eq("team_id", teamId);
  if (installerGroupId)
    query = query.eq("installer_group_id", installerGroupId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createLead(
  client: SupabaseClient,
  teamId: string,
  leadData: any
) {
  const { data, error } = await client
    .from("leads")
    .insert({ team_id: teamId, ...leadData })
    .select()
    .single();
  if (error) throw error;
  return data;
}
