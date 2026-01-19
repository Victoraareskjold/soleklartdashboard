import { createSupabaseAdminClient } from "@/utils/supabase/client";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  try {
    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json({ error: "Mangler taskId" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("lead_tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Feil ved sletting av oppgave" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
