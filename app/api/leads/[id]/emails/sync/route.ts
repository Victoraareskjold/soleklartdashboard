import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/utils/supabase/client";
import { supabase } from "@/lib/supabase";
import { syncLeadEmails } from "@/lib/db/leadEmails";
import { LeadEmail } from "@/lib/types";

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

    // Get lead details to get the email address
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

    // Get email account credentials
    const { data: account, error: accountError } = await supabase
      .from("email_accounts")
      .select("access_token, refresh_token, expires_at, email")
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

    // Fetch emails from Microsoft Graph API
    // Note: We'll fetch recent emails and filter by lead email address client-side
    // Complex OData filters with toRecipients/any() can be unreliable
    const url = `https://graph.microsoft.com/v1.0/me/messages?$top=100&$orderby=receivedDateTime desc`;

    const graphRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json",
      },
    });

    const graphData = await graphRes.json();

    if (!graphRes.ok) {
      console.error("Graph API error:", graphData);
      return NextResponse.json(
        { error: "Failed to fetch emails from Outlook", details: graphData },
        { status: graphRes.status }
      );
    }

    // Filter and transform emails related to this lead
    // Only store references (message_id, conversation_id, lead_id)
    const leadEmailLower = lead.email.toLowerCase();
    const emailsToSync: Omit<LeadEmail, "id" | "created_at">[] =
      graphData.value
        ?.filter((email: MicrosoftGraphEmail) => {
          // Check if lead email is in FROM or any TO recipients
          const fromAddress = email.from.emailAddress.address.toLowerCase();
          const toAddresses =
            email.toRecipients?.map((r) =>
              r.emailAddress.address.toLowerCase()
            ) || [];

          return (
            fromAddress === leadEmailLower ||
            toAddresses.includes(leadEmailLower)
          );
        })
        .map((email: MicrosoftGraphEmail) => ({
          lead_id: leadId,
          message_id: email.id,
          conversation_id: email.conversationId,
        })) || [];

    // Sync emails to database (upsert based on message_id)
    const syncedEmails = await syncLeadEmails(client, leadId, emailsToSync);

    return NextResponse.json({
      success: true,
      count: syncedEmails.length,
      emails: syncedEmails,
    });
  } catch (error) {
    console.error("Error syncing lead emails:", error);
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 }
    );
  }
}
