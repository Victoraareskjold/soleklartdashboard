import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";

export async function GET(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });

  const supabase = createSupabaseClient(token);
  const { data, error } = await supabase
    .from("mail_templates")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId, name, subject, body, template_key } = await req.json();
  if (!teamId || !name || !subject || !body) {
    return NextResponse.json({ error: "teamId, name, subject, body required" }, { status: 400 });
  }

  const supabase = createSupabaseClient(token);
  const { data, error } = await supabase
    .from("mail_templates")
    .insert({ team_id: teamId, name, subject, body, template_key: template_key ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
