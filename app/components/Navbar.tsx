"use client";

import { CLIENT_ROUTES, NAVBAR_ROUTES } from "@/constants/routes";
import InstallerGroupSelector from "./InstallerGroupSelector";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import MentionsCenter from "./MentionsCenter";
import GlobalSearch from "./GlobalSearch";
import {
  BellIcon,
  CalculatorIcon,
  ContactIcon,
  HandshakeIcon,
  LayoutDashboardIcon,
  MailIcon,
  PhoneCallIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { useRoles } from "@/context/RoleProvider";
import { useInstallerGroup } from "@/context/InstallerGroupContext";
import { Logo } from "./site/Logo";

const ROUTE_ICONS: Record<string, LucideIcon> = {
  [CLIENT_ROUTES.COLD_CALLING]: PhoneCallIcon,
  [CLIENT_ROUTES.CONTACTS]: ContactIcon,
  [CLIENT_ROUTES.LEADS]: HandshakeIcon,
  [CLIENT_ROUTES.PRICETABLE]: CalculatorIcon,
  [CLIENT_ROUTES.ADMIN]: LayoutDashboardIcon,
  [CLIENT_ROUTES.MAIL_TEMPLATES]: MailIcon,
  [CLIENT_ROUTES.TEAM]: UsersIcon,
  [CLIENT_ROUTES.PROFILE]: UserIcon,
};

const ROUTE_SECTIONS: { title: string; hrefs: string[] }[] = [
  {
    title: "Salg",
    hrefs: [
      CLIENT_ROUTES.COLD_CALLING,
      CLIENT_ROUTES.CONTACTS,
      CLIENT_ROUTES.LEADS,
      CLIENT_ROUTES.PRICETABLE,
    ],
  },
  {
    title: "Administrasjon",
    hrefs: [CLIENT_ROUTES.ADMIN, CLIENT_ROUTES.MAIL_TEMPLATES],
  },
  { title: "Konto", hrefs: [CLIENT_ROUTES.TEAM, CLIENT_ROUTES.PROFILE] },
];

const initials = (name?: string | null) =>
  (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

export default function Navbar() {
  const { teamRole, userName } = useRoles();
  const { installerGroupId } = useInstallerGroup();
  const pathname = usePathname();

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

        setColdCallingAmount(data.coldCallAmount);
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

  // Longest matching prefix wins, so /dashboard/admin/mail-templates
  // doesn't also highlight /dashboard/admin.
  const activeHref = filteredRoutes
    .map((route) => route.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  const countFor = (name: string) => {
    if (teamRole !== "admin") return null;
    if (name === "Cold Calling") return coldCallingAmount;
    if (name === "Kontakter") return contactAmount;
    return null;
  };

  return (
    <nav className="fixed z-50 flex h-screen w-64 flex-col border-r border-line bg-surface">
      <div className="flex h-16 items-center px-5">
        <Logo height={22} href={CLIENT_ROUTES.DASHBOARD} />
      </div>

      <div className="px-3">
        <div className="rounded-xl border border-line bg-gray-50 p-1.5">
          <p className="sk-eyebrow px-1.5 pb-1 pt-0.5">Installatør</p>
          <InstallerGroupSelector />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 px-3">
        {teamRole === "admin" && (
          <button
            className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm text-muted shadow-[0_1px_1px_rgba(11,27,51,0.03)] hover:border-gray-300 hover:text-ink"
            onClick={() => setIsSearchOpen(true)}
            title="Søk (⌘K)"
          >
            <SearchIcon size={15} />
            <span>Søk</span>
            <kbd className="sk-kbd ml-auto">⌘K</kbd>
          </button>
        )}
        <button
          className="sk-icon-btn border border-line bg-surface"
          onClick={openMentions}
          title="Varsler"
          aria-label="Varsler"
        >
          <BellIcon size={17} />
        </button>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        {ROUTE_SECTIONS.map((section) => {
          const routes = filteredRoutes.filter((route) =>
            section.hrefs.includes(route.href),
          );
          if (routes.length === 0) return null;

          return (
            <div key={section.title}>
              <p className="sk-eyebrow mb-1.5 px-2.5">{section.title}</p>
              <div className="flex flex-col gap-0.5">
                {routes.map((route) => {
                  const Icon = ROUTE_ICONS[route.href] ?? LayoutDashboardIcon;
                  const isActive = route.href === activeHref;
                  const count = countFor(route.name);

                  return (
                    <Link
                      href={route.href}
                      key={route.href}
                      className={`group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-brand-soft text-blue-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-ink"
                      }`}
                    >
                      {isActive && (
                        <span className="absolute -left-3 top-1.5 h-6 w-[3px] rounded-r-full bg-brand" />
                      )}
                      <Icon
                        size={17}
                        className={
                          isActive
                            ? "text-brand"
                            : "text-gray-400 group-hover:text-gray-600"
                        }
                      />
                      <span className="flex-1">{route.name}</span>
                      {count !== null && (
                        <span
                          className={`rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums ${
                            isActive
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {count.toLocaleString("nb-NO")}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href={CLIENT_ROUTES.PROFILE}
        className="m-3 flex items-center gap-3 rounded-xl border border-line p-2.5 hover:bg-gray-50"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-brand to-blue-800 text-xs font-semibold text-white">
          {initials(userName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">
            {userName || "Profil"}
          </span>
          <span className="block text-xs capitalize text-muted">
            {teamRole}
          </span>
        </span>
      </Link>

      {isMentionsOpen && <MentionsCenter onClose={closeMentions} />}
      {isSearchOpen && <GlobalSearch onClose={() => setIsSearchOpen(false)} />}
    </nav>
  );
}
