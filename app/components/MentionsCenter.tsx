"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Note } from "@/lib/types";

export default function MentionsCenter({ onClose }: { onClose: () => void }) {
  const [mentions, setMentions] = useState<Note[] | SimpleNote[]>([]);
  const router = useRouter();

  type SimpleNote = {
    id: string;
    lead_id: string;
    content: string;
    created_at: string;
  };

  useEffect(() => {
    const fetchMentions = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user?.id) return;

      // --- tags ---
      const { data: noteTags, error: noteError } = await supabase
        .from("lead_note_tags")
        .select(
          "id, created_at, note:note_id(id, content, created_at, lead_id, user:user_id(name))"
        )
        .eq("user_id", user.id)
        .not("note_id", "is", null);

      if (noteError) console.error(noteError);

      const notes: SimpleNote[] = (noteTags ?? [])
        .flatMap((t) => t.note ?? []) // t.note er et array
        .map((n) => ({
          id: n.id,
          lead_id: n.lead_id,
          content: n.content,
          created_at: n.created_at,
        }))
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      setMentions(notes);
    };

    fetchMentions();
  }, []);

  const handleGoToLead = (leadId: string) => {
    onClose();
    router.push(`/leads/${leadId}`);
  };

  return (
    <div
      className="fixed inset-0 bg-black/15 bg-opacity-50 flex justify-center items-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md p-4 rounded-md shadow-lg relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-2 right-2 text-gray-500"
          onClick={onClose}
        >
          ✕
        </button>
        <h2 className="text-lg font-semibold mb-4">
          Du er tagget i disse merknadene og kommentarene
        </h2>

        {mentions.length === 0 ? (
          <p className="text-sm text-gray-500">
            Ingen merknader eller kommentarer.
          </p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-auto">
            {mentions.map((note) => (
              <li
                key={note.id}
                className="p-2 border rounded cursor-pointer hover:bg-gray-100"
                onClick={() => handleGoToLead(note.lead_id)}
              >
                <p className="text-sm">{note.content}</p>
                <p className="text-xs text-gray-400">
                  {new Date(note.created_at ?? "").toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
