import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const leadTaskId = url.searchParams.get("leadTaskId");

    const client = createSupabaseClient(token);

    const { data, error } = await client
      .from("lead_tasks_comments")
      .select("*")
      .eq("lead_task_id", leadTaskId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/leads/[id] error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadTaskId, description } = body;

    if (!leadTaskId) {
      return NextResponse.json(
        { error: "Mangler leadTaskId" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase.from("lead_tasks_comments").insert({
      lead_task_id: leadTaskId,
      description: description,
    });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: `Feil ved opprettelse av oppgave` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
