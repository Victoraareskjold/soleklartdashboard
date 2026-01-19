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
import { User } from "@supabase/supabase-js";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useInstallerGroup } from "@/context/InstallerGroupContext";

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

      if (leadData && leadData.note && leadData.created_by) {
        const leadCreator = users.find((u) => u.id === leadData.created_by);
        const leadNote: Note = {
          id: `lead-note-${leadData.id}`,
          lead_id: leadData.id,
          user_id: leadData.created_by,
          content: leadData.note,
          created_at: leadData.created_at ?? new Date(0).toISOString(),
          source: "note",
          user: leadCreator ?? {
            id: leadData.created_by,
            name: "Ukjent bruker",
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

  // Filtrer ut bare hovednotater (ikke kommentarer)
  const notes = allNotes.filter((note) => note.source === "note");

  // Hent alle kommentarer for en spesifikk note
  const getCommentsForNote = (noteId: string) => {
    return allNotes.filter(
      (item) => item.source === "comment" && item.note_id === noteId,
    );
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (editor.isEmpty || !user?.id) return;

    const noteContent = editor.getHTML();

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

    const note = await createLeadNote(
      leadId,
      user.id,
      noteContent,
      "note",
      undefined,
      attachmentsPayload,
    );

    setAllNotes([note, ...allNotes]);
    if (lead) {
      sendMentionEmail(noteContent, lead, user, taggableUsers);
    }

    setNewNote("");
    setAttachments([]);
    editor.commands.clearContent();
    setMentionSuggestions([]);
  };

  const handleAddComment = async (noteId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    const text = newComments[noteId]?.trim();
    if (!text || !user?.id) return;

    if (noteId.startsWith("lead-note-")) {
      if (!lead || !lead.note || !lead.created_by) return;

      try {
        // Convert the temporary lead note into a permanent one
        const permanentNote = await createLeadNote(
          leadId,
          lead.created_by,
          lead.note,
          "note",
        );

        // Add the new comment to the permanent note
        const newComment = await createLeadNote(
          leadId,
          user.id,
          text,
          "comment",
          permanentNote.id,
        );

        // Clear the original note from the lead to avoid duplication
        await updateLead(leadId, { note: null });

        // Update state to reflect the changes
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
      // Standard procedure for regular notes
      const comment = await createLeadNote(
        leadId,
        user.id,
        text,
        "comment",
        noteId,
      );
      if (lead) {
        sendMentionEmail(text, lead, user, taggableUsers);
      }
      setAllNotes([...allNotes, comment]);
      setNewComments({ ...newComments, [noteId]: "" });
    }
    setCommentMentionSuggestions({
      ...commentMentionSuggestions,
      [noteId]: [],
    });
  };

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
    return atIndex >= 0 ? text.slice(0, atIndex) + `@[${name}]` + " " : text;
  };

  const handleSelectMention = (name: string) => {
    if (!editor) return;
    const text = editor.getText();
    const atIndex = text.lastIndexOf("@");
    if (atIndex < 0) return;

    const from = atIndex;
    const to = editor.state.selection.to;

    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
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

  const sendMentionEmail = async (
    content: string,
    lead: Lead,
    currentUser: User,
    users: { id: string; name: string; email: string }[],
  ) => {
    const mentions = content.match(/@\[([^\]]+)\]/g);
    if (!mentions) return;

    const { data: authorData } = await supabase
      .from("users")
      .select("name")
      .eq("id", currentUser.id)
      .single();
    const authorName = authorData?.name ?? "En bruker";

    const mentionedUserNames = mentions.map((m) =>
      m.substring(2, m.length - 1),
    );

    for (const name of mentionedUserNames) {
      const user = users.find((u) => u.name === name);
      if (user && user.email) {
        const emailSubject = `Du ble nevnt i en merknad på lead: ${lead.person_info}`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden;">
            <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
              <h1>Soleklart Dashboard</h1>
            </div>
            <div style="padding: 20px;">
              <h2 style="color: #4f46e5;">Du ble nevnt</h2>
              <p><strong>${authorName}</strong> nevnte deg i en merknad på leadet <strong>${
                lead.person_info
              }</strong>.</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 3px solid #4f46e5;">
                <p style="margin: 0;">${content.replace(
                  /@\[([^\]]+)\]/g,
                  "<strong>@$1</strong>",
                )}</p>
              </div>
              <hr style="border: 0; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
              <div>
                <h3 style="color: #4f46e"}>Lead Detaljer:</h3>
                <p><strong>Navn:</strong> ${lead.person_info}</p>
                <p><strong>Adresse:</strong> ${lead.address}</p>
              </div>
              <div style="text-align: center; margin-top: 30px;">
                <a href="${window.location.origin}/leads/${
                  lead.id
                }?tab=Merknader" style="background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">Vis Lead</a>
              </div>
            </div>
            <div style="background-color: #f2f2f2; text-align: center; padding: 15px; font-size: 12px; color: #666;">
              <p>Dette er en automatisk varsling fra Soleklart Dashboard.</p>
            </div>
          </div>
        `;

        await fetch("/api/send-mail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: user.email,
            subject: emailSubject,
            html: emailHtml,
          }),
        });
      }
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!noteId) return;

    const confirmDelete = window.confirm("Er du sikker på at du vil slette?");
    if (!confirmDelete) return;

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

  return (
    <section className="mt-8 border-t pt-4">
      <h2 className="text-lg font-semibold mb-2">Merknader</h2>

      {/* Legg til ny merknad */}
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
              setAttachments(e.target.files ? Array.from(e.target.files) : [])
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
        <button
          type="submit"
          className="bg-indigo-600 text-white px-3 py-1 rounded-md text-sm hover:bg-indigo-700"
        >
          Legg til
        </button>
      </form>

      {/* Liste over merknader */}
      <ul className="space-y-3">
        {notes.map((note) => {
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
                  <p className="text-sm text-gray-400">
                    {new Date(note.created_at ?? "").toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteNote(note.id)}
                  className="py-2 px-4 h-fit bg-red-200 hover:bg-red-500 text-red-500 hover:text-white duration-200 rounded-md font-medium items-center flex flex-row gap-1 text-sm"
                >
                  Slett
                </button>
              </div>

              <div
                className="text-sm text-slate-600 mb-4 mt-2"
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

              {/* Kommentarer */}
              <div className="ml-3 border-l pl-2 space-y-1">
                {comments.map((comment) => (
                  <p key={comment.id} className="text-xs text-gray-700">
                    <span className="font-medium">{comment.user?.name}:</span>{" "}
                    {comment.content}
                  </p>
                ))}

                {/* Legg til kommentar */}
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
