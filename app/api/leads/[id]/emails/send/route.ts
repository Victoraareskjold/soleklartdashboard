import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getRefreshedEmailAccount } from "@/lib/graph";

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
      .select("email, person_info")
      .eq("id", leadId)
      .single();

    if (leadError || !lead?.email) {
      return NextResponse.json(
        { error: "Lead not found or has no email" },
        { status: 404 }
      );
    }

    // Get email account credentials, refreshing if necessary
    const account = await getRefreshedEmailAccount(userId, installerGroupId);

    if (!account) {
      return NextResponse.json(
        {
          error:
            "No valid Outlook connection found for user. Please reconnect on the profile page.",
        },
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
                name: lead.person_info,
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
                name: lead.person_info,
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
