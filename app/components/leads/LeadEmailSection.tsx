"use client";
import { useEffect, useState } from "react";
import { EmailContent, Estimate } from "@/lib/types";
import { sendLeadEmail, syncLeadEmails, getStoredLeadEmails } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { toast } from "react-toastify";
import mailTemplates from "@/constants/mailTemplates.json";

interface LeadEmailSectionProps {
  leadId: string;
  leadEmail?: string;
  newEstimate?: Estimate | null;
  leadName?: string;
  domain?: string;
  estimates?: Estimate[];
}

interface EmailThread {
  conversationId: string;
  emails: EmailContent[];
  lastDate: string;
  subject: string;
}

export default function LeadEmailSection({
  leadId,
  leadEmail,
  newEstimate,
  leadName,
  domain,
  estimates,
}: LeadEmailSectionProps) {
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const { installerGroupId } = useInstallerGroup();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (leadId && installerGroupId) {
      fetchEmails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, installerGroupId]);

  useEffect(() => {
    if (newEstimate && leadName && domain) {
      const template = mailTemplates.newEstimate;
      const estimateLink = `https://www.${domain}.no/estimat/${newEstimate.id}`;

      const emailSubject = template.subject;
      const emailBody = template.body
        .replace("{leadName}", leadName)
        .replace("{estimateLink}", estimateLink);

      setSubject(emailSubject);
      setBody(emailBody);
      setShowCompose(true);
    }
  }, [newEstimate, leadName, domain]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateKey = e.target.value;
    if (!templateKey) {
      setSubject("");
      setBody("");
      return;
    }

    const template = mailTemplates[templateKey as keyof typeof mailTemplates];
    if (!template) return;

    let emailBody = template.body;
    if (leadName) {
      emailBody = emailBody.replace(/{leadName}/g, leadName);
    }

    if (emailBody.includes("{estimateLink}")) {
      const sortedEstimates = estimates?.sort(
        (a, b) =>
          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime()
      );
      const latestEstimate = sortedEstimates?.[0];
      if (latestEstimate && domain) {
        const estimateLink = `https://www.${domain}.no/estimat/${latestEstimate.id}`;
        emailBody = emailBody.replace(/{estimateLink}/g, estimateLink);
      } else {
        toast.warn(
          "Kan ikke fylle ut estimatlenke. Ingen estimater funnet for denne leaden."
        );
        emailBody = emailBody.replace(
          /{estimateLink}/g,
          "[MANGLER ESTMATLENKE]"
        );
      }
    }

    setSubject(template.subject);
    setBody(emailBody);
  };

  const fetchEmails = async () => {
    if (!installerGroupId) return;
    setLoading(true);
    try {
      // Fetch from database - no Outlook auth needed
      const response = await getStoredLeadEmails(leadId, installerGroupId);

      if (response.success) {
        organizeEmailsIntoThreads(response.emails);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
      toast.error("Kunne ikke hente e-poster");
    } finally {
      setLoading(false);
    }
  };

  const organizeEmailsIntoThreads = (emails: EmailContent[]) => {
    // Group by conversation_id
    const threadMap: { [key: string]: EmailContent[] } = {};

    emails.forEach((email) => {
      if (!threadMap[email.conversation_id]) {
        threadMap[email.conversation_id] = [];
      }
      threadMap[email.conversation_id].push(email);
    });

    // Convert to array and sort
    const threads: EmailThread[] = Object.entries(threadMap).map(
      ([conversationId, threadEmails]) => {
        // Sort emails within thread by date
        const sortedEmails = threadEmails.sort((a, b) => {
          const dateA = new Date(a.received_at || "").getTime();
          const dateB = new Date(b.received_at || "").getTime();
          return dateA - dateB;
        });

        return {
          conversationId,
          emails: sortedEmails,
          lastDate: sortedEmails[sortedEmails.length - 1]?.received_at || "",
          subject: sortedEmails[0]?.subject || "Ingen emne",
        };
      }
    );

    // Sort threads by last message date (newest first)
    threads.sort((a, b) => {
      return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
    });

    setEmailThreads(threads);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !installerGroupId) {
        toast.error("Du må være logget inn for å synkronisere");
        return;
      }

      // Check if user has Outlook connected
      const { data: account } = await supabase
        .from("email_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("installer_group_id", installerGroupId)
        .eq("provider", "outlook")
        .maybeSingle();

      if (!account) {
        toast.error("Du må koble til Outlook for å synkronisere");
        return;
      }

      const response = await syncLeadEmails(leadId, user.id, installerGroupId);

      if (response.success) {
        toast.success(`Synkronisert ${response.count} e-poster`);
        // Refresh the list
        await fetchEmails();
      }
    } catch (error) {
      console.error("Error syncing emails:", error);
      toast.error("Kunne ikke synkronisere e-poster");
    } finally {
      setSyncing(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!body.trim()) {
      toast.error("Innhold er påkrevd");
      return;
    }

    if (!replyToMessageId && !subject.trim()) {
      toast.error("Emne er påkrevd for nye e-poster");
      return;
    }

    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !installerGroupId) {
        toast.error("Du må være logget inn for å sende e-post");
        return;
      }

      // Check if user has Outlook connected
      const { data: account } = await supabase
        .from("email_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("installer_group_id", installerGroupId)
        .eq("provider", "outlook")
        .maybeSingle();

      if (!account) {
        toast.error("Du må koble til Outlook for å sende e-post");
        return;
      }

      const emailBodyHtml = body.replace(/\n/g, "<br />");

      const response = await sendLeadEmail(
        leadId,
        user.id,
        installerGroupId,
        subject,
        emailBodyHtml,
        replyToMessageId || undefined
      );

      if (response.success) {
        toast.success("E-post sendt!");
        setSubject("");
        setBody("");
        setShowCompose(false);
        setReplyToMessageId(null);

        // Refresh to show the sent email
        await fetchEmails();
        await handleSync();
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Kunne ikke sende e-post");
    } finally {
      setSending(false);
    }
  };

  const handleReply = (thread: EmailThread) => {
    const lastEmail = thread.emails[thread.emails.length - 1];
    setReplyToMessageId(lastEmail.message_id);

    // Set subject with Re: prefix
    const cleanSubject = thread.subject.replace(/^(Re:\s*)+/i, "");
    setSubject(`Re: ${cleanSubject}`);

    setShowCompose(true);
  };

  if (!leadEmail) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-sm text-yellow-800">
          Denne leaden har ingen e-postadresse registrert. Legg til en
          e-postadresse for å sende og motta e-poster.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-600">Laster e-poster...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 mx-auto">
        {/* Header with actions */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">E-postkorrespondanse</h3>
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
            >
              {syncing ? "Synkroniserer..." : "Synkroniser"}
            </button>
            <button
              onClick={() => {
                setShowCompose(!showCompose);
                setReplyToMessageId(null);
                setSubject("");
                setBody("");
              }}
              className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              Ny e-post
            </button>
          </div>
        </div>

        {/* Compose email form */}
        {showCompose && (
          <div className="bg-white border border-gray-300 rounded-md p-4 shadow-sm">
            <h4 className="font-medium mb-3">
              {replyToMessageId ? "Svar på e-post" : "Send ny e-post"}
            </h4>

            <form onSubmit={handleSendEmail} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Til
                </label>
                <input
                  type="text"
                  value={leadEmail}
                  disabled
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emne
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="E-postemne"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Melding
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Skriv din melding her..."
                  rows={8}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex flex-row justify-between items-center">
                <div>
                  <select
                    onChange={handleTemplateChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Velg en mal...</option>
                    {Object.entries(mailTemplates).map(([key, template]) => (
                      <option key={key} value={key}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCompose(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                  >
                    {sending ? "Sender..." : "Send"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Email threads */}
        {emailThreads.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-md">
            <p className="text-gray-500 mb-2">Ingen e-poster funnet</p>
            <p className="text-sm text-gray-400">
              Klikk &quot;Synkroniser&quot; for å hente e-poster fra Outlook
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {emailThreads.map((thread) => (
              <div
                key={thread.conversationId}
                className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden"
              >
                {/* Thread header */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {thread.subject}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {thread.emails.length} melding
                        {thread.emails.length > 1 ? "er" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleReply(thread)}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Svar
                    </button>
                  </div>
                </div>

                {/* Thread emails */}
                <div className="divide-y divide-gray-100">
                  {thread.emails.map((email) => {
                    const isSentByMe =
                      email.from_address?.toLowerCase() !==
                      leadEmail?.toLowerCase();

                    return (
                      <div key={email.id} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 text-xs rounded ${
                                  isSentByMe
                                    ? "bg-green-100 text-green-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {isSentByMe ? "Sendt" : "Mottatt"}
                              </span>
                              <span className="text-sm font-medium text-gray-900">
                                {isSentByMe
                                  ? `Til: ${
                                      email.to_addresses?.[0] || leadEmail
                                    }`
                                  : `Fra: ${email.from_address || "Ukjent"}`}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(email.received_at || "").toLocaleString(
                                "nb-NO",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </p>
                          </div>
                        </div>
                        <div
                          className="text-sm text-gray-700 whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{
                            __html:
                              email.body ||
                              email.body_preview ||
                              "Ingen innhold",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
