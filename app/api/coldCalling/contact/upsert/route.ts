import { createSupabaseAdminClient } from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      team_id,
      installer_group_id,
      email,
      person_info,
      mobile,
      phone,
      address,
      roof_type_id,
      assigned_to,
      note,
      company,
      role,
      created_by,
    } = await req.json();

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("leads")
      .insert({
        team_id,
        installer_group_id,
        email: email || null,
        person_info: person_info || null,
        mobile: mobile || null,
        phone: phone || null,
        address: address || null,
        roof_type_id: roof_type_id || null,
        assigned_to: assigned_to || null,
        status: 7,
        note: note || null,
        company: company || null,
        role: role || null,
        created_by: created_by || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: `Feil ved opprettelse av avtale` },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, userId } = body;

    if (!id || !userId) {
      return NextResponse.json(
        { error: "Mangler id eller userId" },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from("leads")
      .update({
        status: 7,
        created_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select();

    if (error) {
      return NextResponse.json(
        { error: `Feil ved opprettelse av avtale ${id}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
