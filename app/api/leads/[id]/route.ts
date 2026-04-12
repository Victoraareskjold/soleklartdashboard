import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseClient,
} from "@/utils/supabase/client";
import { updateLead } from "@/lib/db/leads";

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
    const leadId = resolvedParams.id;

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

    // Record status transition before updating, if status is changing
    let fromStatus: number | null = null;
    let statusIsChanging = false;
    if (body.status !== undefined) {
      const { data: current } = await client
        .from("leads")
        .select("status")
        .eq("id", leadId)
        .single();
      fromStatus = current?.status ?? null;
      statusIsChanging = fromStatus !== body.status;
    }

    const updatedLead = await updateLead(client, leadId, body);

    // Write history row after successful update
    if (statusIsChanging) {
      const {
        data: { user },
      } = await client.auth.getUser();
      await client.from("lead_status_history").insert({
        lead_id: leadId,
        from_status: fromStatus,
        to_status: body.status,
        changed_by: user?.id ?? null,
      });
    }

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

    const { data, error } = await client.from("leads").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("DELETE /api/leads/[id] error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
