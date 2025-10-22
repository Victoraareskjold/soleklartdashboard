import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getTaggableUsers } from "@/lib/db/leadNotes";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const resolvedParams = await params;
    if (!resolvedParams?.leadId) {
      return NextResponse.json(
        { error: "Missing estimate id" },
        { status: 400 }
      );
    }

    // Hent token fra Authorization header
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);

    const users = await getTaggableUsers(client, (await params).leadId);

    return NextResponse.json(users);
  } catch (err) {
    console.error("GET /api/leadNotes/[leadId]/taggableUsers error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
