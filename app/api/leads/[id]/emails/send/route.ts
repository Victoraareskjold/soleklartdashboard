import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { supabase } from "@/lib/supabase";
import { createLeadEmail } from "@/lib/db/leadEmails";

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
    const { userId, installerGroupId, subject, body, conversationId } =
      await req.json();

    if (!userId || !installerGroupId || !subject || !body) {
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

    // Prepare email message
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

    // Send email via Microsoft Graph API
    const graphUrl = "https://graph.microsoft.com/v1.0/me/sendMail";
    const graphRes = await fetch(graphUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!graphRes.ok) {
      const errorData = await graphRes.json();
      console.error("Graph API send error:", errorData);
      return NextResponse.json(
        { error: "Failed to send email", details: errorData },
        { status: graphRes.status }
      );
    }

    // Store the sent email in our database
    const sentDate = new Date().toISOString();
    const emailRecord = await createLeadEmail(client, {
      lead_id: leadId,
      message_id: `sent-${Date.now()}`, // Temporary ID until we sync
      conversation_id: conversationId || `conv-${Date.now()}`,
      subject: subject,
      from_address: account.email,
      to_address: lead.email,
      to_name: lead.name,
      body_preview: body.substring(0, 200), // First 200 chars
      body_content: body,
      sent_date: sentDate,
      is_sent: true,
      has_attachments: false,
    });

    return NextResponse.json({
      success: true,
      email: emailRecord,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
