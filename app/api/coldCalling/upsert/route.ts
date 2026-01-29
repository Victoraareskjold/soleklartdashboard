import { createSupabaseAdminClient } from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leads = body;

    if (!leads || !leads.length) {
      return NextResponse.json({ error: "Ingen leads sendt" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const results = [];
    for (const lead of leads) {
      const {
        id,
        email,
        note,
        roof_type_id,
        own_consumption,
        voltage,
        roof_slope,
        roof_age,
        status,
      } = lead;

      if (
        !id ||
        /* !email ||
        !roof_type_id ||
        !own_consumption ||
        !voltage ||
        !roof_age || */
        !status
      ) {
        return NextResponse.json(
          { error: `Mangler parametere for lead ${id || "ukjent"}` },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from("leads")
        .update({
          email,
          note,
          roof_type_id,
          own_consumption,
          voltage,
          roof_slope,
          roof_age,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select();

      if (error) {
        console.error("Supabase error:", error);
        return NextResponse.json(
          { error: `Feil ved lagring av lead ${id}` },
          { status: 500 },
        );
      }

      results.push(data[0]);
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      message: `${results.length} leads oppdatert`,
      leads: results,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
