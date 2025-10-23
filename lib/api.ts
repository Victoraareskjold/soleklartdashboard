import { Supplier, SupplierWithProducts } from "@/types/price_table";
import { supabase } from "./supabase";
import {
  CreateEstimateInput,
  CreateLeadInput,
  Estimate,
  InstallerGroup,
  Lead,
  Note,
  Team,
} from "./types";

export const getToken = async (): Promise<string> => {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("No token found. User not authenticated.");
  return token;
};

const apiRequest = async <T>(
  url: string,
  method: string = "GET",
  body?: unknown
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
export const getLead = async (leadId: string) => {
  return apiRequest<Lead>(`/api/leads/${leadId}`);
};

// Create lead
export const createLead = async (lead: CreateLeadInput) => {
  return apiRequest<Lead>(`/api/leads`, "POST", lead);
};

// Update lead
export const updateLead = async (leadId: string, data: Partial<Lead>) => {
  return apiRequest<Lead>(`/api/leads/${leadId}`, "PATCH", data);
};

// Signle estimate
export const getEstimate = async (estimateId: string) => {
  return apiRequest<Estimate>(`/api/estimates/${estimateId}`);
};

// Create estimate
export const createEstimate = async (estimate: CreateEstimateInput) => {
  return apiRequest<Estimate>(`/api/estimates`, "POST", estimate);
};

// Update estimate
export const updateEstimate = async (estimateId: string, data: unknown) => {
  return apiRequest<Lead>(`/api/estimates/${estimateId}`, "PATCH", data);
};

// Lead Notes
export const getLeadNotes = async (leadId: string) => {
  return apiRequest<Note[]>(`/api/leadNotes?lead_id=${leadId}`);
};

export const createLeadNote = async (
  leadId: string,
  userId: string,
  content: string,
  source: string,
  noteId?: string
): Promise<Note> => {
  return apiRequest<Note>(`/api/leadNotes`, "POST", {
    leadId,
    userId,
    content,
    source,
    noteId,
  });
};

export const getTaggableUsers = async (
  leadId: string
): Promise<{ id: string; name: string }[]> => {
  return apiRequest<{ id: string; name: string }[]>(
    `/api/leadNotes/${leadId}/taggableUsers`
  );
};

export const getSuppliers = async () => {
  return apiRequest<Supplier[]>("/api/price_table/suppliers");
};

export const getSuppliersWithProducts = async () => {
  return apiRequest<SupplierWithProducts[]>(
    "/api/price_table/suppliers/products"
  );
};
