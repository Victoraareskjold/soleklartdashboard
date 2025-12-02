import { createSupabaseAdminClient } from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { leads, assignedTo, installerGroupId, teamId } = await req.json();

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: "Ingen leads å importere" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Transformer hver lead til riktig format for databasen
    const leadsToInsert = leads.map((lead) => ({
      address: lead.address || null,
      person_info: lead.name || null,
      role: lead.role || null,
      company: lead.company || null,
      mobile: lead.mobile || null,
      phone: lead.phone || null,
      assigned_to: assignedTo,
      installer_group_id: installerGroupId,
      team_id: teamId,
      status: null,
      created_at: new Date().toISOString(),
    }));

    // Sett inn alle leads på én gang
    const { data, error } = await supabase
      .from("leads")
      .insert(leadsToInsert)
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Feil ved lagring til database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data.length,
      message: `${data.length} leads importert`,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
