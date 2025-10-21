import { SupabaseClient } from "@supabase/supabase-js";

export async function getLeadNotes(client: SupabaseClient, leadId: string) {
  const { data, error } = await client
    .from("lead_notes")
    .select("*, users(name)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createLeadNote(
  client: SupabaseClient,
  leadId: string,
  userId: string,
  content: string
) {
  const { data, error } = await client
    .from("lead_notes")
    .insert({ lead_id: leadId, user_id: userId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createLeadNoteComment(
  client: SupabaseClient,
  noteId: string,
  userId: string,
  content: string
) {
  const { data, error } = await client
    .from("lead_note_comments")
    .insert({ note_id: noteId, user_id: userId, content })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLeadNoteComments(
  client: SupabaseClient,
  noteId: string
) {
  const { data, error } = await client
    .from("lead_note_comments")
    .select("*, users(name)")
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}
