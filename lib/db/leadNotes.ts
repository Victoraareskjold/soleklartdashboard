import { Note, NoteComment } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";

// Hent eksisterende merknader
export const getLeadNotes = async (
  client: SupabaseClient,
  leadId: string
): Promise<Note[]> => {
  const { data, error } = await client
    .from("lead_notes")
    .select("*, user:user_id(name)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
};

// Opprett merknad med tagging
export const createLeadNote = async (
  client: SupabaseClient,
  leadId: string,
  userId: string,
  content: string
): Promise<Note> => {
  // Opprett merknad
  const { data: note, error } = await client
    .from("lead_notes")
    .insert({ lead_id: leadId, user_id: userId, content })
    .select("*, user:user_id(name)")
    .single();
  if (error || !note) throw error;

  // Parse @-mentions
  const mentionRegex = /@(\w+)/g;
  let match;
  const mentions: string[] = [];
  while ((match = mentionRegex.exec(content))) mentions.push(match[1]);

  if (mentions.length > 0) {
    const { data: users } = await client
      .from("users")
      .select("id, name")
      .in("name", mentions);

    const tagInserts = (users ?? []).map((u) => ({
      note_id: note.id,
      user_id: u.id,
    }));

    if (tagInserts.length > 0) {
      await client.from("lead_note_tags").insert(tagInserts);
    }
  }

  return note;
};

// Hent kommentarer
export const getLeadNoteComments = async (
  client: SupabaseClient,
  noteId: string
): Promise<NoteComment[]> => {
  const { data, error } = await client
    .from("lead_note_comments")
    .select("*, user:user_id(name)")
    .eq("note_id", noteId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
};

// Opprett kommentar
export const createLeadNoteComment = async (
  client: SupabaseClient,
  noteId: string,
  userId: string,
  content: string
): Promise<NoteComment> => {
  const { data, error } = await client
    .from("lead_note_comments")
    .insert({ note_id: noteId, user_id: userId, content })
    .select("*, user:user_id(name)")
    .single();
  if (error) throw error;
  return data;
};

// Hent brukere som kan tagges
export const getTaggableUsers = async (
  client: SupabaseClient,
  leadId: string
) => {
  const { data: lead } = await client
    .from("leads")
    .select("team_id, installer_group_id")
    .eq("id", leadId)
    .single();

  if (!lead) return [];

  const { data: teamMembers } = await client
    .from("team_members")
    .select("user_id, user:user_id(name)")
    .eq("team_id", lead.team_id);

  const { data: groupMembers } = await client
    .from("installer_group_members")
    .select("user_id, user:user_id(name)")
    .eq("installer_group_id", lead.installer_group_id);

  console.log(teamMembers, groupMembers);

  const map: Record<string, { id: string; name: string }> = {};
  [...(teamMembers ?? []), ...(groupMembers ?? [])].forEach((m) => {
    if (m.user_id && m.user?.name)
      map[m.user_id] = { id: m.user_id, name: m.user.name };
  });

  return Object.values(map);
};

// Hent merknader der bruker er tagget
export const getUserMentions = async (
  client: SupabaseClient,
  userId: string
) => {
  const { data } = await client
    .from("lead_note_tags")
    .select("note:note_id(id, content, created_at, lead_id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return data?.map((d) => d.note) ?? [];
};
