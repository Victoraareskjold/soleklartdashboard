import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";

const PAGE_SIZE = 1000;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const teamId = url.searchParams.get("teamId");
    const installerGroupId = url.searchParams.get("installerGroupId");
    const teamRole = url.searchParams.get("teamRole");

    if (!teamId || !installerGroupId || !teamRole) {
      return NextResponse.json(
        { error: "Missing teamId or installerGroupId parameter" },
        { status: 400 },
      );
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = createSupabaseClient(token);
    const allData = [];
    let from = 0;

    while (true) {
      const { data, error } = await client
        .from("leads")
        .select(
          `
    *,
    assigned_user:users!leads_assigned_to_fkey(name),
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
  `,
        )
        .eq("team_id", teamId)
        .eq("installer_group_id", installerGroupId)
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        return NextResponse.json({ error: "Missing data" }, { status: 500 });
      }

      allData.push(...(data ?? []));

      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return NextResponse.json(allData);
  } catch (err) {
    console.error("GET /api/leads error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
