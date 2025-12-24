import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";

// GET /api/estimates?lead_id=...
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const leadId = req.nextUrl.searchParams.get("lead_id");
    if (!leadId)
      return NextResponse.json({ error: "Missing lead_id" }, { status: 400 });

    const client = createSupabaseClient(token);

    const { data, error } = await client
      .from("estimates")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/estimates error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST /api/estimates/
export async function POST(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);
    const { lead_id, solarData, price_data, imageUrl } = await req.json();

    if (!lead_id) {
      return NextResponse.json({ error: "Missing lead_id" }, { status: 400 });
    }

    const newEstimate = {
      lead_id: lead_id,
      price_data,
      image_url: imageUrl,
      total_panels: solarData.totalPanels,
      selected_panel_type: solarData.selectedPanelType,
      selected_roof_type: solarData.selectedRoofType,
      checked_roof_data: solarData.checkedRoofData,
      selected_el_price: solarData.selectedElPrice,
      yearly_cost: solarData.yearlyCost,
      yearly_cost2: solarData.yearlyCost2,
      yearly_prod: solarData.yearlyProd,
      desired_kwh: solarData.desiredKwh,
      coverage_percentage: solarData.coveragePercentage,
    };

    const { data, error } = await client
      .from("estimates")
      .insert(newEstimate)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("POST /api/estimates error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
