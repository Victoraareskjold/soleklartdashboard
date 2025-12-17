import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    if (!resolvedParams?.id) {
      return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
    }
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);
    const leadId = (await params).id;

    const { data, error } = await client
      .from("lead_tasks")
      .select("*")
      .eq("lead_id", leadId);

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
    const {
      leadId,
      title,
      selectedDate,
      selectedTime,
      description,
      selectedMember,
    } = body;

    if (!leadId) {
      return NextResponse.json({ error: "Mangler leadid" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    let dueDate = null;
    if (
      selectedDate &&
      selectedTime &&
      typeof selectedDate === "string" &&
      selectedDate.includes(".")
    ) {
      const isoDateString = `${selectedDate
        .split(".")
        .reverse()
        .join("-")}T${selectedTime}`;
      const d = new Date(isoDateString);
      if (d && !isNaN(d.getTime())) {
        dueDate = d.toISOString();
      }
    }

    const { error } = await supabase.from("lead_tasks").insert({
      lead_id: leadId,
      title,
      description,
      assigned_to: selectedMember || null,
      due_date: dueDate,
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) {
    return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
  }
  const leadId = (await params).id;

  try {
    const body = await req.json();
    const { due_date, id } = body;

    if (!leadId) {
      return NextResponse.json({ error: "Mangler leadid" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from("lead_tasks")
      .update({ due_date })
      .eq("id", id);

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
