import { supabase } from "./supabase";
import { InstallerGroup, Team } from "./types";

const getToken = async (): Promise<string> => {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("No token found. User not authenticated.");
  return token;
};

const apiGet = async <T>(url: string): Promise<T> => {
  const token = await getToken();
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "API error");
  }

  return res.json();
};

// Teams
export const getTeams = async (): Promise<Team[]> => {
  return apiGet<Team[]>("/api/teams");
};

// InstallerGroups
export const getInstallerGroups = async (
  teamId: string
): Promise<InstallerGroup[]> => {
  return apiGet<InstallerGroup[]>(`/api/installerGroups?team_id=${teamId}`);
};

// Single installerGroup
export const getInstallerGroup = async (
  groupId: string
): Promise<InstallerGroup> => {
  return apiGet<InstallerGroup>(`/api/installerGroups/${groupId}`);
};
