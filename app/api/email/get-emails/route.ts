import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const installerGroupId = searchParams.get("installerGroupId") ?? null;

    if (!userId || !installerGroupId) {
      return Response.json(
        { error: "Mangler userId eller installerGroupId" },
        { status: 400 }
      );
    }

    const query = supabase
      .from("email_accounts")
      .select("access_token, refresh_token, expires_at, email")
      .eq("user_id", userId)
      .eq("installer_group_id", installerGroupId)
      .eq("provider", "outlook");

    if (installerGroupId && installerGroupId !== "null") {
      query.eq("installer_group_id", installerGroupId);
    }
    const { data: account, error } = await query.single();

    if (error || !account) {
      return Response.json(
        { error: "Fant ingen Outlook-tilkobling for brukeren", details: error },
        { status: 404 }
      );
    }

    /* const now = new Date();
    const expires = new Date(account.expires_at);
    if (expires < now) {
      return Response.json(
        { error: "Access token har utløpt, må fornyes" },
        { status: 401 }
      );
    } */

    const url = `https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc`;

    const graphRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
    });

    const graphData = await graphRes.json();

    if (!graphRes.ok) {
      console.error("Graph error:", graphData);
      return Response.json(
        { error: "Kunne ikke hente e-poster fra Outlook", details: graphData },
        { status: graphRes.status }
      );
    }

    return Response.json({
      success: true,
      count: graphData.value?.length || 0,
      mails: graphData.value ?? [],
    });
  } catch (error) {
    console.error("Feil ved henting av e-poster:", error);
    return Response.json(
      { error: "Ukjent feil ved henting av e-poster" },
      { status: 500 }
    );
  }
}
