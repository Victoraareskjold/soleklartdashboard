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

    // Et signert tilbud er laast. Serveren avgjoer dette, ikke klienten.
    const { data: existing, error: lookupError } = await client
      .from("estimates")
      .select("signed_at")
      .eq("id", estimateId)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) {
      return NextResponse.json(
        { error: "Fant ikke estimatet" },
        { status: 404 },
      );
    }
    if (existing.signed_at) {
      return NextResponse.json(
        {
          error:
            "Tilbudet er signert og kan ikke endres. Opprett et nytt estimat.",
        },
        { status: 409 },
      );
    }

    // Bare disse feltene kan oppdateres herfra. signed_at, id og lead_id
    // settes aldri fra redigeringsvisningen.
    const EDITABLE_FIELDS = [
      "total_panels",
      "kwp",
      "selected_panel_type",
      "selected_roof_type",
      "checked_roof_data",
      "selected_el_price",
      "yearly_cost",
      "yearly_cost2",
      "yearly_prod",
      "desired_kwh",
      "coverage_percentage",
      "price_data",
      "image_url",
      "simulation_pdf",
      "address",
      "name",
      "private",
      "finished",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in body) updates[field] = body[field];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Ingen felter aa oppdatere" },
        { status: 400 },
      );
    }

    updates.updated_at = new Date().toISOString();

    const updatedEstimate = await updateEstimate(client, estimateId, updates);
    return NextResponse.json(updatedEstimate);
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
