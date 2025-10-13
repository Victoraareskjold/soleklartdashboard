import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { code, userId, installerGroupId } = await req.json();
    if (!code || !userId || !installerGroupId)
      return Response.json(
        { error: "Mangler kode eller brukerinfo" },
        { status: 400 }
      );

    const tokenUrl =
      "https://login.microsoftonline.com/common/oauth2/v2.0/token";

    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_OUTLOOK_CLIENT_ID!,
      client_secret: process.env.NEXT_PUBLIC_OUTLOOK_CLIENT_SECRET!,
      code,
      redirect_uri: process.env.NEXT_PUBLIC_OUTLOOK_REDIRECT_URI!,
      grant_type: "authorization_code",
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    console.log(response);

    const tokens = await response.json();

    if (!tokens.access_token)
      return Response.json(
        { error: "Kunne ikke hente token", details: tokens },
        { status: 500 }
      );

    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("email_accounts")
      .upsert({
        user_id: userId,
        installer_group_id: installerGroupId,
        provider: "outlook",
        email: tokens.id_token ? parseJwt(tokens.id_token)?.email : null,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        expires_at: expiresAt,
      })
      .select();

    if (error) throw error;

    return Response.json({ success: true, account: data[0] });
  } catch (error) {
    console.error("Outlook OAuth feil:", error);
    return Response.json(
      { error: "OAuth feilet", details: error },
      { status: 500 }
    );
  }
}

function parseJwt(token: string) {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
  } catch {
    return {};
  }
}
