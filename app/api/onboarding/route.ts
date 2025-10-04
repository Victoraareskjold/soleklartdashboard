import { createSupabaseClient } from "@/utils/supabase/client";
import { NextResponse } from "next/server";

// POST /api/onboarding
export async function POST(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Hent bruker
    const supabaseClient = createSupabaseClient(token);
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getUser(token);
    if (sessionError || !sessionData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = sessionData.user.id;
    const body = await req.json();
    const teamName = body.name?.trim();

    if (!teamName)
      return NextResponse.json(
        { error: "Team name required" },
        { status: 400 }
      );

    // Sjekk om brukeren allerede har et team
    const { data: existingTeams } = await supabaseClient
      .from("team_members")
      .select("team_id")
      .eq("user_id", userId);

    if (existingTeams?.length) {
      return NextResponse.json(
        { message: "Team already exists" },
        { status: 200 }
      );
    }

    // Opprett nytt team
    const { data: newTeam, error: teamError } = await supabaseClient
      .from("teams")
      .insert([{ name: teamName, leader_id: userId }])
      .select()
      .single();

    if (teamError || !newTeam) throw teamError;

    // Sett bruker som team_member
    const { error: memberError } = await supabaseClient
      .from("team_members")
      .insert([{ team_id: newTeam.id, user_id: userId, role: "admin" }]);

    if (memberError) throw memberError;

    return NextResponse.json(newTeam);
  } catch (err) {
    console.error("POST /api/onboarding error:", err);
    return NextResponse.json({ error: err || err }, { status: 500 });
  }
}
