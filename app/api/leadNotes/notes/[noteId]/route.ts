import { createSupabaseAdminClient } from "@/utils/supabase/client";
import { NextResponse } from "next/server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ noteId: string }> },
) {
  try {
    const { noteId } = await params;
    if (!noteId) {
      return NextResponse.json({ error: "Mangler noteId" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("lead_notes")
      .delete()
      .eq("id", noteId);

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
