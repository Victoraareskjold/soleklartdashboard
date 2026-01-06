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
    const {
      userId,
      installerGroupId,
      subject,
      body,
      messageId, // This is the message_id of the email we are replying to
      attachments,
    } = await req.json();

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

    const isReply = !!messageId;
    const hasAttachments = attachments && attachments.length > 0;
    let conversationId: string | null = null;
    let draftMessage: any;

    const graphAttachments =
      attachments?.map((att: any) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: att.name,
        contentType: att.contentType,
        contentBytes: att.contentBytes,
      })) || [];

    // --- 1. Create a draft ---
    if (isReply) {
      const { data: originalEmail } = await client
        .from("email_messages")
        .select("conversation_id")
        .eq("message_id", messageId)
        .single();
      conversationId = originalEmail?.conversation_id || null;

      const createReplyRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/messages/${messageId}/createReply`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${account.access_token}` },
        }
      );
      if (!createReplyRes.ok) {
        console.error("Graph API create reply draft error:", await createReplyRes.json());
        throw new Error("Failed to create reply draft in Outlook.");
      }
      draftMessage = await createReplyRes.json();
    } else {
      // New email: Create the draft with the full payload at once.
      if (!subject) {
        return NextResponse.json(
          { error: "Subject is required for new emails" },
          { status: 400 }
        );
      }
      const draftPayload = {
        subject: subject,
        body: { contentType: "HTML", content: body },
        toRecipients: [
          { emailAddress: { address: lead.email, name: lead.person_info } },
        ],
        attachments: hasAttachments ? graphAttachments : undefined,
      };

      const createDraftRes = await fetch(
        "https://graph.microsoft.com/v1.0/me/messages",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${account.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draftPayload),
        }
      );
      if (!createDraftRes.ok) {
        console.error("Graph API create draft error:", await createDraftRes.json());
        throw new Error("Failed to create draft in Outlook.");
      }
      draftMessage = await createDraftRes.json();
    }

    const sentMessageId = draftMessage.id;

    // --- 2. Update draft (only needed for replies now) ---
    if (isReply) {
      const updateUrl = `https://graph.microsoft.com/v1.0/me/messages/${sentMessageId}`;
      const updatePayload = {
        // For replies, we only need to patch the body and attachments,
        // as createReply pre-fills the rest.
        body: { contentType: "HTML", content: body },
        attachments: hasAttachments ? graphAttachments : undefined,
      };

      const updateRes = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      if (!updateRes.ok) {
        console.error("Graph API update draft error:", await updateRes.json());
        throw new Error("Failed to update reply draft in Outlook.");
      }
    }

    // --- 3. Send the draft ---
    const sendUrl = `https://graph.microsoft.com/v1.0/me/messages/${sentMessageId}/send`;
    const graphRes = await fetch(sendUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${account.access_token}` },
    });

    if (!graphRes.ok) {
       console.error("Graph API send error:", await graphRes.json());
      throw new Error("Failed to send email from Outlook.");
    }

    // --- 4. Store email and attachments in DB ---
    if (!isReply) {
       // Wait a moment for eventual consistency, then fetch the conversationId
       await new Promise(resolve => setTimeout(resolve, 3000));
       const getMsgRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${sentMessageId}?$select=conversationId`, {
           headers: { Authorization: `Bearer ${account.access_token}` },
       });
       if (getMsgRes.ok) {
           const sentMessageDetails = await getMsgRes.json();
           conversationId = sentMessageDetails.conversationId;
       } else {
           console.warn(`Could not fetch conversationId for sent message ${sentMessageId}`);
       }
    }
    
    // Insert email message into our DB
    const { data: dbEmail, error: insertError } = await client
      .from("email_messages")
      .insert({
        installer_group_id: installerGroupId,
        lead_id: leadId,
        message_id: sentMessageId,
        conversation_id: conversationId,
        subject: subject,
        from_address: account.email,
        to_addresses: [lead.email],
        body: body,
        body_preview: body.substring(0, 255).replace(/<[^>]*>?/gm, ''),
        received_at: new Date().toISOString(),
        has_attachments: hasAttachments,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error storing sent email in DB:", insertError);
      // Don't fail the whole request, but log it.
    } else if (dbEmail && hasAttachments) {
      // Upload attachments to Supabase Storage and link them
      const uploadedAttachments = await Promise.all(
        attachments.map(async (att: any) => {
          try {
            const buffer = Buffer.from(att.contentBytes, "base64");
            const filePath = `${leadId}/${sentMessageId}/${att.name}`;

            const { error: uploadError } = await client.storage
              .from("email-attachments")
              .upload(filePath, buffer, {
                contentType: att.contentType,
                upsert: true,
              });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = client.storage
              .from("email-attachments")
              .getPublicUrl(filePath);
            
            return {
              email_message_id: dbEmail.id,
              file_name: att.name,
              file_url: publicUrlData.publicUrl,
              file_type: att.contentType,
            };
          } catch(uploadError) {
            console.error(`Attachment upload/linking failed for ${att.name}:`, uploadError);
            return null;
          }
        })
      );

      const validAttachments = uploadedAttachments.filter((att) => att !== null);
      if (validAttachments.length > 0) {
        const { error: attInsertError } = await client
          .from("email_attachments")
          .insert(validAttachments);
        if (attInsertError) {
          console.error("Error storing email attachment metadata:", attInsertError);
        }
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
