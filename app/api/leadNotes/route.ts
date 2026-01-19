import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getLeadNotes, createLeadNote } from "@/lib/db/leadNotes";

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
    const note = await createLeadNote(
      client,
      leadId,
      userId,
      content,
      source,
      noteId,
    );

    const createdAttachments = [];

    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        const { name, contentType, contentBytes } = attachment;
        const buffer = Buffer.from(contentBytes, "base64");
        const path = `public/${note.id}/${name}`;

        const { error: uploadError } = await client.storage
          .from("lead-notes-attachments")
          .upload(path, buffer, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error("Error uploading attachment:", uploadError);
          continue; // Or handle error more gracefully
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

          if (newAttachment) {
            createdAttachments.push(newAttachment);
          }
        }
      }
    }

    const noteWithAttachments = {
      ...note,
      attachments: createdAttachments,
    };

    return NextResponse.json(noteWithAttachments);
  } catch (err) {
    console.error("POST /api/leadNotes error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
