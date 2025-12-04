import { createSupabaseAdminClient } from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const installerGroupId = url.searchParams.get("installerGroupId");
    const teamId = url.searchParams.get("teamId");
    const status = url.searchParams.get("status");

    if (!installerGroupId || !teamId) {
      return NextResponse.json(
        { error: "Mangler parametere" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("leads")
      .select()
      .eq("installer_group_id", installerGroupId)
      .eq("team_id", teamId)
      .eq("status", 0);

    if (userId) {
      query = query.eq("assigned_to", userId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Feil ved lagring til database" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
