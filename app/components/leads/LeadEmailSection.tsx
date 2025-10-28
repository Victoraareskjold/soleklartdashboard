"use client";
import { useEffect, useState } from "react";
import { LeadEmail } from "@/lib/types";
import { getLeadEmails, sendLeadEmail, syncLeadEmails } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { toast } from "react-toastify";

interface LeadEmailSectionProps {
  leadId: string;
  leadEmail?: string;
}

interface EmailThread {
  conversationId: string;
  subject: string;
  emails: LeadEmail[];
  lastDate: string;
}

export default function LeadEmailSection({
  leadId,
  leadEmail,
}: LeadEmailSectionProps) {
  const [emails, setEmails] = useState<LeadEmail[]>([]);
  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const { installerGroupId } = useInstallerGroup();

  // Compose email state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (leadId) {
      fetchEmails();
    }
  }, [leadId]);

  useEffect(() => {
    // Group emails into threads
    const threads: { [key: string]: LeadEmail[] } = {};

    emails.forEach((email) => {
      if (!threads[email.conversation_id]) {
        threads[email.conversation_id] = [];
      }
      threads[email.conversation_id].push(email);
    });

    // Convert to array and sort
    const threadArray: EmailThread[] = Object.entries(threads).map(
      ([conversationId, threadEmails]) => {
        const sortedEmails = threadEmails.sort((a, b) => {
          const dateA = new Date(
            a.received_date || a.sent_date || ""
          ).getTime();
          const dateB = new Date(
            b.received_date || b.sent_date || ""
          ).getTime();
          return dateA - dateB; // Ascending order (oldest first in thread)
        });

        return {
          conversationId,
          subject: sortedEmails[0]?.subject || "No Subject",
          emails: sortedEmails,
          lastDate:
            sortedEmails[sortedEmails.length - 1]?.received_date ||
            sortedEmails[sortedEmails.length - 1]?.sent_date ||
            "",
        };
      }
    );

    // Sort threads by most recent email
    threadArray.sort((a, b) => {
      return new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime();
    });

    setEmailThreads(threadArray);
  }, [emails]);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const response = await getLeadEmails(leadId);
      if (response.success) {
        setEmails(response.emails);
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
        setEmails(response.emails);
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

    if (!subject.trim() || !body.trim()) {
      toast.error("Emne og innhold er påkrevd");
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

      const conversationId = selectedThread || undefined;

      const response = await sendLeadEmail(
        leadId,
        user.id,
        installerGroupId,
        subject,
        body,
        conversationId
      );

      if (response.success) {
        toast.success("E-post sendt!");
        setSubject("");
        setBody("");
        setShowCompose(false);

        // Add the sent email to the list
        setEmails((prev) => [response.email, ...prev]);
      }
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Kunne ikke sende e-post");
    } finally {
      setSending(false);
    }
  };

  const handleReply = (thread: EmailThread) => {
    setSelectedThread(thread.conversationId);
    setSubject(`Re: ${thread.subject}`);
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
              setSelectedThread(null);
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
            {selectedThread ? "Svar på e-post" : "Send ny e-post"}
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
          {emailThreads.map((thread) => (
            <div
              key={thread.conversationId}
              className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden"
            >
              {/* Thread header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{thread.subject}</h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {thread.emails.length} melding{thread.emails.length > 1 ? "er" : ""} •
                    Siste:{" "}
                    {new Date(thread.lastDate).toLocaleDateString("nb-NO", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleReply(thread)}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Svar
                </button>
              </div>

              {/* Thread emails */}
              <div className="divide-y divide-gray-100">
                {thread.emails.map((email) => (
                  <div key={email.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${
                              email.is_sent
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {email.is_sent ? "Sendt" : "Mottatt"}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {email.is_sent
                              ? `Til: ${email.to_name || email.to_address}`
                              : `Fra: ${email.from_name || email.from_address}`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(
                            email.received_date || email.sent_date || ""
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
                      {email.body_preview}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
