import { SupabaseClient } from "@supabase/supabase-js";
import { Estimate } from "../types";

export async function getEstimate(
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

export async function updateEstimate(
  client: SupabaseClient,
  estimateId: string,
  updates: Partial<Estimate>
) {
  const { data, error } = await client
    .from("estimates")
    .update(updates)
    .eq("id", estimateId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createEstimate(
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
