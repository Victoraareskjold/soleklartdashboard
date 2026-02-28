import { createSupabaseAdminClient } from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, address, person_info, role, company, mobile, phone } = body;

    if (!id) {
      return NextResponse.json({ error: "Mangler lead-id" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("leads")
      .update({
        address,
        person_info,
        role,
        company,
        mobile,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Feil ved lagring til database" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, lead: data[0] });
  } catch (error) {
    console.error("Update basic info error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
