import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "@/utils/supabase/client";
import { deleteEstimate, updateEstimate } from "@/lib/db/estimates";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    if (!resolvedParams?.id) {
      return NextResponse.json(
        { error: "Missing estimate id" },
        { status: 400 },
      );
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);
    const estimateId = (await params).id;

    const { data, error } = await client
      .from("estimates")
      .select("*")
      .eq("lead_id", estimateId)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/estimates/[id] error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    if (!resolvedParams?.id) {
      return NextResponse.json({ error: "Missing lead id" }, { status: 400 });
    }
    const estimateId = resolvedParams.id;

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = createSupabaseClient(token);
    const body = await req.json();
    if (!body)
      return NextResponse.json(
        { error: "Missing update payload" },
        { status: 400 },
      );

    const updatedLead = await updateEstimate(client, estimateId, body);
    return NextResponse.json(updatedLead);
  } catch (err) {
    console.error("PATCH /api/leads/[id] error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    if (!resolvedParams?.id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const id = resolvedParams.id;

    const client = createSupabaseAdminClient();

    const deleteLead = await deleteEstimate(client, id);
    return NextResponse.json(deleteLead);
  } catch (err) {
    console.error("DELETE /api/leads/[id] error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
