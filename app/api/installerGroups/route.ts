import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getInstallerGroups } from "@/lib/db/installerGroups";

// GET /api/installerGroups?team_id=xxx
export async function GET(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const teamId = url.searchParams.get("team_id");
    if (!teamId)
      return NextResponse.json(
        { error: "team_id is required" },
        { status: 400 }
      );

    const client = createSupabaseClient(token);

    const groups = await getInstallerGroups(client, teamId);
    return NextResponse.json(groups);
  } catch (err) {
    console.error("GET /api/installerGroups error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
