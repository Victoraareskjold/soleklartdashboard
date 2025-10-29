"use client";
import { useEffect, useState } from "react";
import { LeadEmail, EmailContent } from "@/lib/types";
import { sendLeadEmail, syncLeadEmails, fetchEmailThreads } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { toast } from "react-toastify";

interface LeadEmailSectionProps {
  leadId: string;
  leadEmail?: string;
}

interface EmailThread {
  conversationId: string;
  messageIds: string[];
  emailContents: EmailContent[];
  lastDate: string;
}

export default function LeadEmailSection({
  leadId,
  leadEmail,
}: LeadEmailSectionProps) {
  const [emailReferences, setEmailReferences] = useState<LeadEmail[]>([]);
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null
  );
  const [showCompose, setShowCompose] = useState(false);
  const { installerGroupId } = useInstallerGroup();

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (leadId) {
      fetchEmails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  // Group email references by conversation_id and fetch all content
  useEffect(() => {
    const threads: { [key: string]: LeadEmail[] } = {};

    emailReferences.forEach((email) => {
      if (!threads[email.conversation_id]) {
        threads[email.conversation_id] = [];
      }
      threads[email.conversation_id].push(email);
    });

    const threadArray: EmailThread[] = Object.entries(threads).map(
      ([conversationId, threadEmails]) => {
        // Sort by created_at (when we stored the reference)
        const sortedEmails = threadEmails.sort((a, b) => {
          const dateA = new Date(a.created_at || "").getTime();
          const dateB = new Date(b.created_at || "").getTime();
          return dateA - dateB;
        });

        return {
          conversationId,
          messageIds: sortedEmails.map((e) => e.message_id),
          emailContents: [], // Will be fetched immediately
          lastDate: sortedEmails[sortedEmails.length - 1]?.created_at || "",
        };
      }
    );

    // Sort threads by last date
    threadArray.sort((a, b) => {
      return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
    });

    setEmailThreads(threadArray);

    // Fetch content for all threads immediately
    if (threadArray.length > 0) {
      fetchAllThreadsContent(threadArray);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailReferences, leadId, installerGroupId]);

  // Fetch content for all threads at once
  const fetchAllThreadsContent = async (threads: EmailThread[]) => {
    setLoadingContent(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !installerGroupId) {
        return;
      }

      // Collect all message IDs from all threads
      const allMessageIds = threads.flatMap((t) => t.messageIds);

      if (allMessageIds.length === 0) {
        return;
      }

      const response = await fetchEmailThreads(
        leadId,
        user.id,
        installerGroupId,
        allMessageIds
      );

      if (response.success) {
        // Group fetched emails by conversation ID
        const contentByConversation: { [key: string]: EmailContent[] } = {};
        response.emails.forEach((email) => {
          if (!contentByConversation[email.conversationId]) {
            contentByConversation[email.conversationId] = [];
          }
          contentByConversation[email.conversationId].push(email);
        });

        // Update all threads with their content
        setEmailThreads((prevThreads) =>
          prevThreads.map((t) => {
            const contents = contentByConversation[t.conversationId] || [];
            return {
              ...t,
              emailContents: contents.sort((a, b) => {
                const dateA = new Date(
                  a.receivedDateTime || a.sentDateTime || ""
                ).getTime();
                const dateB = new Date(
                  b.receivedDateTime || b.sentDateTime || ""
                ).getTime();
                return dateA - dateB;
              }),
            };
          })
        );
      }
    } catch (error) {
      console.error("Error fetching all thread content:", error);
      toast.error("Kunne ikke hente e-postinnhold");
    } finally {
      setLoadingContent(false);
    }
  };

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !installerGroupId) {
        toast.error("Mangler brukerinformasjon");
        return;
      }

      const response = await syncLeadEmails(leadId, user.id, installerGroupId);
      if (response.success) {
        setEmailReferences(response.emails);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
      toast.error("Kunne ikke hente e-poster");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !installerGroupId) {
        toast.error("Mangler brukerinformasjon");
        return;
      }

      const response = await syncLeadEmails(leadId, user.id, installerGroupId);
      if (response.success) {
        setEmailReferences(response.emails);
        toast.success(`Synkronisert ${response.count} e-poster`);
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

    if (!selectedMessageId && !subject.trim()) {
      toast.error("Emne er påkrevd for nye e-poster");
      return;
    }

    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !installerGroupId) {
        toast.error("Mangler brukerinformasjon");
        return;
      }

      console.log("Sending email with:", {
        leadId,
        userId: user.id,
        installerGroupId,
        subject,
        messageId: selectedMessageId,
        isReply: !!selectedMessageId,
      });

      const response = await sendLeadEmail(
        leadId,
        user.id,
        installerGroupId,
        subject,
        body,
        selectedMessageId || undefined
      );

      console.log("Send response:", response);

      if (response.success) {
        toast.success("E-post sendt!");
        setSubject("");
        setBody("");
        setShowCompose(false);
        setSelectedMessageId(null);

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
    // Get the last message ID to reply to
    const lastMessageId = thread.messageIds[thread.messageIds.length - 1];
    console.log("Reply to message ID:", lastMessageId);
    console.log("Thread message IDs:", thread.messageIds);
    setSelectedMessageId(lastMessageId);

    // Set subject based on the first email in the thread
    const firstEmail = thread.emailContents[0];
    if (firstEmail) {
      const cleanSubject = firstEmail.subject.replace(/^(Re:\s*)+/i, "");
      setSubject(`Re: ${cleanSubject}`);
    }

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
    <div className="space-y-4">
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
              setSelectedMessageId(null);
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
            {selectedMessageId ? "Svar på e-post" : "Send ny e-post"}
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
            <div className="flex gap-2 justify-end">
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
          {emailThreads.map((thread) => {
            const hasContent = thread.emailContents.length > 0;
            const firstEmail = thread.emailContents[0];

            return (
              <div
                key={thread.conversationId}
                className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden"
              >
                {/* Thread header */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">
                        {hasContent && firstEmail
                          ? firstEmail.subject
                          : "Laster..."}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {thread.messageIds.length} melding
                        {thread.messageIds.length > 1 ? "er" : ""}
                        {/* {thread.messageIds.length > 1 ? "er" : ""} • Siste:{" "}
                        {new Date(thread.lastDate).toLocaleDateString("nb-NO", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })} */}
                      </p>
                    </div>
                    <button
                      onClick={() => handleReply(thread)}
                      disabled={!hasContent}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      Svar
                    </button>
                  </div>
                </div>

                {/* Thread emails - only show if content is loaded */}
                {hasContent && (
                  <div className="divide-y divide-gray-100">
                    {thread.emailContents.map((email) => {
                      const isSentByMe =
                        email.from.emailAddress.address.toLowerCase() !==
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
                                        email.toRecipients[0]?.emailAddress
                                          .name ||
                                        email.toRecipients[0]?.emailAddress
                                          .address
                                      }`
                                    : `Fra: ${
                                        email.from.emailAddress.name ||
                                        email.from.emailAddress.address
                                      }`}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(
                                  email.receivedDateTime ||
                                    email.sentDateTime ||
                                    ""
                                ).toLocaleString("nb-NO", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {email.bodyPreview}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Loading indicator */}
                {!hasContent && loadingContent && (
                  <div className="p-4 text-center text-gray-500">
                    Laster e-postinnhold...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
