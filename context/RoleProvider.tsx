"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import { getRole } from "@/lib/api";
import { InstallerGroup } from "@/lib/types";

interface RoleContextType {
  teamId: string | null;
  teamRole: string | null;
  installerGroups: InstallerGroup[];
  loading: boolean;
  refetch: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamRole, setTeamRole] = useState<string | null>(null);
  const [installerGroups, setInstallerGroups] = useState<InstallerGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    if (user) {
      setLoading(true);
      try {
        const data = await getRole(user.id);
        if (data) {
          setTeamId(data.team_id);
          setTeamRole(data.team_role);
          setInstallerGroups(data.installer_groups);
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const refetch = () => {
    fetchSession();
  };

  return (
    <RoleContext.Provider
      value={{ teamId, teamRole, installerGroups, loading, refetch }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRoles() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRoles must be used within a RoleProvider");
  }
  return context;
}
