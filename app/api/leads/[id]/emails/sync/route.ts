import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { getRefreshedEmailAccount } from "@/lib/graph";

interface MicrosoftGraphEmail {
  id: string;
  conversationId: string;
  subject: string;
  from: {
    emailAddress: {
      name?: string;
      address: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      name?: string;
      address: string;
    };
  }>;
  bodyPreview: string;
  body?: {
    contentType: string;
    content: string;
  };
  receivedDateTime: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
}

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
    const { userId, installerGroupId } = await req.json();

    if (!userId || !installerGroupId) {
      return NextResponse.json(
        { error: "Missing userId or installerGroupId" },
        { status: 400 }
      );
    }

    // Get lead details
    const { data: lead, error: leadError } = await client
      .from("leads")
      .select("email")
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

    // Fetch emails from Microsoft Graph API
    const url = `https://graph.microsoft.com/v1.0/me/messages?$top=100&$orderby=receivedDateTime desc`;

    const graphRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!graphRes.ok) {
      const graphData = await graphRes.json();
      console.error("Graph API error:", graphData);
      return NextResponse.json(
        { error: "Failed to fetch emails from Outlook", details: graphData },
        { status: graphRes.status }
      );
    }

    const graphData = await graphRes.json();

    // Filter emails related to this lead
    const leadEmailLower = lead.email.toLowerCase();
    const relevantEmails =
      graphData.value?.filter((email: MicrosoftGraphEmail) => {
        const fromAddress = email.from.emailAddress.address.toLowerCase();
        const toAddresses =
          email.toRecipients?.map((r) =>
            r.emailAddress.address.toLowerCase()
          ) || [];

        return (
          fromAddress === leadEmailLower || toAddresses.includes(leadEmailLower)
        );
      }) || [];

    // Transform to database format
    const emailsToStore = relevantEmails.map((email: MicrosoftGraphEmail) => ({
      installer_group_id: installerGroupId,
      lead_id: leadId,
      message_id: email.id,
      conversation_id: email.conversationId,
      subject: email.subject || "(Ingen emne)",
      from_address: email.from.emailAddress.address,
      to_addresses:
        email.toRecipients?.map((r) => r.emailAddress.address) || [],
      body_preview: email.bodyPreview || "",
      body: email.body?.content || "",
      received_at: email.receivedDateTime || email.sentDateTime,
      has_attachments: email.hasAttachments || false,
    }));

    if (emailsToStore.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
      });
    }

    // Upsert to database (avoids duplicates based on message_id unique constraint)
    const { data, error: upsertError } = await client
      .from("email_messages")
      .upsert(emailsToStore, {
        onConflict: "message_id",
        ignoreDuplicates: false,
      })
      .select();

    if (upsertError) {
      console.error("Error upserting emails:", upsertError);
      return NextResponse.json(
        { error: "Failed to store emails in database" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
    });
  } catch (error) {
    console.error("Error syncing lead emails:", error);
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 }
    );
  }
}
