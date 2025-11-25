import { createSupabaseClient } from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseClient(token);

  // Hent den autentiserte brukeren fra Supabase Auth
  const {
    data: { user: authUser },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Finn brukeren i users tabellen basert på email
  const { data: user, error: userError } = await client
    .from("users")
    .select("id")
    .eq("email", authUser.email)
    .single();

  if (userError || !user) {
    return NextResponse.json(
      { error: "User not found in database" },
      { status: 404 }
    );
  }

  const userId = user.id;

  // Hent team membership med installer_group info hvis relevant
  const { data: teamMember, error: teamError } = await client
    .from("team_members")
    .select("*, teams(*), installer_groups(*)")
    .eq("user_id", userId)
    .single();

  if (teamError || !teamMember) {
    return NextResponse.json(
      { error: "User is not part of a team" },
      { status: 404 }
    );
  }

  // Bygg session basert på rolle
  const session = {
    user_id: userId,
    team_id: teamMember.team_id,
    team_role: teamMember.role,
    installer_group: teamMember.installer_groups || null,
  };

  return NextResponse.json(session);
}
