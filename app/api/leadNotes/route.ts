import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import {
  getLeadNotes,
  createLeadNote,
  getNoteThreadParticipants,
} from "@/lib/db/leadNotes";
import { buildMentionEmail } from "@/utils/helpers/buildMentionEmail";
import { buildCommentNotificationEmail } from "@/utils/helpers/buildCommentNotificationEmail";

const sendEmail = async (
  origin: string,
  to: string,
  subject: string,
  html: string,
) => {
  await fetch(`${origin}/api/send-mail`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, html }),
  });
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const leadId = url.searchParams.get("lead_id");
    if (!leadId)
      return NextResponse.json({ error: "Missing lead_id" }, { status: 400 });

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);
    const notes = await getLeadNotes(client, leadId);
    return NextResponse.json(notes);
  } catch (err) {
    console.error("GET /api/leadNotes error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { leadId, userId, content, source, noteId, attachments } = body;

    if (!leadId || !userId || !content || !source)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const client = createSupabaseClient(token);

    // Create the note or comment
    const note = await createLeadNote(
      client,
      leadId,
      userId,
      content,
      source,
      noteId,
    );

    // ── Handle attachments ───────────────────────────────────────────────────
    const createdAttachments = [];
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        const { name, contentType, contentBytes } = attachment;
        const buffer = Buffer.from(contentBytes, "base64");
        const path = `public/${note.id}/${name}`;

        const { error: uploadError } = await client.storage
          .from("lead-notes-attachments")
          .upload(path, buffer, { contentType, upsert: true });

        if (uploadError) {
          console.error("Error uploading attachment:", uploadError);
          continue;
        }

        const { data: publicUrlData } = client.storage
          .from("lead-notes-attachments")
          .getPublicUrl(path);

        if (publicUrlData) {
          const { data: newAttachment } = await client
            .from("lead_note_attachments")
            .insert({
              note_id: note.id,
              file_name: name,
              file_url: publicUrlData.publicUrl,
              file_type: contentType,
            })
            .select()
            .single();

          if (newAttachment) createdAttachments.push(newAttachment);
        }
      }
    }

    // ── Handle email notifications ───────────────────────────────────────────
    try {
      const origin = new URL(req.url).origin;

      // Fetch author name and lead info for emails
      const [{ data: authorData }, { data: leadData }] = await Promise.all([
        client.from("users").select("name").eq("id", userId).single(),
        client
          .from("leads")
          .select("person_info, address, id")
          .eq("id", leadId)
          .single(),
      ]);

      const authorName = authorData?.name ?? "En bruker";

      if (leadData) {
        if (source === "note") {
          // Notify explicitly @mentioned users in the new note
          const mentions = content.match(/@\[([^\]]+)\]/g);
          if (mentions) {
            const mentionedNames = mentions.map((m: string) =>
              m.substring(2, m.length - 1),
            );
            const { data: mentionedUsers } = await client
              .from("users")
              .select("id, name, email")
              .in("name", mentionedNames);

            for (const user of mentionedUsers ?? []) {
              if (user.email && user.id !== userId) {
                const { subject, html } = buildMentionEmail(
                  authorName,
                  leadData,
                  content,
                  origin,
                );
                await sendEmail(origin, user.email, subject, html);
              }
            }
          }
        } else if (source === "comment" && noteId) {
          // Notify ALL thread participants (except the commenter themselves)
          const participants = await getNoteThreadParticipants(client, noteId);

          for (const participant of participants) {
            if (participant.id !== userId) {
              const { subject, html } = buildCommentNotificationEmail(
                authorName,
                leadData,
                content,
                origin,
              );
              await sendEmail(origin, participant.email, subject, html);
            }
          }
        }
      }
    } catch (emailErr) {
      // Email failures should not block the response
      console.error("Email notification error:", emailErr);
    }

    return NextResponse.json({ ...note, attachments: createdAttachments });
  } catch (err) {
    console.error("POST /api/leadNotes error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
