"use client";
import { useEffect, useState } from "react";
import {
  EmailContent,
  Estimate,
  InstallerGroup,
  MailTemplate,
  User,
} from "@/lib/types";
import {
  sendLeadEmail,
  syncLeadEmails,
  getStoredLeadEmails,
  getInstallerGroup,
  getUser,
  getMailTemplates,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useTeam } from "@/context/TeamContext";
import { toast } from "react-toastify";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bold,
  Inbox,
  Italic,
  Loader2,
  Mail,
  Paperclip,
  PenSquare,
  RefreshCw,
  Reply,
  Send,
  Strikethrough,
  X,
} from "lucide-react";

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

  const base =
    "inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors";
  const active = "bg-brand-soft text-brand ring-1 ring-inset ring-blue-200";
  const inactive = "text-muted hover:bg-gray-100 hover:text-ink";

  return (
    <div className="flex gap-1 rounded-t-xl border-b border-line bg-gray-50/80 px-2 py-1.5">
      <button
        type="button"
        title="Bold"
        aria-label="Bold"
        onMouseDown={() =>
          toggle(() => editor.chain().focus().toggleBold().run())
        }
        className={`${base} ${editor.isActive("bold") ? active : inactive}`}
      >
        <Bold size={15} />
      </button>

      <button
        type="button"
        title="Italic"
        aria-label="Italic"
        onMouseDown={() =>
          toggle(() => editor.chain().focus().toggleItalic().run())
        }
        className={`${base} ${editor.isActive("italic") ? active : inactive}`}
      >
        <Italic size={15} />
      </button>

      <button
        type="button"
        title="Strike"
        aria-label="Strike"
        onMouseDown={() =>
          toggle(() => editor.chain().focus().toggleStrike().run())
        }
        className={`${base} ${editor.isActive("strike") ? active : inactive}`}
      >
        <Strikethrough size={15} />
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

/** Lenken kunden får til et tilbud. Ferdigstilt tilbud (?f=1) åpnes med signering tilgjengelig. */
function estimateUrl(domain: string, estimate: Estimate) {
  return estimate.finished
    ? `https://www.${domain}.no/estimat/${estimate.id}?f=1`
    : `https://www.${domain}.no/estimat/${estimate.id}`;
}

/** Det nyeste tilbudet i avtalen, med eller uten signering. */
function latestEstimate(estimates: Estimate[] | undefined) {
  return [...(estimates ?? [])].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
  )[0];
}

/**
 * Setter inn tilbudslenken. Malene bruker {estimateLink} både som
 * href="{estimateLink}" (eller href={estimateLink}) og som tekst; href får
 * bare adressen, ellers blir det en lenke inni en lenke.
 */
