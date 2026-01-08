import { createSupabaseClient } from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = createSupabaseClient(token);

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
    .select("*")
    .eq("email", authUser.email)
    .single();

  if (userError || !user) {
    return NextResponse.json(
      { error: "User not found in database" },
      { status: 404 }
    );
  }

  return NextResponse.json(user);
}
