import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getTeam } from "@/lib/db/teams";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    if (!resolvedParams?.id) {
      return NextResponse.json(
        { error: "Missing estimate id" },
        { status: 400 }
      );
    }
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);
    const group = await getTeam(client, (await params).id);
    return NextResponse.json(group);
  } catch (err) {
    console.error("GET /api/teams/[id] error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
