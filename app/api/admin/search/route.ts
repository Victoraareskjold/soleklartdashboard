import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const teamId = url.searchParams.get("teamId");
    const q = url.searchParams.get("q")?.trim();

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!teamId || !q || q.length < 2)
      return NextResponse.json({ results: [] });

    const client = createSupabaseClient(token);

    const { data, error } = await client
      .from("leads")
      .select(
        "id, person_info, address, phone, mobile, email, company, status, installer_group_id, assigned_to, updated_price, created_at"
      )
      .eq("team_id", teamId)
      .or(
        [
          `person_info.ilike.%${q}%`,
          `address.ilike.%${q}%`,
          `phone.ilike.%${q}%`,
          `mobile.ilike.%${q}%`,
          `email.ilike.%${q}%`,
          `company.ilike.%${q}%`,
          `org_nr.ilike.%${q}%`,
        ].join(",")
      )
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    // Fetch installer group names for the results
    const groupIds = [...new Set((data || []).map((l) => l.installer_group_id).filter(Boolean))];
    const groupNameMap: Record<string, string> = {};
    if (groupIds.length > 0) {
      const { data: groups } = await client
        .from("installer_groups")
        .select("id, name")
        .in("id", groupIds);
      (groups || []).forEach((g) => {
        groupNameMap[g.id] = g.name;
      });
    }

    const results = (data || []).map((l) => ({
      ...l,
      installerGroupName: groupNameMap[l.installer_group_id] || null,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("GET /api/admin/search error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
