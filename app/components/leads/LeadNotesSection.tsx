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

  const base = "px-2 py-1 text-sm border rounded-md transition-colors";
  const active = "bg-blue-600 text-white border-blue-600";
  const inactive = "bg-white text-gray-700 border-gray-300 hover:bg-gray-100";

  return (
    <div className="flex gap-2 border-b border-gray-300 p-2 bg-gray-50 rounded-t-md">
      <button
        type="button"
        onClick={() => toggle(() => editor.chain().focus().toggleBold().run())}
        className={`${base} ${activeMarks.bold ? active : inactive}`}
      >
        <strong>Bold</strong>
      </button>
      <button
        type="button"
        onClick={() =>
          toggle(() => editor.chain().focus().toggleItalic().run())
        }
        className={`${base} ${activeMarks.italic ? active : inactive}`}
      >
        <em>Italic</em>
      </button>
      <button
        type="button"
        onClick={() =>
          toggle(() => editor.chain().focus().toggleStrike().run())
        }
        className={`${base} ${activeMarks.strike ? active : inactive}`}
      >
        <span className="line-through">Strike</span>
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
          "prose dark:prose-invert prose-sm sm:prose-base lg:prose-lg xl:prose-2xl m-5 focus:outline-none",
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

      if (leadData?.note && leadData.assigned_to) {
        const leadSourcer = users.find((u) => u.id === leadData.assigned_to);
        const leadNote: Note = {
          id: `lead-note-${leadData.id}`,
          lead_id: leadData.id,
          user_id: leadData.assigned_to,
          content: leadData.note,
          created_at: leadData.created_at ?? new Date(0).toISOString(),
          source: "note",
          user: leadSourcer ?? {
            id: leadData.assigned_to,
            name: "Ukjent lead-innhenter",
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
    allNotes.filter(
      (item) => item.source === "comment" && item.note_id === noteId,
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
    const note = await createLeadNote(
      leadId,
      user.id,
      editor.getHTML(),
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
    <section className="mt-8 border-t pt-4">
      <h2 className="text-lg font-semibold mb-2">Merknader</h2>

      {/* New note form */}
      <form onSubmit={handleAddNote} className="mb-3 flex flex-col gap-2">
        <div className="relative">
          <div className="border border-gray-300 bg-white rounded-md">
            <MenuBar editor={editor} />
            <EditorContent editor={editor} />
          </div>
          {mentionSuggestions.length > 0 && (
            <ul className="absolute bg-white border mt-1 w-full max-h-32 overflow-auto z-10 rounded shadow-lg">
              {mentionSuggestions.map((u) => (
                <li
                  key={u.id}
                  className="px-2 py-1 cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSelectMention(u.name)}
                >
                  {u.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <input
            type="file"
            id="email-attachments"
            name="email-attachments"
            multiple
            onChange={(e) =>
              setAttachments(e.target.files ? Array.from(e.target.files) : [])
            }
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
          />
          {attachments.length > 0 && (
            <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
              {attachments.map((file, i) => (
                <li key={i}>{file.name}</li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          className="bg-indigo-600 text-white px-3 py-1 rounded-md text-sm hover:bg-indigo-700"
          disabled={loading}
        >
          {loading ? "Legger til.." : "Legg til"}
        </button>
      </form>

      {/* Notes list */}
      <ul className="space-y-3">
        {notes.map((note, i) => {
          const comments = getCommentsForNote(note.id);
          return (
            <li
              key={note.id}
              id={note.id}
              className="border p-2 rounded-md bg-white shadow-sm"
            >
              <div className="flex flex-row justify-between">
                <div>
                  <p className="text-lg">Merknad av {note.user?.name}</p>
                  {i !== notes.length - 1 && (
                    <p className="text-sm text-gray-400">
                      {new Date(note.created_at ?? "").toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="py-2 px-4 h-fit bg-red-200 hover:bg-red-500 text-red-500 hover:text-white duration-200 rounded-md font-medium items-center flex flex-row gap-1 text-sm"
                >
                  Slett
                </button>
              </div>

              <div
                className="text-md text-slate-600 mb-4 mt-2"
                dangerouslySetInnerHTML={{ __html: note.content }}
              />

              {note.attachments && note.attachments.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-gray-600">
                    Vedlegg
                  </h5>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    {(note.attachments as LeadNoteAttachment[]).map((att) => (
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
              )}

              {/* Comments */}
              <div className="ml-3 border-l pl-2 space-y-1">
                {comments.map((comment) => (
                  <p key={comment.id} className="text-xs text-gray-700">
                    <span className="font-medium">{comment.user?.name}:</span>{" "}
                    {comment.content}
                  </p>
                ))}

                <div className="relative flex flex-row gap-2 mt-2">
                  <input
                    value={newComments[note.id] ?? ""}
                    onChange={(e) =>
                      handleCommentChange(note.id, e.target.value)
                    }
                    placeholder="Skriv en kommentar..."
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-xs"
                  />
                  {(commentMentionSuggestions[note.id] ?? []).length > 0 && (
                    <ul className="absolute top-full left-0 bg-white border mt-1 w-full max-h-32 overflow-auto z-10 rounded shadow-lg">
                      {commentMentionSuggestions[note.id].map((u) => (
                        <li
                          key={u.id}
                          className="px-2 py-1 cursor-pointer hover:bg-gray-200"
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
                    className="bg-gray-200 px-2 py-1 text-xs rounded-md hover:bg-gray-300"
                  >
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
