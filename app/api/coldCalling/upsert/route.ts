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
      const { id, status, ...rest } = lead; // Extract id, status and other fields

      if (!id) {
        return NextResponse.json(
          { error: `Mangler parametere for lead ${id || "ukjent"}` },
          { status: 400 },
        );
      }

      const updatePayload: { [key: string]: unknown } = {
        status: status, // Status is always required and passed
        updated_at: new Date().toISOString(),
      };

      // Add other fields to the payload only if they are present in the lead object
      if (rest.email !== undefined) updatePayload.email = rest.email;
      if (rest.note !== undefined) updatePayload.note = rest.note;
      if (rest.roof_type_id !== undefined)
        updatePayload.roof_type_id = rest.roof_type_id;
      if (rest.own_consumption !== undefined)
        updatePayload.own_consumption = rest.own_consumption;
      if (rest.voltage !== undefined) updatePayload.voltage = rest.voltage;
      if (rest.roof_slope !== undefined)
        updatePayload.roof_slope = rest.roof_slope;
      if (rest.roof_age !== undefined) updatePayload.roof_age = rest.roof_age;
      if (rest.person_info !== undefined)
        updatePayload.person_info = rest.person_info;
      if (rest.role !== undefined) updatePayload.role = rest.role;
      if (rest.company !== undefined) updatePayload.company = rest.company;
      if (rest.address !== undefined) updatePayload.address = rest.address;
      if (rest.mobile !== undefined) updatePayload.mobile = rest.mobile;
      if (rest.phone !== undefined) updatePayload.phone = rest.phone;

      const { data, error } = await supabase
        .from("leads")
        .update(updatePayload)
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
