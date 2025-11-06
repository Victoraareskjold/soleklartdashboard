import { createSupabaseClient } from "@/utils/supabase/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);
    const { data, error } = await client.from("roof_types").select("*");
    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/price_table/roof_types error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
