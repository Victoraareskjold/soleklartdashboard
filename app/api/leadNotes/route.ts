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
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { leadId, userId, content } = body;
    if (!leadId || !userId || !content)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const client = createSupabaseClient(token);
    const note = await createLeadNote(client, leadId, userId, content);
    return NextResponse.json(note);
  } catch (err) {
    console.error("POST /api/leadNotes error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
