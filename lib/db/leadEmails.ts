import { SupabaseClient } from "@supabase/supabase-js";
import { LeadEmail } from "../types";

// Get all email references for a lead (ordered by created_at descending)
export async function getLeadEmails(client: SupabaseClient, leadId: string) {
  const { data, error } = await client
    .from("lead_emails")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as LeadEmail[];
}

// Create a new email reference
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

// Check if an email reference already exists by message_id
export async function getLeadEmailByMessageId(
  client: SupabaseClient,
  messageId: string
) {
  const { data, error } = await client
    .from("lead_emails")
    .select("*")
    .eq("message_id", messageId)
    .maybeSingle();

  if (error) throw error;
  return data as LeadEmail | null;
}

// Sync email references (upsert based on message_id to avoid duplicates)
export async function syncLeadEmails(
  client: SupabaseClient,
  leadId: string,
  emails: Omit<LeadEmail, "id" | "created_at">[]
) {
  if (emails.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("lead_emails")
    .upsert(emails, { onConflict: "message_id" })
    .select();

  if (error) throw error;
  return data as LeadEmail[];
}

// Delete an email reference
export async function deleteLeadEmail(
  client: SupabaseClient,
  emailId: string
) {
  const { error } = await client
    .from("lead_emails")
    .delete()
    .eq("id", emailId);

  if (error) throw error;
}
