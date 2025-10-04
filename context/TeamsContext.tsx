"use client";
import { getInstallerGroups, getTeams } from "@/lib/api";
import { InstallerGroup, Team } from "@/lib/types";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface TeamsContextType {
  teams: Team[];
  installerGroups: Record<string, InstallerGroup[]>;
  selectedTeam?: string;
  setSelectedTeam: (teamId: string) => void;
  selectedInstallerGroup?: string;
  setSelectedInstallerGroup: (installerGroupId: string) => void;
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

export const TeamsProvider = ({ children }: { children: ReactNode }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [installerGroups, setInstallerGroups] = useState<
    Record<string, InstallerGroup[]>
  >({});
  const [selectedTeam, setSelectedTeamState] = useState<string>();

  const [selectedInstallerGroup, setSelectedInstallerGroupState] =
    useState<string>();

  const setSelectedTeam = (teamId: string) => {
    localStorage.setItem("selectedTeam", teamId);
    setSelectedTeamState(teamId);
    setSelectedInstallerGroupState(undefined);
  };

  const setSelectedInstallerGroup = (installerGroupId: string) => {
    localStorage.setItem("selectedInstallerGroup", installerGroupId);
    setSelectedInstallerGroupState(installerGroupId);
  };

  useEffect(() => {
    getTeams()
      .then((fetchedTeams) => {
        setTeams(fetchedTeams);

        const storedTeam = localStorage.getItem("selectedTeam");
        if (storedTeam) {
          setSelectedTeamState(storedTeam);
        } else if (fetchedTeams.length > 0) {
          setSelectedTeamState(fetchedTeams[0].id);
        }
      })
      .catch(console.error);

    const storedInstallerGroup = localStorage.getItem("selectedInstallerGroup");
    if (storedInstallerGroup)
      setSelectedInstallerGroupState(storedInstallerGroup);
  }, [selectedTeam]);

  useEffect(() => {
    if (!selectedTeam) return;
    if (installerGroups[selectedTeam]) return;

    getInstallerGroups(selectedTeam)
      .then((groups) => {
        setInstallerGroups((prev) => ({ ...prev, [selectedTeam]: groups }));

        if (!selectedInstallerGroup && groups.length > 0) {
          setSelectedInstallerGroup(groups[0].id);
        }
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeam]);

  return (
    <TeamsContext.Provider
      value={{
        teams,
        installerGroups,
        selectedTeam,
        setSelectedTeam,
        selectedInstallerGroup,
        setSelectedInstallerGroup,
      }}
    >
      {children}
    </TeamsContext.Provider>
  );
};

export const useTeams = () => {
  const context = useContext(TeamsContext);
  if (!context) throw new Error("useTeams must be used within a TeamsProvider");
  return context;
};
