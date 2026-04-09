"use client";

import { NAVBAR_ROUTES } from "@/constants/routes";
import InstallerGroupSelector from "./InstallerGroupSelector";
import Link from "next/link";
import { useEffect, useState } from "react";
import MentionsCenter from "./MentionsCenter";
import GlobalSearch from "./GlobalSearch";
import { BellIcon, SearchIcon } from "lucide-react";
import { useRoles } from "@/context/RoleProvider";
import { useInstallerGroup } from "@/context/InstallerGroupContext";

export default function Navbar() {
  const { teamRole } = useRoles();
  const { installerGroupId } = useInstallerGroup();

  const [isMentionsOpen, setIsMentionsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [coldCallingAmount, setColdCallingAmount] = useState(0);
  const [contactAmount, setContactAmount] = useState(0);

  const openMentions = () => setIsMentionsOpen(true);
  const closeMentions = () => setIsMentionsOpen(false);

  // Cmd+K / Ctrl+K opens search (admin only)
  useEffect(() => {
    if (teamRole !== "admin") return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [teamRole]);

  useEffect(() => {
    if (!installerGroupId) return;

    const fetchLeadCounts = async () => {
      try {
        const res = await fetch(
          `/api/coldCalling/getAmount/${installerGroupId}`,
        );
        const data = await res.json();

        setColdCallingAmount(data.coldCallingAmount);
        setContactAmount(data.contactAmount);
      } catch (err) {
        console.error(err);
      }
    };

    fetchLeadCounts();
  }, [installerGroupId]);

  if (!teamRole) return null;

  // Filter routes: installers can't see cold calling, non-admins can't see admin
  const filteredRoutes = NAVBAR_ROUTES.filter((route) => {
    if (route.adminOnly && teamRole !== "admin") return false;
    if (teamRole === "installer" && route.name.toLowerCase() === "cold calling")
      return false;
    return true;
  });

  return (
    <nav className="flex flex-col w-64 gap-4 p-2 border-r-2 border-slate-200 fixed h-screen bg-white z-50">
      <div className="flex gap-2">
        <InstallerGroupSelector />
      </div>

      <div className="flex flex-col gap-2">
        {filteredRoutes.map((route) => (
          <Link
            className="bg-slate-100 rounded p-2 text-slate-700 font-medium text-sm hover:bg-slate-200 transition-colors flex flex-row items-center justify-between"
            href={route.href}
            key={route.href}
          >
            {route.name}
            {teamRole === "admin" && route.name === "Cold Calling" && (
              <p>{coldCallingAmount}</p>
            )}
            {teamRole === "admin" && route.name === "Kontakter" && (
              <p>{contactAmount}</p>
            )}
          </Link>
        ))}

        <div className="flex items-center gap-2">
          <button
            className="bg-slate-100 p-2 h-10 flex items-center justify-center w-10 rounded-full text-slate-700 font-medium text-sm"
            onClick={openMentions}
          >
            <BellIcon size={20} />
          </button>

          {teamRole === "admin" && (
            <button
              className="bg-slate-100 p-2 h-10 flex items-center justify-center flex-1 rounded-lg text-slate-500 text-xs gap-2 hover:bg-slate-200 transition-colors"
              onClick={() => setIsSearchOpen(true)}
              title="Søk (⌘K)"
            >
              <SearchIcon size={15} />
              <span>Søk</span>
              <kbd className="ml-auto text-slate-400 text-[10px] border border-slate-300 rounded px-1">
                ⌘K
              </kbd>
            </button>
          )}
        </div>
      </div>

      {isMentionsOpen && <MentionsCenter onClose={closeMentions} />}
      {isSearchOpen && <GlobalSearch onClose={() => setIsSearchOpen(false)} />}
    </nav>
  );
}
