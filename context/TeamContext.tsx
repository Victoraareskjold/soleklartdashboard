"use client";
import { getTeams } from "@/lib/api";
import { Team } from "@/lib/types";
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
  teams?: Team[];
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider = ({ children }: { children: ReactNode }) => {
  const [teamId, setTeamIdState] = useState<string>();
  const [teams, setTeams] = useState<Team[]>();

  useEffect(() => {
    const initializeTeamId = async () => {
      try {
        const fetchedTeams = await getTeams();
        setTeams(fetchedTeams);

        // Sjekk først localStorage
        const storedTeamId = localStorage.getItem("teamId");
        if (storedTeamId) {
          setTeamIdState(storedTeamId);
          return;
        }

        // Hvis ingen lagret teamId, sett teams[0] som default
        if (fetchedTeams && fetchedTeams.length > 0) {
          const defaultTeamId = fetchedTeams[0].id;
          setTeamIdState(defaultTeamId);
          localStorage.setItem("teamId", defaultTeamId);
        }
      } catch (err) {
        console.error("Failed to fetch teams:", err);
      }
    };

    initializeTeamId();
  }, []);

  const setTeamId = (teamId: string) => {
    localStorage.setItem("teamId", teamId);
    setTeamIdState(teamId);
  };

  return (
    <TeamContext.Provider value={{ teamId, setTeamId, teams }}>
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) throw new Error("useTeam must be used within a TeamProvider");
  return context;
};
