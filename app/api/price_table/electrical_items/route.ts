import { createSupabaseClient } from "@/utils/supabase/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const installerGroupId = url.searchParams.get("installerGroupId");

    if (!installerGroupId) {
      return NextResponse.json(
        { error: "Missing category or installerGroupId parameter" },
        { status: 400 }
      );
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = createSupabaseClient(token);

    const { data, error } = await client
      .from("electrical_installation_items")
      .select(
        `
          id,
          installer_group_id,
          category:electrical_installation_categories(id, name),
          name,
          price_per,
          extra_costs
        `
      )
      .eq("installer_group_id", installerGroupId);
    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("GET /api/leads error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      roof_type_id,
      installer_group_id,
      product_id,
      price_per,
      supplier_id,
    } = body;

    const client = createSupabaseClient(token);

    const { data, error } = await client
      .from("mount_items")
      .upsert(
        {
          roof_type_id,
          installer_group_id,
          product_id,
          price_per,
          supplier_id,
        },
        {
          onConflict: "roof_type_id,installer_group_id",
        }
      )
      .select(
        `
        id,
        roof_type_id,
        price_per,
        product:products(id, name, price_ex_vat, supplier:suppliers(id, name))
      `
      )
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("PATCH /api/price_table/mount_items error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
