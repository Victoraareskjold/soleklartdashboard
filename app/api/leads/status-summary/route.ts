import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const supabase = createSupabaseAdminClient();

  const userId = searchParams.get("userId");
  const teamId = searchParams.get("teamId");
  const installerGroupId = searchParams.get("installerGroupId");

  if (!userId || !teamId || !installerGroupId) {
    return NextResponse.json([], { status: 400 });
  }

  const { data, error } = await supabase
    .from("leads")
    .select("status", { count: "exact", head: false })
    .eq("assigned_to", userId)
    .eq("team_id", teamId)
    .eq("installer_group_id", installerGroupId);

  if (error) {
    return NextResponse.json([], { status: 500 });
  }

  // Gruppér manuelt
  const counts: Record<number, number> = {};
  data.forEach((l) => {
    counts[l.status] = (counts[l.status] || 0) + 1;
  });

  return NextResponse.json(
    Object.entries(counts).map(([status, count]) => ({
      status: Number(status),
      count,
    }))
  );
}
