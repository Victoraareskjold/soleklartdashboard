import { PriceTable } from "@/types/price_table";
import { SupabaseClient } from "@supabase/supabase-js";

export async function getPriceTable(
  client: SupabaseClient,
  installer_group_id: string
) {
  const { data, error } = await client
    .from("price_table")
    .select("*")
    .eq("installer_group_id", installer_group_id)
    .maybeSingle();

  if (error) throw error;
  return data as PriceTable | null;
}

export async function updatePriceTable(
  client: SupabaseClient,
  installerGroupId: string,
  updates: Partial<PriceTable>
) {
  const { data, error } = await client
    .from("price_table")
    .update(updates)
    .eq("installer_group_id", installerGroupId)
    .select()
    .single();
  if (error) throw error;
  return data as PriceTable;
}
