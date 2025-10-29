import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { supabase } from "@/lib/supabase";
import { EmailContent } from "@/lib/types";

export async function POST(
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
    const { userId, installerGroupId, messageIds } = await req.json();

    if (!userId || !installerGroupId || !messageIds || !Array.isArray(messageIds)) {
      return NextResponse.json(
        { error: "Missing required fields or invalid messageIds" },
        { status: 400 }
      );
    }

    // Verify lead exists
    const { error: leadError } = await client
      .from("leads")
      .select("id")
      .eq("id", leadId)
      .single();

    if (leadError) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    // Get email account credentials
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("access_token, email")
      .eq("user_id", userId)
      .eq("installer_group_id", installerGroupId)
      .eq("provider", "outlook")
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: "No Outlook connection found for user" },
        { status: 404 }
      );
    }

    // Fetch email details for each message ID
    const emailContents: EmailContent[] = [];

    for (const messageId of messageIds) {
      try {
        const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}`;
        const graphRes = await fetch(url, {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            "Content-Type": "application/json",
          },
        });

        if (graphRes.ok) {
          const emailData = await graphRes.json();
          emailContents.push({
            id: emailData.id,
            conversationId: emailData.conversationId,
            subject: emailData.subject,
            from: emailData.from,
            toRecipients: emailData.toRecipients,
            bodyPreview: emailData.bodyPreview,
            body: emailData.body,
            receivedDateTime: emailData.receivedDateTime,
            sentDateTime: emailData.sentDateTime,
            hasAttachments: emailData.hasAttachments,
            isDraft: emailData.isDraft,
          });
        } else {
          console.error(`Failed to fetch message ${messageId}:`, await graphRes.text());
        }
      } catch (error) {
        console.error(`Error fetching message ${messageId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      emails: emailContents,
    });
  } catch (error) {
    console.error("Error fetching email threads:", error);
    return NextResponse.json(
      { error: "Failed to fetch email threads" },
      { status: 500 }
    );
  }
}
