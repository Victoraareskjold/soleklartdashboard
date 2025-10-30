import { createSupabaseClient } from "@/utils/supabase/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");
    const installerGroupId = url.searchParams.get("installerGroupId");

    if (!category || !installerGroupId) {
      return NextResponse.json(
        { error: "Missing category or installerGroupId parameter" },
        { status: 400 }
      );
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = createSupabaseClient(token);

    const { data, error } = await client
      .from("work_items")
      .select("*")
      .eq("category", category)
      .eq("installer_group_id", installerGroupId);
    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("GET /api/leads error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
