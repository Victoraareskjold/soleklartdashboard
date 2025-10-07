"use client";
import { NAVBAR_ROUTES } from "@/constants/routes";
import InstallerGroupSelector from "./InstallerGroupSelector";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="flex gap-4 items-center p-2 justify-between">
      <div className="flex gap-2">
        <InstallerGroupSelector />
      </div>
      <div className="flex gap-2">
        {NAVBAR_ROUTES.map((route) => (
          <Link href={route.href} key={route.href}>
            {route.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
