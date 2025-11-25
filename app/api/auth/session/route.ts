import { createSupabaseClient } from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json(
      { error: "Missing userId parameter" },
      { status: 400 }
    );
  }

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseClient(token);

  // Fetch team membership
  const { data: teamMember, error: teamError } = await client
    .from("team_members")
    .select("*, teams(*)")
    .eq("user_id", userId)
    .single();

  // Fetch installer group memberships
  const { data: installerGroupMemberships, error: groupError } = await client
    .from("installer_group_members")
    .select("*, installer_groups(*)")
    .eq("user_id", userId);

  if (groupError) {
    return NextResponse.json(
      { error: "Failed to fetch installer group memberships" },
      { status: 500 }
    );
  }

  if (teamError || !teamMember) {
    if (installerGroupMemberships && installerGroupMemberships.length > 0) {
      const session = {
        user_id: userId,
        team_id: installerGroupMemberships[0].installer_groups.team_id,
        team_role: "installer",
        installer_groups: installerGroupMemberships || [],
      };
      return NextResponse.json(session);
    }

    return NextResponse.json(
      { error: "User is not part of a team" },
      { status: 404 }
    );
  }

  const session = {
    user_id: userId,
    team_id: teamMember.team_id,
    team_role: teamMember.role,
    installer_groups: installerGroupMemberships || [],
  };

  return NextResponse.json(session);
}
