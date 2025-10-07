import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getPriceTable, updatePriceTable } from "@/lib/db/priceTable";

export async function GET(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const installer_group_id = url.searchParams.get("installer_group_id");
    if (!installer_group_id) {
      return NextResponse.json(
        { error: "installer_group_id required" },
        { status: 400 }
      );
    }

    const client = createSupabaseClient(token);

    const table = await getPriceTable(client, installer_group_id);
    return NextResponse.json(table);
  } catch (err) {
    console.error("GET /api/price_table error:", err);
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
    const installerGroupId = url.searchParams.get("installer_group_id");
    if (!installerGroupId)
      return NextResponse.json(
        { error: "installerGroupId is required" },
        { status: 400 }
      );

    const client = createSupabaseClient(token);

    const body = await req.json();
    if (!body)
      return NextResponse.json(
        { error: "Missing update payload" },
        { status: 400 }
      );

    const updatedPriceTable = await updatePriceTable(
      client,
      installerGroupId,
      body
    );
    return NextResponse.json(updatedPriceTable);
  } catch (err) {
    console.error("PATCH /api/price_table error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
