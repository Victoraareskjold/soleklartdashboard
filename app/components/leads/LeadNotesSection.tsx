"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getLead,
  getLeadNotes,
  createLeadNote,
  getTaggableUsers,
  updateLead,
} from "@/lib/api";
import { Lead, LeadNoteAttachment, Note } from "@/lib/types";
import { toast } from "react-toastify";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { useRouter } from "next/navigation";
import {
  Bold,
  Italic,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Strikethrough,
  Trash2,
} from "lucide-react";

// ─── MenuBar ─────────────────────────────────────────────────────────────────

const MenuBar = ({ editor }: { editor: Editor | null }) => {
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
        className={`${base} ${activeMarks.bold ? active : inactive}`}
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
        className={`${base} ${activeMarks.italic ? active : inactive}`}
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
        className={`${base} ${activeMarks.strike ? active : inactive}`}
      >
        <Strikethrough size={15} />
      </button>
    </div>
  );
};

// ─── LeadNotesSection ────────────────────────────────────────────────────────

interface Props {
  leadId: string;
}

export default function LeadNotesSection({ leadId }: Props) {
  const { installerGroupId } = useInstallerGroup();
  const [lead, setLead] = useState<Lead | null>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [taggableUsers, setTaggableUsers] = useState<
    { id: string; name: string; email: string }[]
  >([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<
    { id: string; name: string }[]
  >([]);
  const [commentMentionSuggestions, setCommentMentionSuggestions] = useState<
    Record<string, { id: string; name: string }[]>
  >({});
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const editor = useEditor({
    extensions: [StarterKit],
    content: newNote,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setNewNote(editor.getHTML());
      updateMentionSuggestions(editor.getText(), setMentionSuggestions);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[110px] px-4 py-3 text-sm text-ink focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && newNote !== editor.getHTML()) {
      editor.commands.setContent(newNote);
    }
  }, [newNote, editor]);

  useEffect(() => {
    if (!leadId) return;
    const fetchData = async () => {
      const [leadData, notesData, users] = await Promise.all([
        getLead(leadId),
        getLeadNotes(leadId),
        getTaggableUsers(leadId, installerGroupId),
      ]);
      setLead(leadData);
      setTaggableUsers(users);

      const combinedNotes = [...(notesData ?? [])];

      const noteAuthor = leadData.assigned_to ?? "Nettsideskjema";

      if (leadData?.note && noteAuthor) {
        const leadSourcer = users.find((u) => u.id === noteAuthor);
        const leadNote: Note = {
          id: `lead-note-${leadData.id}`,
          lead_id: leadData.id,
          user_id: noteAuthor,
          content: leadData.note,
          created_at: leadData.created_at ?? new Date(0).toISOString(),
          source: "note",
          user: leadSourcer ?? {
            id: noteAuthor,
            name: "Nettsideskjema",
          },
        };
        combinedNotes.push(leadNote);
      }

      combinedNotes.sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime(),
      );
      setAllNotes(combinedNotes);
    };
    fetchData();
  }, [leadId, installerGroupId]);

  const notes = allNotes.filter((note) => note.source === "note");
  const getCommentsForNote = (noteId: string) =>
    allNotes
      .filter((item) => item.source === "comment" && item.note_id === noteId)
      .sort(
        (a, b) =>
          new Date(a.created_at ?? 0).getTime() -
          new Date(b.created_at ?? 0).getTime(),
      );

  // ── Add note ───────────────────────────────────────────────────────────────

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user?.id) return;
    setLoading(true);

    const sanitizeFileName = (name: string) =>
      name
        .replace(/[åÅ]/g, "a")
        .replace(/[æÆ]/g, "ae")
        .replace(/[øØ]/g, "o")
        .replace(/[^a-zA-Z0-9.-]/g, "_");

    const attachmentsPayload = await Promise.all(
      attachments.map(async (file) => {
        const cleanedName = sanitizeFileName(file.name);
        const contentBytes = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () =>
            resolve((reader.result as string).split(",")[1]);
          reader.onerror = (error) => reject(error);
        });
        return { name: cleanedName, contentType: file.type, contentBytes };
      }),
    );

    // Email notifications for @mentions are handled server-side in the API route
    const noteContent = editor.getHTML().replace(/<p><\/p>/g, "<p><br></p>");
    const note = await createLeadNote(
      leadId,
      user.id,
      noteContent,
      "note",
      undefined,
      attachmentsPayload,
    );

    setAllNotes([note, ...allNotes]);
    setNewNote("");
    setAttachments([]);
    setLoading(false);
    editor.commands.clearContent();
    setMentionSuggestions([]);
    window.location.reload();
    router.push(`?tab=Merknader`);
  };

  // ── Add comment ────────────────────────────────────────────────────────────

  const handleAddComment = async (noteId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    const text = newComments[noteId]?.trim();
    if (!text || !user?.id) return;
    setLoading(true);

    if (noteId.startsWith("lead-note-")) {
      if (!lead?.note || !lead.created_by) return;
      try {
        // Convert the temporary lead note into a permanent one
        const permanentNote = await createLeadNote(
          leadId,
          lead.created_by,
          lead.note,
          "note",
        );
        // Add the comment — server will notify all thread participants
        const newComment = await createLeadNote(
          leadId,
          user.id,
          text,
          "comment",
          permanentNote.id,
        );
        await updateLead(leadId, { note: null });

        setAllNotes((prevNotes) => {
          const withoutTemporary = prevNotes.filter((n) => n.id !== noteId);
          const updatedNotes = [...withoutTemporary, permanentNote, newComment];
          updatedNotes.sort(
            (a, b) =>
              new Date(b.created_at ?? 0).getTime() -
              new Date(a.created_at ?? 0).getTime(),
          );
          return updatedNotes;
        });

        setLead((prev) => (prev ? { ...prev, note: null } : null));
        setNewComments({ ...newComments, [noteId]: "" });
        toast.success("Kommentar lagt til.");
      } catch (error) {
        console.error("Feil ved konvertering av hovedmerknad:", error);
        toast.error("En feil oppstod ved kommentering.");
      }
    } else {
      // Server automatically notifies all thread participants on comment
      const comment = await createLeadNote(
        leadId,
        user.id,
        text,
        "comment",
        noteId,
      );
      setAllNotes([...allNotes, comment]);
      setNewComments({ ...newComments, [noteId]: "" });
    }

    setCommentMentionSuggestions({
      ...commentMentionSuggestions,
      [noteId]: [],
    });
    setLoading(false);
    window.location.reload();
    router.push(`?tab=Merknader`);
  };

  // ── Mention helpers ────────────────────────────────────────────────────────

  const updateMentionSuggestions = (
    text: string,
    setter: (suggestions: { id: string; name: string }[]) => void,
  ) => {
    const atIndex = text.lastIndexOf("@");
    if (atIndex >= 0) {
      const query = text.slice(atIndex + 1).toLowerCase();
      setter(
        taggableUsers
          .filter((u) => u.name.toLowerCase().startsWith(query))
          .map((u) => ({ id: u.id, name: u.name })),
      );
    } else {
      setter([]);
    }
  };

  const handleCommentChange = (noteId: string, text: string) => {
    setNewComments({ ...newComments, [noteId]: text });
    updateMentionSuggestions(text, (suggestions) =>
      setCommentMentionSuggestions({
        ...commentMentionSuggestions,
        [noteId]: suggestions,
      }),
    );
  };

  const insertMention = (text: string, name: string) => {
    const atIndex = text.lastIndexOf("@");
    return atIndex >= 0 ? text.slice(0, atIndex) + `@[${name}] ` : text;
  };

  const handleSelectMention = (name: string) => {
    if (!editor) return;
    const text = editor.getText();
    const atIndex = text.lastIndexOf("@");
    if (atIndex < 0) return;
    editor
      .chain()
      .focus()
      .deleteRange({ from: atIndex, to: editor.state.selection.to })
      .insertContent(`@[${name}] `)
      .run();
    setMentionSuggestions([]);
  };

  const handleSelectCommentMention = (noteId: string, name: string) => {
    const text = newComments[noteId] || "";
    setNewComments({ ...newComments, [noteId]: insertMention(text, name) });
    setCommentMentionSuggestions({
      ...commentMentionSuggestions,
      [noteId]: [],
    });
  };

  // ── Delete note ────────────────────────────────────────────────────────────

  const handleDeleteNote = async (noteId: string) => {
    if (!noteId) return;
    if (!window.confirm("Er du sikker på at du vil slette?")) return;
    try {
      const res = await fetch(`/api/leadNotes/notes/${noteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Kunne ikke slette merknad");
      setAllNotes((prev) => prev.filter((t) => t.id !== noteId));
      toast.success("Merknad slettet!");
    } catch (err) {
      console.error(err);
      toast.error("Noe gikk galt ved sletting");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section className="flex flex-col gap-4">
      {/* New note form */}
      <form onSubmit={handleAddNote} className="sk-card flex flex-col">
        <div className="sk-card-header">
          <h2 className="sk-section-title">Merknader</h2>
          {notes.length > 0 && (
            <span className="sk-badge sk-badge-neutral">{notes.length}</span>
          )}
        </div>
        <div className="flex flex-col gap-3 p-5">
          <div className="relative">
            <div className="rounded-xl border border-line bg-surface transition-shadow focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(24,105,255,0.18)]">
              <MenuBar editor={editor} />
              <EditorContent editor={editor} />
            </div>
            {mentionSuggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-pop animate-pop-in">
                {mentionSuggestions.map((u) => (
                  <li
                    key={u.id}
                    className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm text-ink hover:bg-brand-soft hover:text-brand"
                    onClick={() => handleSelectMention(u.name)}
                  >
                    {u.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
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
                className="block w-full cursor-pointer text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-ink hover:file:bg-gray-50"
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

            <button
              type="submit"
              className="sk-btn sk-btn-primary"
              disabled={loading}
            >
              <Plus size={15} />
              {loading ? "Legger til.." : "Legg til"}
            </button>
          </div>
        </div>
      </form>

      {/* Notes list */}
      <ul className="flex flex-col gap-3">
        {notes.map((note, i) => {
          const comments = getCommentsForNote(note.id);
          const authorInitial = (note.user?.name ?? "?")
            .charAt(0)
            .toUpperCase();
          return (
            <li key={note.id} id={note.id} className="sk-card animate-fade-in">
              <div className="flex flex-row items-start justify-between gap-3 px-5 pt-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand ring-1 ring-inset ring-blue-100">
                    {authorInitial}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      Merknad av {note.user?.name}
                    </p>
                    {i !== notes.length - 1 && (
                      <p className="text-xs tabular-nums text-muted">
                        {new Date(note.created_at ?? "").toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="sk-btn sk-btn-danger-ghost sk-btn-sm"
                >
                  <Trash2 size={14} />
                  Slett
                </button>
              </div>

              <div
                className="pb-4 pl-16 pr-5 pt-3 text-sm leading-relaxed text-body [&_p]:mb-3 [&_p:last-child]:mb-0"
                dangerouslySetInnerHTML={{
                  __html: note.content.replace(/<p><\/p>/g, "<p><br></p>"),
                }}
              />

              {note.attachments && note.attachments.length > 0 && (
                <div className="pb-4 pl-16 pr-5">
                  <h5 className="sk-eyebrow mb-2">Vedlegg</h5>
                  <ul className="flex flex-wrap gap-2">
                    {(note.attachments as LeadNoteAttachment[]).map((att) => (
                      <li key={att.id}>
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-[260px] items-center gap-1.5 rounded-lg border border-line bg-gray-50 px-2.5 py-1 text-xs font-medium text-ink hover:border-blue-200 hover:bg-brand-soft hover:text-brand"
                        >
                          <Paperclip size={12} className="shrink-0" />
                          <span className="truncate">{att.file_name}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Comments */}
              <div className="space-y-2 rounded-b-card border-t border-line bg-gray-50/60 px-5 py-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <MessageSquare
                      size={13}
                      className="mt-1 shrink-0 text-gray-400"
                    />
                    <p className="text-sm text-body">
                      <span className="font-semibold text-ink">
                        {comment.user?.name}:
                      </span>{" "}
                      {comment.content}
                    </p>
                  </div>
                ))}

                <div className="relative flex flex-row gap-2">
                  <input
                    value={newComments[note.id] ?? ""}
                    onChange={(e) =>
                      handleCommentChange(note.id, e.target.value)
                    }
                    placeholder="Skriv en kommentar..."
                    className="sk-input h-8 flex-1 text-xs"
                  />
                  {(commentMentionSuggestions[note.id] ?? []).length > 0 && (
                    <ul className="absolute left-0 top-full z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-pop animate-pop-in">
                      {commentMentionSuggestions[note.id].map((u) => (
                        <li
                          key={u.id}
                          className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm text-ink hover:bg-brand-soft hover:text-brand"
                          onClick={() =>
                            handleSelectCommentMention(note.id, u.name)
                          }
                        >
                          {u.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddComment(note.id)}
                    className="sk-btn sk-btn-secondary sk-btn-sm"
                    disabled={loading}
                  >
                    <Send size={13} />
                    Send
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
