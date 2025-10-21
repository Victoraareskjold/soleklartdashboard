import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getLeadNoteComments, createLeadNoteComment } from "@/lib/db/leadNotes";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const resolvedParams = await params;
    const noteId = resolvedParams.noteId;

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);
    const comments = await getLeadNoteComments(client, noteId);
    return NextResponse.json(comments);
  } catch (err) {
    console.error("GET /api/leadNotes/[noteId]/comments error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const resolvedParams = await params;
    const noteId = resolvedParams.noteId;

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { userId, content } = body;
    if (!userId || !content)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const client = createSupabaseClient(token);
    const comment = await createLeadNoteComment(
      client,
      noteId,
      userId,
      content
    );
    return NextResponse.json(comment);
  } catch (err) {
    console.error("POST /api/leadNotes/[noteId]/comments error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
