"use client";
import { useEffect, useState } from "react";
import InstallerGroupSelector from "./InstallerGroupSelector";
import { getTeam } from "@/lib/db/teams";
import { supabase } from "@/lib/supabase";
import { useTeam } from "@/context/TeamContext";

export default function Navbar() {
  const { teamId } = useTeam();
  const [data, setData] = useState();

  useEffect(() => {
    const fetchData = async () => {
      if (!teamId) return;
      const res = await getTeam(supabase, teamId);
      setData(res);
    };
    fetchData();
  }, [teamId]);
  return (
    <nav className="flex gap-4 items-center">
      <div>
        <h1 className="text-xl font-bold tracking-tight"></h1>
        <InstallerGroupSelector />
      </div>
      {JSON.stringify(data)}
    </nav>
  );
}
