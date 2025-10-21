"use client";

import { useEffect, useState } from "react";
import {
  getLeadNotes,
  createLeadNote,
  getLeadNoteComments,
  createLeadNoteComment,
} from "@/lib/api";
import { Note, NoteComment } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface Props {
  leadId: string;
}

export default function LeadNotesSection({ leadId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [comments, setComments] = useState<Record<string, NoteComment[]>>({});
  const [newNote, setNewNote] = useState("");
  const [newComments, setNewComments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!leadId) return;
    (async () => {
      const notesData = await getLeadNotes(leadId);
      setNotes(notesData ?? []);
      const allComments: Record<string, NoteComment[]> = {};
      for (const n of notesData ?? []) {
        const c = await getLeadNoteComments(n.id);
        allComments[n.id] = c ?? [];
      }
      setComments(allComments);
    })();
  }, [leadId]);

  const handleAddNote = async (e: React.FormEvent) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    e.preventDefault();
    if (!newNote.trim() || !user?.id) return;
    const note = await createLeadNote(leadId, user.id, newNote.trim());
    setNotes([note, ...notes]);
    setNewNote("");
    console.log(note);
  };

  const handleAddComment = async (noteId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    const text = newComments[noteId]?.trim();
    if (!text || !user?.id) return;
    const comment = await createLeadNoteComment(noteId, user.id, text);
    setComments({
      ...comments,
      [noteId]: [...(comments[noteId] ?? []), comment],
    });
    setNewComments({ ...newComments, [noteId]: "" });
  };

  return (
    <section className="mt-8 border-t pt-4">
      <h2 className="text-lg font-semibold mb-2">Merknader</h2>

      <form onSubmit={handleAddNote} className="mb-3 flex gap-2">
        <input
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Skriv en ny merknad..."
          className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm"
        />
        <button
          type="submit"
          className="bg-indigo-600 text-white px-3 py-1 rounded-md text-sm"
        >
          Legg til
        </button>
      </form>

      <ul className="space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="border p-2 rounded-md">
            <div className="flex flex-row justify-between items-center text-lg">
              <p>Merknad av {note.user?.name}</p>
              <p className="text-sm">
                {new Date(note.created_at ?? "").toLocaleString("no")}
              </p>
            </div>
            <p className="text-sm text-slate-700">{note.content}</p>

            <div className="mt-2 ml-3 border-l pl-2 space-y-1">
              {(comments[note.id] ?? []).map((c) => (
                <p key={c.id} className="text-xs text-gray-700">
                  {c.user?.name}: {c.content}
                </p>
              ))}
              <div className="flex gap-2 mt-1">
                <input
                  value={newComments[note.id] ?? ""}
                  onChange={(e) =>
                    setNewComments({
                      ...newComments,
                      [note.id]: e.target.value,
                    })
                  }
                  placeholder="Skriv en kommentar..."
                  className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleAddComment(note.id)}
                  className="bg-gray-200 px-2 py-1 text-xs rounded-md"
                >
                  Send
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
