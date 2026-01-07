import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const teamId = url.searchParams.get("teamId");
    const installerGroupId = url.searchParams.get("installerGroupId");
    const teamRole = url.searchParams.get("teamRole");

    if (!teamId || !installerGroupId || !teamRole) {
      return NextResponse.json(
        { error: "Missing teamId or installerGroupId parameter" },
        { status: 400 }
      );
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = createSupabaseClient(token);
    const { data, error } = await client
      .from("leads")
      .select(
        `
    *,
    lead_tasks (
      id,
      title,
      due_date,
      assigned_to,
      created_at
    ),
    estimates (
      id,
      created_at,
      price_data
    )
  `
      )
      .eq("team_id", teamId)
      .eq("installer_group_id", installerGroupId);

    if (!data || error)
      return NextResponse.json({ error: "Missing data" }, { status: 500 });

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("GET /api/leads error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
