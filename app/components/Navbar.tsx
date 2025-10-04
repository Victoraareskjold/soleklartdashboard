"use client";
import InstallerGroupSelector from "./InstallerGroupSelector";

export default function Navbar() {
  return (
    <nav className="flex gap-4 items-center">
      <div>
        <h1 className="text-xl font-bold tracking-tight"></h1>
        <InstallerGroupSelector />
      </div>
    </nav>
  );
}
