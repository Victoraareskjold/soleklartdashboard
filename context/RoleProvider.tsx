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

interface RoleContextType {
  teamRole: string | null;
  loading: boolean;
  refetch: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teamRole, setTeamRole] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    if (user) {
      setLoading(true);
      try {
        const data = await getRole(user.id);
        if (data) {
          setTeamRole(data.team_role);
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
    <RoleContext.Provider value={{ teamRole, loading, refetch }}>
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
