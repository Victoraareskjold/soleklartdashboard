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
import { Lead, Note } from "@/lib/types";
import { toast } from "react-toastify";

interface Props {
  leadId: string;
}

export default function LeadNotesSection({ leadId }: Props) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [taggableUsers, setTaggableUsers] = useState<
    { id: string; name: string }[]
  >([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<
    { id: string; name: string }[]
  >([]);
  const [commentMentionSuggestions, setCommentMentionSuggestions] = useState<
    Record<string, { id: string; name: string }[]>
  >({});

  useEffect(() => {
    if (!leadId) return;

    const fetchData = async () => {
      const [leadData, notesData, users] = await Promise.all([
        getLead(leadId),
        getLeadNotes(leadId),
        getTaggableUsers(leadId),
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
          new Date(a.created_at ?? 0).getTime()
      );

      setAllNotes(combinedNotes);
    };

    fetchData();
  }, [leadId]);

  // Filtrer ut bare hovednotater (ikke kommentarer)
  const notes = allNotes.filter((note) => note.source === "note");

  // Hent alle kommentarer for en spesifikk note
  const getCommentsForNote = (noteId: string) => {
    return allNotes.filter(
      (item) => item.source === "comment" && item.note_id === noteId
    );
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!newNote.trim() || !user?.id) return;

    const note = await createLeadNote(leadId, user.id, newNote.trim(), "note");
    setAllNotes([note, ...allNotes]);
    setNewNote("");
    setMentionSuggestions([]);

    await fetch("/api/send-mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: user.email,
        subject: "Soleklart Dashboard",
        html: "<p>Vi har mottatt meldingen din.</p>",
      }),
    });
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
          "note"
        );

        // Add the new comment to the permanent note
        const newComment = await createLeadNote(
          leadId,
          user.id,
          text,
          "comment",
          permanentNote.id
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
              new Date(a.created_at ?? 0).getTime()
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
        noteId
      );
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
    setter: (suggestions: { id: string; name: string }[]) => void
  ) => {
    const atIndex = text.lastIndexOf("@");
    if (atIndex >= 0) {
      const query = text.slice(atIndex + 1).toLowerCase();
      setter(
        taggableUsers.filter((u) => u.name.toLowerCase().startsWith(query))
      );
    } else {
      setter([]);
    }
  };

  const handleNoteChange = (text: string) => {
    setNewNote(text);
    updateMentionSuggestions(text, setMentionSuggestions);
  };

  const handleCommentChange = (noteId: string, text: string) => {
    setNewComments({ ...newComments, [noteId]: text });
    updateMentionSuggestions(text, (suggestions) =>
      setCommentMentionSuggestions({
        ...commentMentionSuggestions,
        [noteId]: suggestions,
      })
    );
  };

  const insertMention = (text: string, name: string) => {
    const atIndex = text.lastIndexOf("@");
    return atIndex >= 0 ? text.slice(0, atIndex) + `@[${name}]` + " " : text;
  };

  const handleSelectMention = (name: string) => {
    setNewNote(insertMention(newNote, name));
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

  return (
    <section className="mt-8 border-t pt-4">
      <h2 className="text-lg font-semibold mb-2">Merknader</h2>

      {/* Legg til ny merknad */}
      <form onSubmit={handleAddNote} className="mb-3 flex flex-col gap-2">
        <div className="relative">
          <input
            value={newNote}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Skriv en ny merknad..."
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
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
                <p className="text-lg">Merknad av {note.user?.name}</p>
                <p className="text-sm text-gray-400">
                  {new Date(note.created_at ?? "").toLocaleString()}
                </p>
              </div>
              <p className="text-sm text-slate-600 mb-4 mt-2">{note.content}</p>

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
