import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    if (!resolvedParams?.id) {
      return NextResponse.json(
        { error: "Missing estimate id" },
        { status: 400 }
      );
    }
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);
    const leadId = (await params).id;

    const { data, error } = await client
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/leads/[id] error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    if (!resolvedParams?.id) {
      return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
    }
    const leadId = resolvedParams.id;

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = createSupabaseClient(token);
    const body = await req.json();

    const { data, error } = await client
      .from("leads")
      .update(body)
      .eq("id", leadId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("PATCH /api/leads/[id] error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
