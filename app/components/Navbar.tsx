"use client";

import { CLIENT_ROUTES, NAVBAR_ROUTES } from "@/constants/routes";
import InstallerGroupSelector from "./InstallerGroupSelector";
import Link from "next/link";
import { useState } from "react";
import MentionsCenter from "./MentionsCenter";
import { BellIcon } from "lucide-react";
import { useRoles } from "@/context/RoleProvider";

export default function Navbar() {
  const [isMentionsOpen, setIsMentionsOpen] = useState(false);

  const { teamRole } = useRoles();

  const openMentions = () => setIsMentionsOpen(true);
  const closeMentions = () => setIsMentionsOpen(false);

  if (!teamRole) return null;

  return (
    <nav className="flex flex-col w-64 gap-4 p-2 border-r-2 border-slate-200 fixed h-screen bg-white z-50">
      <div className="flex gap-2">
        <InstallerGroupSelector />
      </div>
      <div className="flex flex-col gap-2">
        {teamRole !== "installer" ? (
          NAVBAR_ROUTES.map((route) => (
            <Link
              className="bg-slate-100 rounded p-2 text-slate-700 font-medium text-sm"
              href={route.href}
              key={route.href}
            >
              {route.name}
            </Link>
          ))
        ) : (
          <Link
            className="bg-slate-100 rounded px-3 py-1 text-slate-700 font-medium text-sm"
            href={CLIENT_ROUTES.PRICETABLE}
            key={CLIENT_ROUTES.PRICETABLE}
          >
            Priskalkulator
          </Link>
        )}

        {teamRole !== "installer" && (
          <button
            className="bg-slate-100 p-2 h-10 items-center w-10 rounded-full aspect-square text-slate-700 font-medium text-sm"
            onClick={openMentions}
          >
            <BellIcon />
          </button>
        )}
      </div>

      {isMentionsOpen && <MentionsCenter onClose={closeMentions} />}
    </nav>
  );
}
