import { Note, User } from "@/lib/types";
import { SupabaseClient } from "@supabase/supabase-js";

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

export const createLeadNote = async (
  client: SupabaseClient,
  leadId: string,
  userId: string,
  content: string,
  source: "note" | "comment",
  noteId?: string
): Promise<Note> => {
  const { data: note, error } = await client
    .from("lead_notes")
    .insert({
      lead_id: leadId,
      user_id: userId,
      content,
      source,
      note_id: source === "comment" ? noteId : null,
    })
    .select("*, user:user_id(name)")
    .single();
  if (error || !note) throw error;

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

  const map: Record<string, { id: string; name: string }> = {};
  [...(teamMembers ?? [])].forEach((m) => {
    const userName = Array.isArray(m.user)
      ? m.user[0]?.name
      : (m.user as User)?.name;
    if (m.user_id && userName)
      map[m.user_id] = { id: m.user_id, name: userName };
  });

  return Object.values(map);
};

export const getUserMentions = async (
  client: SupabaseClient,
  userId: string
) => {
  const { data } = await client
    .from("lead_note_tags")
    .select("note:note_id(id, content, created_at, lead_id), source")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return data?.map((d) => d.note) ?? [];
};
