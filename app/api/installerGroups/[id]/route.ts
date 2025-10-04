import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getInstallerGroup } from "@/lib/db/installerGroups";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createSupabaseClient(token);
    const group = await getInstallerGroup(client, params.id);
    return NextResponse.json(group);
  } catch (err) {
    console.error("GET /api/installer-groups/[id] error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
