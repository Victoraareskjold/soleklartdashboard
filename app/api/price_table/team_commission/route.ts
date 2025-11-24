import { createSupabaseClient } from "@/utils/supabase/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const teamId = url.searchParams.get("teamId");

    if (!teamId) {
      return NextResponse.json(
        { error: "Missing teamId parameter" },
        { status: 400 }
      );
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = createSupabaseClient(token);

    const { data, error } = await client
      .from("team_commission")
      .select("*")
      .eq("team_id", teamId)
      .order("index");
    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/price_table/team_commission error:", err);
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
    const { team_id, index, amount, amount2, commission } = body;

    if (!team_id || index == null || amount == null || commission == null) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const client = createSupabaseClient(token);

    const upsertData: {
      team_id: string;
      index: number;
      amount: number;
      commission: number;
      amount2?: number;
    } = {
      team_id,
      index,
      amount,
      commission,
    };

    if (amount2 != null) {
      upsertData.amount2 = amount2;
    }

    const { data, error } = await client
      .from("team_commission")
      .upsert(upsertData, {
        onConflict: "team_id,index",
      })
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("PATCH /api/price_table/team_commission error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
