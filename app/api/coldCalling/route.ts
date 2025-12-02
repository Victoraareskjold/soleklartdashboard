import { createSupabaseAdminClient } from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const installerGroupId = url.searchParams.get("installerGroupId");
    const teamId = url.searchParams.get("teamId");

    if (!userId || !installerGroupId || !teamId) {
      return NextResponse.json(
        { error: "Mangler parametere" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Sett inn alle leads på én gang
    const { data, error } = await supabase
      .from("leads")
      .select()
      .eq("assigned_to", userId)
      .eq("installer_group_id", installerGroupId)
      .eq("team_id", teamId);

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
