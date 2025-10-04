"use client";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";

interface TeamContextType {
  teamId?: string;
  setTeamId: (id: string) => void;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider = ({ children }: { children: ReactNode }) => {
  const [teamId, setTeamIdState] = useState<string>();

  useEffect(() => {
    const storedTeamId = localStorage.getItem("teamId");
    if (storedTeamId) setTeamIdState(storedTeamId);
  }, []);

  const setTeamId = (teamId: string) => {
    localStorage.setItem("teamId", teamId);
    setTeamIdState(teamId);
  };

  return (
    <TeamContext.Provider value={{ teamId, setTeamId }}>
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) throw new Error("useTeam must be used within a TeamProvider");
  return context;
};
