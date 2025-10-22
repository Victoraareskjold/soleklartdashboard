"use client";

import { NAVBAR_ROUTES } from "@/constants/routes";
import InstallerGroupSelector from "./InstallerGroupSelector";
import Link from "next/link";
import { useState } from "react";
import MentionsCenter from "./MentionsCenter";
import { BellIcon } from "lucide-react";

export default function Navbar() {
  const [isMentionsOpen, setIsMentionsOpen] = useState(false);

  const openMentions = () => setIsMentionsOpen(true);
  const closeMentions = () => setIsMentionsOpen(false);

  return (
    <nav className="flex gap-4 items-center px-2 h-12 items-center justify-between">
      <div className="flex gap-2">
        <InstallerGroupSelector />
      </div>
      <div className="flex gap-2 items-center">
        {NAVBAR_ROUTES.map((route) => (
          <Link
            className="bg-slate-100 rounded px-3 py-1 text-slate-700 font-medium text-sm"
            href={route.href}
            key={route.href}
          >
            {route.name}
          </Link>
        ))}

        <button
          className="bg-slate-100 p-2 rounded-full aspect-square text-slate-700 font-medium text-sm"
          onClick={openMentions}
        >
          <BellIcon />
        </button>
      </div>

      {isMentionsOpen && <MentionsCenter onClose={closeMentions} />}
    </nav>
  );
}
