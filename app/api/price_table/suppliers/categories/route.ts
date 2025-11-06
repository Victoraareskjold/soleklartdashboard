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
      .from("supplier_categories")
      .select("*")
      .eq("installer_group_id", installerGroupId);
    if (error) throw error;

    const defaults = [
      {
        name: "ELEKTRISK INSTALLASJON",
        markup_percentage: 0,
      },
      {
        name: "MONTERING",
        markup_percentage: 0,
      },
      {
        name: "SOLCELLEMATERIELL",
        markup_percentage: 0,
      },
      {
        name: "BALLASTEIN",
        markup_percentage: 0,
      },
      {
        name: "STILLASE",
        markup_percentage: 0,
      },
      {
        name: "FRAKT",
        markup_percentage: 0,
      },
    ];

    if (!data || data.length === 0) {
      return NextResponse.json(defaults);
    }

    const merged = defaults.map((def) => {
      const existing = data.find((row) => row.name === def.name);
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

    const url = new URL(req.url);
    const installer_group_id = url.searchParams.get("installerGroupId");

    const body = await req.json();
    const { name, markup_percentage } = body;

    if (!installer_group_id || name == null || markup_percentage === null) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = createSupabaseClient(token);

    const { data, error } = await client
      .from("supplier_categories")
      .upsert(
        {
          installer_group_id,
          name,
          markup_percentage,
        },
        {
          onConflict: "installer_group_id,name",
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
