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
      .from("mount_volume_reduction")
      .select("*")
      .eq("installer_group_id", installerGroupId);
    if (error) throw error;

    const defaults = [
      { number: 1, amount: 72, amount2: 144, reduction: 3 },
      { number: 2, amount: 145, amount2: 288, reduction: 5 },
      { number: 3, amount: 281, amount2: 576, reduction: 7 },
      { number: 4, amount: 578, amount2: 1000, reduction: 9 },
    ];

    if (!data || data.length === 0) {
      return NextResponse.json(defaults);
    }

    const merged = defaults.map((def) => {
      const existing = data.find((row) => row.number === def.number);
      return existing || { ...def, installer_group_id: installerGroupId };
    });

    return NextResponse.json(merged);
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
    const { number, installer_group_id, amount, amount2, reduction } = body;

    if (
      !installer_group_id ||
      amount == null ||
      amount2 == null ||
      reduction == null ||
      number == null
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = createSupabaseClient(token);

    const { data, error } = await client
      .from("mount_volume_reduction")
      .upsert(
        {
          installer_group_id,
          number,
          amount,
          amount2,
          reduction,
        },
        {
          onConflict: "installer_group_id,number",
        }
      )
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("PATCH /api/price_table/mount_volume_reduction error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
