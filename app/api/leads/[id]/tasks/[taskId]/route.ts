import { createSupabaseAdminClient } from "@/utils/supabase/client";
import { NextResponse } from "next/server";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  if (!resolvedParams?.id) {
    return NextResponse.json({ error: "Missing task id" }, { status: 400 });
  }
  const taskId = (await params).id;

  try {
    const body = await req.json();
    const { id } = body;

    if (!taskId) {
      return NextResponse.json({ error: "Mangler taskId" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase.from("lead_tasks").delete().eq("id", id);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: `Feil ved sletting av oppgave` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
