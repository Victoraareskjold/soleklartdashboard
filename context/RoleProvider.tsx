"use client";

import {
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
  userName: string | null;
  installer_group_id: string | null;
  loading: boolean;
  refetch: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [teamRole, setTeamRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [installer_group_id, set_installer_group_id] = useState<string | null>(
    null,
  );

  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    if (user) {
      setLoading(true);
      try {
        const data = await getRole(user.id);
        if (data) {
          setTeamRole(data.team_role);
          setUserName(data.user_name);
          set_installer_group_id(data.installer_group_id);
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
      value={{ teamRole, userName, installer_group_id, loading, refetch }}
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
