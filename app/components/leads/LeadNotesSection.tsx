"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getLeadNotes, createLeadNote, getTaggableUsers } from "@/lib/api";
import { Note } from "@/lib/types";

interface Props {
  leadId: string;
}

export default function LeadNotesSection({ leadId }: Props) {
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
      const [notesData, users] = await Promise.all([
        getLeadNotes(leadId),
        getTaggableUsers(leadId),
      ]);

      setAllNotes(notesData ?? []);
      setTaggableUsers(users);
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
  };

  const handleAddComment = async (noteId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    const text = newComments[noteId]?.trim();
    if (!text || !user?.id) return;

    const comment = await createLeadNote(
      leadId,
      user.id,
      text,
      "comment",
      noteId
    );
    setAllNotes([...allNotes, comment]);
    setNewComments({ ...newComments, [noteId]: "" });
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
    return atIndex >= 0 ? text.slice(0, atIndex) + "@" + name + " " : text;
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
