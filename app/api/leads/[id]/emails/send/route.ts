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

    // If messageId is provided, this is a reply to an existing message
    if (messageId) {
      isReply = true;
      console.log(`Creating reply to message: ${messageId}`);

      // Use the createReply endpoint for proper threading
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
      console.log(`Draft created with ID: ${draft.id}`);

      // Update the draft with our body content
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

      console.log(`Draft updated, now sending...`);

      // Send the draft
      const sendUrl = `https://graph.microsoft.com/v1.0/me/messages/${draft.id}/send`;
      graphRes = await fetch(sendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
        },
      });

      console.log(`Send response status: ${graphRes.status}`);
    } else {
      // New email - use sendMail endpoint
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

    // Don't store email in database - let the sync process handle it
    // This prevents duplicates and ensures we always have the real Microsoft IDs

    console.log(`Email ${isReply ? "reply" : "message"} sent successfully`);

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
