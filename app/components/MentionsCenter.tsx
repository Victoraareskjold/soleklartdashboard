"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Note } from "@/lib/types";
import { CLIENT_ROUTES } from "@/constants/routes";
import { AtSign, BellOff, ChevronRight, MessageSquare, X } from "lucide-react";

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

  const handleGoToLead = (note: SimpleNote) => {
    onClose();
    router.push(`${CLIENT_ROUTES.LEADS}/${note.lead_id}?tab=Merknader`);
  };

  const relativeTime = (iso: string) => {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    if (Number.isNaN(diff)) return "";
    const min = Math.round(diff / 60000);
    if (min < 1) return "Akkurat nå";
    if (min < 60) return `${min} min siden`;
    const hours = Math.round(min / 60);
    if (hours < 24) return `${hours} t siden`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days} d siden`;
    return date.toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="sk-overlay z-[9999] items-start pt-[10vh]" onClick={onClose}>
      <div
        className="sk-modal flex max-w-md flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <AtSign size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="sk-section-title leading-snug">
              Du er tagget i disse merknadene og kommentarene
            </h2>
          </div>
          <button className="sk-icon-btn -mr-2 -mt-1 size-8" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {mentions.length === 0 ? (
          <div className="p-5">
            <div className="sk-empty">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <BellOff size={18} />
              </span>
              Ingen merknader eller kommentarer.
            </div>
          </div>
        ) : (
          <ul className="max-h-96 space-y-0.5 overflow-auto p-2">
            {mentions.map((note) => (
              <li
                key={note.id}
                className="group flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-brand-soft"
                onClick={() => handleGoToLead(note as SimpleNote)}
              >
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-gray-50 text-muted transition-colors group-hover:border-blue-200 group-hover:bg-white group-hover:text-brand">
                  <MessageSquare size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-3 text-sm text-ink">{note.content}</p>
                  <p
                    className="mt-1 text-[11px] font-medium text-muted"
                    title={new Date(note.created_at ?? "").toLocaleString()}
                  >
                    {relativeTime(note.created_at ?? "")}
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className="mt-2 shrink-0 text-gray-300 transition-colors group-hover:text-brand"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
