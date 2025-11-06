import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { supabase } from "@/lib/supabase";

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
    const { userId, installerGroupId, subject, body, messageId } =
      await req.json();

    if (!userId || !installerGroupId || !body) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get lead details
    const { data: lead, error: leadError } = await client
      .from("leads")
      .select("email, name")
      .eq("id", leadId)
      .single();

    if (leadError || !lead?.email) {
      return NextResponse.json(
        { error: "Lead not found or has no email" },
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

    let graphRes;
    let isReply = false;
    let sentMessageId: string | null = null;
    let conversationId: string | null = null;

    // If messageId is provided, this is a reply
    if (messageId) {
      isReply = true;

      // Get the original message details for conversation_id
      const { data: originalEmail } = await client
        .from("email_messages")
        .select("conversation_id")
        .eq("message_id", messageId)
        .single();

      conversationId = originalEmail?.conversation_id || null;

      // Create reply draft
      const replyUrl = `https://graph.microsoft.com/v1.0/me/messages/${messageId}/createReply`;
      const createReplyRes = await fetch(replyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!createReplyRes.ok) {
        const errorData = await createReplyRes.json().catch(() => ({}));
        console.error("Graph API create reply error:", errorData);
        return NextResponse.json(
          { error: "Failed to create reply", details: errorData },
          { status: createReplyRes.status }
        );
      }

      const draft = await createReplyRes.json();
      sentMessageId = draft.id;

      // Update draft with body
      const updateUrl = `https://graph.microsoft.com/v1.0/me/messages/${draft.id}`;
      const updateRes = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: { contentType: "HTML", content: body },
          toRecipients: [
            {
              emailAddress: {
                address: lead.email,
                name: lead.name,
              },
            },
          ],
        }),
      });

      if (!updateRes.ok) {
        const errorData = await updateRes.json().catch(() => ({}));
        console.error("Graph API update draft error:", errorData);
        return NextResponse.json(
          { error: "Failed to update reply", details: errorData },
          { status: updateRes.status }
        );
      }

      // Send the draft
      const sendUrl = `https://graph.microsoft.com/v1.0/me/messages/${draft.id}/send`;
      graphRes = await fetch(sendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
        },
      });
    } else {
      // New email
      if (!subject) {
        return NextResponse.json(
          { error: "Subject is required for new emails" },
          { status: 400 }
        );
      }

      const message = {
        message: {
          subject: subject,
          body: {
            contentType: "HTML",
            content: body,
          },
          toRecipients: [
            {
              emailAddress: {
                address: lead.email,
                name: lead.name,
              },
            },
          ],
        },
        saveToSentItems: true,
      };

      graphRes = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
    }

    if (!graphRes.ok) {
      const errorData = await graphRes.json().catch(() => ({}));
      console.error("Graph API send error:", errorData);
      return NextResponse.json(
        { error: "Failed to send email", details: errorData },
        { status: graphRes.status }
      );
    }

    // Store sent email in database immediately
    // For new emails, we need to wait a moment and fetch it from Graph API
    // For replies, we already have the message ID
    if (isReply && sentMessageId && conversationId) {
      try {
        await client.from("email_messages").insert({
          installer_group_id: installerGroupId,
          lead_id: leadId,
          message_id: sentMessageId,
          conversation_id: conversationId,
          subject: subject,
          from_address: account.email,
          to_addresses: [lead.email],
          body_preview: body.substring(0, 255),
          body: body,
          received_at: new Date().toISOString(),
          has_attachments: false,
        });
      } catch (error) {
        console.error("Error storing sent email:", error);
        // Don't fail the request if storage fails
      }
    }

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      {
        error: "Failed to send email",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
