import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";

export async function POST(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);

    const { userId, code } = await req.json();
    if (!userId || !code)
      return NextResponse.json(
        { error: "missing parameters" },
        { status: 400 }
      );

    const { data: team, error: teamError } = await client
      .from("installer_group_members")
      .insert({ installer_group_id: code, user_id: userId, role: "member" })
      .select()
      .single();
    if (teamError) throw teamError;

    return NextResponse.json(team);
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
