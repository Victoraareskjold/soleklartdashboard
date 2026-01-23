"use client";
import { useEffect, useState } from "react";
import { EmailContent, Estimate, User } from "@/lib/types";
import {
  sendLeadEmail,
  syncLeadEmails,
  getStoredLeadEmails,
  getInstallerGroup,
  getUser,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { toast } from "react-toastify";
import mailTemplates from "@/constants/mailTemplates.json";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [activeMarks, setActiveMarks] = useState({
    bold: false,
    italic: false,
    strike: false,
  });

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      setActiveMarks({
        bold: editor.isActive("bold"),
        italic: editor.isActive("italic"),
        strike: editor.isActive("strike"),
      });
    };

    editor.on("selectionUpdate", update);
    editor.on("transaction", update);

    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  if (!editor) return null;

  const toggle = (action: () => void) => {
    editor?.chain().focus();
    action();
  };

  const base = "px-2 py-1 text-sm border rounded-md transition-colors";
  const active = "bg-blue-600 text-white border-blue-600";
  const inactive = "bg-white text-gray-700 border-gray-300 hover:bg-gray-100";

  return (
    <div className="flex gap-2 border-b border-gray-300 p-2 bg-gray-50 rounded-t-md">
      <button
        type="button"
        onClick={() => toggle(() => editor.chain().focus().toggleBold().run())}
        className={`${base} ${editor.isActive("bold") ? active : inactive}`}
      >
        <strong>Bold</strong>
      </button>

      <button
        type="button"
        onClick={() =>
          toggle(() => editor.chain().focus().toggleItalic().run())
        }
        className={`${base} ${editor.isActive("italic") ? active : inactive}`}
      >
        <em>Italic</em>
      </button>

      <button
        type="button"
        onClick={() =>
          toggle(() => editor.chain().focus().toggleStrike().run())
        }
        className={`${base} ${editor.isActive("strike") ? active : inactive}`}
      >
        <span className="line-through">Strike</span>
      </button>
    </div>
  );
};

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
  const { installerGroupId } = useInstallerGroup();

  const [emailThreads, setEmailThreads] = useState<EmailThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [sending, setSending] = useState(false);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const [installerName, setInstallerName] = useState("");
  const [userData, setUserData] = useState<User>();

  const editor = useEditor({
    extensions: [StarterKit],
    content: body,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setBody(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && body !== editor.getHTML()) {
      editor.commands.setContent(body);
    }
  }, [body, editor]);

  useEffect(() => {
    if (leadId && installerGroupId) {
      // 1. Hent eksisterende e-poster fra DB umiddelbart
      fetchEmails();

      // 2. Kjør synkronisering mot Outlook i bakgrunnen
      handleSync();

      // 3. Hent metadata
      getInstallerGroup(installerGroupId).then((res) =>
        setInstallerName(res.name),
      );
      getUser().then(setUserData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, installerGroupId]);

  const signature = `<br/>${userData?.name}<br />Nr. ${userData?.phone}`;

  useEffect(() => {
    if (newEstimate && leadName && domain && installerName) {
      const template = mailTemplates.newEstimate;

      const estimateLink = newEstimate.finished
        ? `https://www.${domain}.no/estimat/${newEstimate.id}?f=1`
        : `https://www.${domain}.no/estimat/${newEstimate.id}`;

      const emailSubject = template.subject.replace(
        "{installerName}",
        installerName,
      );

      const emailBody = template.body
        .replaceAll("{leadName}", leadName)
        .replaceAll("{estimateLink}", estimateLink)
        .replaceAll("{installerName}", installerName);

      setSubject(emailSubject);
      setBody(emailBody);
      editor?.commands.setContent(emailBody + signature);
      setShowCompose(true);
      setSelectedTemplate("newEstimate");
    }
  }, [newEstimate, leadName, domain, editor, installerName, signature]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateKey = e.target.value;
    setSelectedTemplate(templateKey);
    if (!templateKey) {
      if (!replyToMessageId) {
        setSubject("");
      }
      setBody("");
      setAttachments([]);
      editor?.commands.clearContent();
      return;
    }

    const template = mailTemplates[templateKey as keyof typeof mailTemplates];
    if (!template) return;

    let emailBody = template.body;
    let emailSubject = template.subject;
    if (leadName) {
      emailSubject = emailSubject.replace(/{installerName}/g, installerName);
      emailBody = emailBody
        .replaceAll(/{leadName}/g, leadName)
        .replaceAll(/{installerName}/g, installerName);
    }

    if (emailBody.includes("{estimateLink}")) {
      const sortedEstimates = estimates?.sort(
        (a, b) =>
          new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime(),
      );
      const latestEstimate = sortedEstimates?.[0];
      if (latestEstimate && domain) {
        const estimateLink = `https://www.${domain}.no/estimat/${latestEstimate.id}`;
        emailBody = emailBody.replace(/{estimateLink}/g, estimateLink);
      } else {
        toast.warn(
          "Kan ikke fylle ut estimatlenke. Ingen estimater funnet for denne leaden.",
        );
        emailBody = emailBody.replace(
          /{estimateLink}/g,
          "[MANGLER ESTMATLENKE]",
        );
      }
    }

    if (!replyToMessageId) {
      setSubject(emailSubject);
    }
    setBody(emailBody);
    editor?.commands.setContent(emailBody + signature);
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
    const emailsWithConvId = emails.filter((e) => e.conversation_id);
    const emailsWithoutConvId = emails.filter((e) => !e.conversation_id);

    const mergedEmails = emailsWithConvId.map((emailWithConv) => {
      const duplicateIndex = emailsWithoutConvId.findIndex(
        (emailWithoutConv) =>
          emailWithoutConv.subject === emailWithConv.subject &&
          Math.abs(
            new Date(emailWithoutConv.received_at).getTime() -
              new Date(emailWithConv.received_at).getTime(),
          ) < 60000, // 1 minute threshold
      );

      if (duplicateIndex > -1) {
        const duplicate = emailsWithoutConvId[duplicateIndex];
        // remove from emailsWithoutConvId so it's not added again
        emailsWithoutConvId.splice(duplicateIndex, 1);

        return {
          ...emailWithConv,
          cc_addresses:
            emailWithConv.cc_addresses && emailWithConv.cc_addresses.length > 0
              ? emailWithConv.cc_addresses
              : duplicate.cc_addresses,
          attachments:
            emailWithConv.attachments && emailWithConv.attachments.length > 0
              ? emailWithConv.attachments
              : duplicate.attachments,
        };
      }
      return emailWithConv;
    });

    const finalEmails = [...mergedEmails, ...emailsWithoutConvId];

    // Group by conversation_id
    const threadMap: { [key: string]: EmailContent[] } = {};

    finalEmails.forEach((email) => {
      // If no conversation_id, treat it as a separate thread using its own id
      const conversationKey = email.conversation_id || email.id;
      if (!threadMap[conversationKey]) {
        threadMap[conversationKey] = [];
      }
      threadMap[conversationKey].push(email);
    });

    // Convert to array and sort
    const threads: EmailThread[] = Object.entries(threadMap).map(
      ([conversationId, threadEmails]) => {
        // Sort emails within thread by date (newest first)
        const sortedEmails = threadEmails.sort((a, b) => {
          const dateA = new Date(a.received_at || "").getTime();
          const dateB = new Date(b.received_at || "").getTime();
          return dateB - dateA;
        });

        return {
          conversationId,
          emails: sortedEmails,
          lastDate: sortedEmails[sortedEmails.length - 1]?.received_at || "",
          subject: sortedEmails[0]?.subject || "Ingen emne",
        };
      },
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

      const attachmentsPayload = await Promise.all(
        attachments.map(async (file) => {
          const contentBytes = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1]);
            };
            reader.onerror = (error) => reject(error);
          });
          return {
            name: file.name,
            contentType: file.type,
            contentBytes,
          };
        }),
      );

      const ccArray = cc
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);

      const response = await sendLeadEmail(
        leadId,
        user.id,
        installerGroupId,
        subject,
        body,
        replyToMessageId || undefined,
        attachmentsPayload,
        ccArray,
      );

      if (response.success) {
        toast.success("E-post sendt!");
        setSubject("");
        setBody("");
        setCc("");
        setAttachments([]);
        editor?.commands.clearContent();
        setShowCompose(false);
        setReplyToMessageId(null);
        setSelectedTemplate("");

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
                setCc("");
                setAttachments([]);
                editor?.commands.clearContent();
              }}
              className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
            >
              Ny e-post
            </button>
          </div>
        </div>

        {/* Compose email form */}
        {showCompose && (
          <div className="bg-white max-w-182 mx-auto border border-gray-300 rounded-md p-4 shadow-sm">
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
                  Cc
                </label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Kommaseparerte e-poster"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <div className="border border-gray-300 rounded-md">
                  <MenuBar editor={editor} />
                  <EditorContent editor={editor} />
                </div>
              </div>

              <div className="flex flex-row justify-between items-center">
                <div>
                  <select
                    value={selectedTemplate}
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

                <div>
                  <label
                    htmlFor="email-attachments"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  ></label>
                  <input
                    type="file"
                    id="email-attachments"
                    name="email-attachments"
                    multiple
                    onChange={(e) =>
                      setAttachments(
                        e.target.files ? Array.from(e.target.files) : [],
                      )
                    }
                    className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                  />
                  {attachments.length > 0 && (
                    <div className="mt-2 text-sm text-gray-600">
                      <ul className="list-disc list-inside">
                        {attachments.map((file, i) => (
                          <li key={i}>{file.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
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
                className="bg-white max-w-182 mx-auto border border-gray-200 rounded-md shadow-sm overflow-hidden"
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
                                      email.to_addresses?.join(", ") ||
                                      leadEmail
                                    }`
                                  : `Fra: ${email.from_address || "Ukjent"}`}
                              </span>
                            </div>
                            {email.cc_addresses &&
                              email.cc_addresses?.length > 0 && (
                                <div className="ml-10 mt-0.5 text-xs text-gray-600">
                                  Cc: {email.cc_addresses.join(", ")}
                                </div>
                              )}
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(email.received_at || "").toLocaleString(
                                "nb-NO",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <div
                            className="text-sm text-gray-700 whitespace-pre-wrap break-words"
                            dangerouslySetInnerHTML={{
                              __html:
                                email.body ||
                                email.body_preview ||
                                "Ingen innhold",
                            }}
                          />
                        </div>
                        {email.attachments && email.attachments.length > 0 && (
                          <div className="mt-4">
                            <h5 className="text-sm font-semibold text-gray-600">
                              Vedlegg
                            </h5>
                            <ul className="mt-2 list-disc list-inside space-y-1">
                              {email.attachments.map((att) => (
                                <li key={att.id} className="text-sm">
                                  <a
                                    href={att.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    {att.file_name}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}{" "}
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
