"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getLeadNotes,
  createLeadNote,
  getLeadNoteComments,
  createLeadNoteComment,
  getTaggableUsers,
} from "@/lib/api";
import { Note, NoteComment } from "@/lib/types";

interface Props {
  leadId: string;
}

export default function LeadNotesSection({ leadId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [comments, setComments] = useState<Record<string, NoteComment[]>>({});
  const [newNote, setNewNote] = useState("");
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [taggableUsers, setTaggableUsers] = useState<
    { id: string; name: string }[]
  >([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<
    { id: string; name: string }[]
  >([]);

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

      const users = await getTaggableUsers(leadId);
      setTaggableUsers(users);
    })();
  }, [leadId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!newNote.trim() || !user?.id) return;

    const note = await createLeadNote(leadId, user.id, newNote.trim());
    setNotes([note, ...notes]);
    setNewNote("");
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

  const handleNoteChange = (text: string) => {
    setNewNote(text);
    const atIndex = text.lastIndexOf("@");
    if (atIndex >= 0) {
      const query = text.slice(atIndex + 1).toLowerCase();
      setMentionSuggestions(
        taggableUsers.filter((u) => u.name.toLowerCase().startsWith(query))
      );
    } else {
      setMentionSuggestions([]);
    }
  };

  const handleSelectMention = (name: string) => {
    const atIndex = newNote.lastIndexOf("@");
    if (atIndex >= 0) {
      const newText = newNote.slice(0, atIndex) + "@" + name + " ";
      setNewNote(newText);
      setMentionSuggestions([]);
    }
  };

  return (
    <section className="mt-8 border-t pt-4">
      <h2 className="text-lg font-semibold mb-2">Merknader</h2>

      <form onSubmit={handleAddNote} className="mb-3 flex flex-col gap-2">
        <div className="relative">
          <input
            value={newNote}
            onChange={(e) => handleNoteChange(e.target.value)}
            placeholder="Skriv en ny merknad..."
            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
          {mentionSuggestions.length > 0 && (
            <ul className="absolute bg-white border mt-1 w-full max-h-32 overflow-auto z-10">
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
          className="bg-indigo-600 text-white px-3 py-1 rounded-md text-sm"
        >
          Legg til
        </button>
      </form>

      <ul className="space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="border p-2 rounded-md">
            <p className="text-sm">{note.content}</p>
            <p className="text-xs text-gray-500 mt-1">{note.user?.name}</p>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(note.created_at ?? "").toLocaleString()}
            </p>

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
