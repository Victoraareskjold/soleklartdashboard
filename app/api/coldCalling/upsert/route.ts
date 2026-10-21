import { createSupabaseAdminClient } from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import {
  shouldPurgeImages,
  purgeEstimateImagesForLeads,
} from "@/lib/storage/estimateImages";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const leads = body;

    if (!leads || !leads.length) {
      return NextResponse.json({ error: "Ingen leads sendt" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const results = [];
    for (const lead of leads) {
      const {
        id,
        email,
        note,
        roof_type_id,
        own_consumption,
        voltage,
        roof_slope,
        roof_age,
        status,
      } = lead;

      if (
        !id ||
        /* !email ||
        !roof_type_id ||
        !own_consumption ||
        !voltage ||
        !roof_age || */
        !status
      ) {
        return NextResponse.json(
          { error: `Mangler parametere for lead ${id || "ukjent"}` },
          { status: 400 },
        );
      }

      const { data, error } = await supabase
        .from("leads")
        .update({
          email,
          note,
          roof_type_id,
          own_consumption,
          voltage,
          roof_slope,
          roof_age,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select();

      if (error) {
        console.error("Supabase error:", error);
        return NextResponse.json(
          { error: `Feil ved lagring av lead ${id}` },
          { status: 500 },
        );
      }

      results.push(data[0]);
    }

    // «Ikke interessert» / «Nyhetsbrev» → slett estimatbildene for å spare plass i storage.
    const notInterestedIds = leads
      .filter((l: { id?: string; status?: number }) => l.id && shouldPurgeImages(l.status))
      .map((l: { id: string }) => l.id);
    if (notInterestedIds.length) {
      try {
        const res = await purgeEstimateImagesForLeads(supabase, notInterestedIds);
        if (res.errors.length) console.error("purgeEstimateImages errors:", res.errors);
      } catch (e) {
        console.error("purgeEstimateImages failed:", e);
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      message: `${results.length} leads oppdatert`,
      leads: results,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
