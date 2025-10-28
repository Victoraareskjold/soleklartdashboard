import { SupabaseClient } from "@supabase/supabase-js";
import { LeadEmail } from "../types";

export async function getLeadEmails(client: SupabaseClient, leadId: string) {
  const { data, error } = await client
    .from("lead_emails")
    .select("*")
    .eq("lead_id", leadId)
    .order("received_date", { ascending: false });

  if (error) throw error;
  return data as LeadEmail[];
}

export async function createLeadEmail(
  client: SupabaseClient,
  email: Omit<LeadEmail, "id" | "created_at">
) {
  const { data, error } = await client
    .from("lead_emails")
    .insert(email)
    .select()
    .single();

  if (error) throw error;
  return data as LeadEmail;
}

export async function getLeadEmailByMessageId(
  client: SupabaseClient,
  messageId: string
) {
  const { data, error } = await client
    .from("lead_emails")
    .select("*")
    .eq("message_id", messageId)
    .single();

  if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
  return data as LeadEmail | null;
}

export async function syncLeadEmails(
  client: SupabaseClient,
  leadId: string,
  emails: Omit<LeadEmail, "id" | "created_at">[]
) {
  const { data, error } = await client
    .from("lead_emails")
    .upsert(emails, { onConflict: "message_id" })
    .select();

  if (error) throw error;
  return data as LeadEmail[];
}