function fillEstimateLink(body: string, url: string) {
  const link = `<a href="${url}">Åpne oppsett for solcelleanlegg</a>`;
  return body
    .replace(/<a\s+href=(["']?)\{estimateLink\}\1\s*>\s*\{estimateLink\}\s*<\/a>/g, link)
    .replace(/href=(["']?)\{estimateLink\}\1/g, `href="${url}"`)
    .replace(/\{estimateLink\}/g, link);
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
  const { teamId } = useTeam();

  const [mailTemplates, setMailTemplates] = useState<MailTemplate[]>([]);
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

  const [installerData, setInstallerData] = useState<InstallerGroup | null>(
    null,
  );
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
          "prose prose-sm max-w-none min-h-[200px] px-4 py-3 text-sm text-ink focus:outline-none",
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
      fetchEmails();
      handleSync();
      getInstallerGroup(installerGroupId).then((res) => {
        setInstallerData(res);
      });
      getUser().then(setUserData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, installerGroupId]);

  useEffect(() => {
    if (teamId) {
      getMailTemplates(teamId).then((data) => setMailTemplates(data ?? []));
    }
  }, [teamId]);

  //const signature = `<br/>${userData?.name}<br />Nr. ${userData?.phone}`;
  const signature = `<br/><br/><br/>Med vennlig hilsen<br/>${userData?.name}<br/><br/>--<br/><br/><strong>Teknisk konsulent | Sol og energisystemer</strong><br/>Mob.: 458 71 718<br/>Adresse: ${installerData?.address}<br/><br/>Nettside: www.${installerData?.site}.no<br/><br/>${installerData?.name}<br/>Org.nr: ${installerData?.org_nr}`;

  useEffect(() => {
    if (showCompose && editor && !replyToMessageId && editor.isEmpty) {
      const content = signature;
      setBody(content);
      editor.commands.setContent(content);
    }
  }, [showCompose, editor, replyToMessageId, signature]);

  useEffect(() => {
    if (newEstimate && leadName && domain && installerData?.name) {
      const template = mailTemplates.find(
        (t) => t.template_key === "newEstimate",
      );
      if (!template) return;

      const estimateLink = estimateUrl(domain, newEstimate);

      const emailSubject = template.subject.replace(
        "{installerName}",
        installerData?.name,
      );

      const emailBody = fillEstimateLink(template.body, estimateLink)
        .replaceAll("{leadName}", leadName)
        .replaceAll("{installerName}", installerData?.name);

      setSubject(emailSubject);
      setBody(emailBody);
      editor?.commands.setContent(emailBody + signature);
      setShowCompose(true);
      setSelectedTemplate(template.id);
    }
  }, [
    newEstimate,
    leadName,
    domain,
    editor,
    installerData?.name,
    signature,
    mailTemplates,
  ]);

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateId = e.target.value;
    setSelectedTemplate(templateId);
    if (!templateId) {
      if (!replyToMessageId) {
        setSubject("");
      }
      setBody("");
      setAttachments([]);
      editor?.commands.clearContent();
      return;
    }

    const template = mailTemplates.find((t) => t.id === templateId);
    if (!template) return;

    let emailBody = template.body;
    let emailSubject = template.subject;
    emailSubject = emailSubject.replace(
      /{installerName}/g,
      installerData?.name ?? "",
    );
    emailBody = emailBody
      .replaceAll(/{leadName}/g, leadName ?? "")
      .replaceAll(/{installerName}/g, installerData?.name ?? "");

    if (emailBody.includes("{estimateLink}")) {
      // Det nyeste tilbudet i avtalen. Er det ferdigstilt, åpnes det med signering.
      const latest = latestEstimate(estimates);
      if (latest && domain) {
        emailBody = fillEstimateLink(emailBody, estimateUrl(domain, latest));
      } else {
        toast.warn(
          "Kan ikke fylle ut estimatlenke. Ingen estimater funnet for denne leaden.",
        );
        emailBody = emailBody.replace(
          /{estimateLink}/g,
          "[MANGLER ESTIMATLENKE]",
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
        // Refresh the list only if new emails were added/updated
        if (response.count > 0) {
          await fetchEmails();
        }
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

      const emailBodyHtml = body.replace(/<p><\/p>/g, "<p>&nbsp;</p>");

      const response = await sendLeadEmail(
        leadId,
        user.id,
        installerGroupId,
        subject,
        emailBodyHtml,
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
      <div className="flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800">
          Denne leaden har ingen e-postadresse registrert. Legg til en
          e-postadresse for å sende og motta e-poster.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="sk-card flex items-center justify-center gap-2 p-10 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" />
        <p>Laster e-poster...</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Header with actions */}
        <div className="sk-card flex items-center justify-between gap-3 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <Mail size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="sk-section-title">E-postkorrespondanse</h3>
              <p className="truncate text-xs text-muted">{leadEmail}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="sk-btn sk-btn-secondary"
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
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
              className="sk-btn sk-btn-primary"
            >
              <PenSquare size={15} />
              Ny e-post
            </button>
          </div>
        </div>

        {/* Compose email form */}
        {showCompose && (
          <div className="sk-card animate-pop-in overflow-hidden ring-2 ring-blue-100">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-brand-soft/60 px-5 py-3">
              <h4 className="sk-section-title flex items-center gap-2 text-sm">
                {replyToMessageId ? (
                  <Reply size={15} className="text-brand" />
                ) : (
                  <PenSquare size={15} className="text-brand" />
                )}
                {replyToMessageId ? "Svar på e-post" : "Send ny e-post"}
              </h4>
              <button
                type="button"
                onClick={() => setShowCompose(false)}
                className="sk-icon-btn size-8"
                aria-label="Avbryt"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="flex flex-col gap-3 p-5">
              <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
                <label className="text-xs font-semibold text-muted">Til</label>
                <input
                  type="text"
                  value={leadEmail}
                  disabled
                  className="sk-input"
                />
                <label className="text-xs font-semibold text-muted">Cc</label>
                <input
                  type="text"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="Kommaseparerte e-poster"
                  className="sk-input"
                />
                <label className="text-xs font-semibold text-muted">
                  Emne
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="E-postemne"
                  className="sk-input font-medium"
                  required
                />
              </div>
              <div>
                <label className="sk-label">Melding</label>
                <div className="rounded-xl border border-line bg-surface transition-shadow focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(24,105,255,0.18)]">
                  <MenuBar editor={editor} />
                  <EditorContent editor={editor} />
                </div>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3 border-t border-line pt-4">
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
                  <select
                    value={selectedTemplate}
                    onChange={handleTemplateChange}
                    className="sk-input w-auto min-w-48"
                  >
                    <option value="">Velg en mal...</option>
                    {mailTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>

                  <div className="min-w-0">
                    <label
                      htmlFor="email-attachments"
                      className="sr-only"
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
                      className="block w-full cursor-pointer text-sm text-muted file:mr-3 file:h-9 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:text-sm file:font-semibold file:text-ink hover:file:bg-gray-50"
                    />
                    {attachments.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {attachments.map((file, i) => (
                          <li key={i} className="sk-badge sk-badge-neutral">
                            <Paperclip size={11} />
                            {file.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCompose(false)}
                    className="sk-btn sk-btn-ghost"
                  >
                    Avbryt
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="sk-btn sk-btn-primary"
                  >
                    <Send size={15} />
                    {sending ? "Sender..." : "Send"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Email threads */}
        {emailThreads.length === 0 ? (
          <div className="sk-empty">
            <Inbox size={24} className="text-gray-400" />
            <p className="font-medium text-ink">Ingen e-poster funnet</p>
            <p className="text-xs text-muted">
              Klikk &quot;Synkroniser&quot; for å hente e-poster fra Outlook
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {emailThreads.map((thread) => (
              <div
                key={thread.conversationId}
                className="sk-card animate-fade-in overflow-hidden"
              >
                {/* Thread header */}
                <div className="border-b border-line bg-gray-50/70 px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold text-ink">
                        {thread.subject}
                      </h4>
                      <p className="mt-0.5 text-xs text-muted">
                        {thread.emails.length} melding
                        {thread.emails.length > 1 ? "er" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleReply(thread)}
                      className="sk-btn sk-btn-secondary sk-btn-sm"
                    >
                      <Reply size={14} />
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
                      <div key={email.id} className="px-5 py-4">
                        <div className="mb-3 flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${
                              isSentByMe
                                ? "bg-emerald-50 text-emerald-600 ring-emerald-100"
                                : "bg-blue-50 text-brand ring-blue-100"
                            }`}
                          >
                            {isSentByMe ? (
                              <ArrowUpRight size={15} />
                            ) : (
                              <ArrowDownLeft size={15} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`sk-badge ${
                                  isSentByMe
                                    ? "sk-badge-success"
                                    : "sk-badge-brand"
                                }`}
                              >
                                {isSentByMe ? "Sendt" : "Mottatt"}
                              </span>
                              <span className="truncate text-sm font-medium text-ink">
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
                                <div className="mt-0.5 text-xs text-muted">
                                  Cc: {email.cc_addresses.join(", ")}
                                </div>
                              )}
                            <p className="mt-0.5 text-xs tabular-nums text-muted">
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
                        <div className="overflow-x-auto pl-11">
                          <div
                            className="break-words text-sm leading-relaxed text-body [&_a]:text-brand [&_a]:underline [&_p]:mb-3 [&_p:last-child]:mb-0"
                            dangerouslySetInnerHTML={{
                              __html: (
                                email.body ||
                                email.body_preview ||
                                "Ingen innhold"
                              ).replace(/<p><\/p>/g, "<p><br></p>"),
                            }}
                          />
                        </div>
                        {email.attachments && email.attachments.length > 0 && (
                          <div className="mt-4 pl-11">
                            <h5 className="sk-eyebrow mb-2">Vedlegg</h5>
                            <ul className="flex flex-wrap gap-2">
                              {email.attachments.map((att) => (
                                <li key={att.id}>
                                  <a
                                    href={att.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border border-line bg-gray-50 px-2.5 py-1 text-xs font-medium text-ink hover:border-blue-200 hover:bg-brand-soft hover:text-brand"
                                  >
                                    <Paperclip size={12} className="shrink-0" />
                                    <span className="truncate">
                                      {att.file_name}
                                    </span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
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
