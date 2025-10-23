import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getSuppliersWithProducts } from "@/lib/db/price_tables";

export async function GET(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);

    const table = await getSuppliersWithProducts(client);
    return NextResponse.json(table);
  } catch (err) {
    console.error("GET /api/price_table error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
