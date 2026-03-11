import { createSupabaseAdminClient } from "@/utils/supabase/client";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ installerGroupId: string }> },
) {
  try {
    const { installerGroupId } = await params;

    const supabase = createSupabaseAdminClient();

    // Cold calling
    const { count: coldCallingAmount, error: coldError } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("installer_group_id", installerGroupId)
      //.in("status", [1, 2, 3, 4, 5, 22]);
      .eq("status", 5);

    // Contact
    const { count: contactAmount, error: contactError } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("installer_group_id", installerGroupId)
      .eq("status", 6);

    if (coldError || contactError) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({
      coldCallingAmount: coldCallingAmount ?? 0,
      contactAmount: contactAmount ?? 0,
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error", err }, { status: 500 });
  }
}
