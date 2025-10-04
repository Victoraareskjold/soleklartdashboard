import { createTeam, getTeamsForUser } from "@/lib/db/teams";
import { createSupabaseClient } from "@/utils/supabase/client";
import { NextResponse } from "next/server";

// GET /api/teams
export async function GET(req: Request) {
  // Get supabaseclient token
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get authenticated user
  const client = createSupabaseClient(token);
  const { data: sessionData } = await client.auth.getUser();
  if (!sessionData?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const teams = await getTeamsForUser(client, sessionData.user.id);
  return NextResponse.json(teams);
}

// POST /api/teams
export async function POST(req: Request) {
  // Get supabaseclient token
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get authenticated user
  const client = createSupabaseClient(token);
  const { data: sessionData } = await client.auth.getUser();
  if (!sessionData?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const team = await createTeam(client, sessionData.user.id, body.name);
  return NextResponse.json(team);
}
