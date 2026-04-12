import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getLeads } from "@/lib/db/leads";
import { Lead } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const teamId = url.searchParams.get("teamId");
    const installerGroupId = url.searchParams.get("installerGroupId");
    const teamRole = url.searchParams.get("teamRole");

    if (!teamId || !installerGroupId || !teamRole) {
      return NextResponse.json(
        { error: "Missing teamId or installerGroupId parameter" },
        { status: 400 }
      );
    }

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = createSupabaseClient(token);
    const leads = await getLeads(client, teamId, installerGroupId);

    if (teamRole === "installer") {
      return NextResponse.json(
        leads.filter((lead) => lead.installer_group_id === installerGroupId) ??
          []
      );
    }
    return NextResponse.json(leads ?? []);
  } catch (err) {
    console.error("GET /api/leads error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

function detectLeadSource(note: string | null | undefined): string {
  if (!note || !note.includes("Tracking:")) return "cold_call";
  if (/fbclid:\s*\S/.test(note)) return "facebook";
  if (/gclid:\s*\S/.test(note)) return "google";
  return "organic";
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);
    const leadData: Lead = await req.json();

    // Stamp source if not already set by the caller
    if (!leadData.lead_source) {
      leadData.lead_source = detectLeadSource(leadData.note);
    }

    const { data, error } = await client
      .from("leads")
      .insert(leadData)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("POST /api/leads error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
