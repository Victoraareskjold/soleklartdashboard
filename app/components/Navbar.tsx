"use client";

import { NAVBAR_ROUTES } from "@/constants/routes";
import InstallerGroupSelector from "./InstallerGroupSelector";
import Link from "next/link";
import { useState } from "react";
import MentionsCenter from "./MentionsCenter";
import { BellIcon } from "lucide-react";
import { useRoles } from "@/context/RoleProvider";

export default function Navbar() {
  const [isMentionsOpen, setIsMentionsOpen] = useState(false);
  const { teamRole, userName } = useRoles();

  const openMentions = () => setIsMentionsOpen(true);
  const closeMentions = () => setIsMentionsOpen(false);

  if (!teamRole) return null;

  // 1. Definer hvilke ruter som skal filtreres bort for installers
  const filteredRoutes =
    teamRole === "installer"
      ? NAVBAR_ROUTES.filter(
          (route) => route.name.toLowerCase() !== "cold calling",
        )
      : NAVBAR_ROUTES;

  return (
    <nav className="flex flex-col w-64 gap-4 p-2 border-r-2 border-slate-200 fixed h-screen bg-white z-50">
      <div className="flex gap-2">
        <InstallerGroupSelector />
      </div>

      <div className="flex flex-col gap-2">
        {/* 2. Map gjennom de filtrerte rutene */}
        {filteredRoutes.map((route) => (
          <Link
            className="bg-slate-100 rounded p-2 text-slate-700 font-medium text-sm hover:bg-slate-200 transition-colors"
            href={route.href}
            key={route.href}
          >
            {route.name}
          </Link>
        ))}

        <button
          className="bg-slate-100 p-2 h-10 flex items-center justify-center w-10 rounded-full text-slate-700 font-medium text-sm"
          onClick={openMentions}
        >
          <BellIcon size={20} />
        </button>
      </div>

      {isMentionsOpen && <MentionsCenter onClose={closeMentions} />}
    </nav>
  );
}
