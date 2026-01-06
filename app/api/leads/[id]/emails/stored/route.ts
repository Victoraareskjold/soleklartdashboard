import { createSupabaseClient } from "@/utils/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = createSupabaseClient(token);
    const { id: leadId } = await params;

    const searchParams = req.nextUrl.searchParams;
    const installerGroupId = searchParams.get("installerGroupId");

    if (!installerGroupId) {
      return NextResponse.json(
        { error: "installerGroupId is required" },
        { status: 400 }
      );
    }

    // Fetch all emails for this lead from database
    const { data, error } = await client
      .from("email_messages")
      .select("*, cc_addresses, attachments:email_attachments(*)")
      .eq("lead_id", leadId)
      .eq("installer_group_id", installerGroupId)
      .order("received_at", { ascending: false });

    if (error) {
      console.error("Error fetching stored emails:", error);
      return NextResponse.json(
        { error: "Failed to fetch emails" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, emails: data || [] });
  } catch (error) {
    console.error("Error in stored emails route:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
