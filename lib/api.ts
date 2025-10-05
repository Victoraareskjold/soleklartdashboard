import { supabase } from "./supabase";
import { InstallerGroup, Lead, Team } from "./types";

const getToken = async (): Promise<string> => {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("No token found. User not authenticated.");
  return token;
};

const apiRequest = async <T>(
  url: string,
  method: string = "GET",
  body?: any
): Promise<T> => {
  const token = await getToken();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "API error");
  }

  return res.json();
};

// Teams
export const getTeams = async (): Promise<Team[]> => {
  return apiRequest<Team[]>("/api/teams");
};

// Single team
export const getTeam = async (teamId: string): Promise<Team> => {
  return apiRequest<Team>(`/api/teams/${teamId}`);
};

// InstallerGroups
export const getInstallerGroups = async (
  teamId: string
): Promise<InstallerGroup[]> => {
  return apiRequest<InstallerGroup[]>(`/api/installerGroups?team_id=${teamId}`);
};

// Single installerGroup
export const getInstallerGroup = async (
  groupId: string
): Promise<InstallerGroup> => {
  return apiRequest<InstallerGroup>(`/api/installerGroups/${groupId}`);
};

// Leads
export const getLeads = async (
  teamId: string,
  installerGroupId: string
): Promise<Lead[]> => {
  const query = new URLSearchParams({ teamId, installerGroupId });
  return apiRequest<Lead[]>(`/api/leads?${query.toString()}`);
};

// Single lead
export const getLead = async (id: string) => {
  return apiRequest<Lead>(`/api/leads/${id}`);
};

// Create lead
export const createLead = async (lead: Lead) => {
  return apiRequest<Lead>(`/api/leads`, "POST", lead);
};

// Update lead
export const updateLead = async (id: string, data: Partial<Lead>) => {
  return apiRequest<Lead>(`/api/leads/${id}`, "PATCH", data);
};
