import {
  MountItem,
  Product,
  Supplier,
  SupplierCategory,
  SupplierWithProducts,
} from "@/types/price_table";
import { supabase } from "./supabase";
import {
  CreateEstimateInput,
  Estimate,
  InstallerGroup,
  Lead,
  LeadTask,
  MountVolumeReductionType,
  Note,
  RoofType,
  Session,
  Team,
  TeamCommissionType,
  User,
} from "./types";
import {
  CategoryWithSubcategories,
  ElectricalInstallationItem,
} from "@/app/components/price-calculator/supplier/Table";

export const getToken = async (): Promise<string> => {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error("No token found. User not authenticated.");
  return token;
};

const apiRequest = async <T>(
  url: string,
  method: string = "GET",
  body?: unknown,
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

export const getLeadTasks = async (leadId: string): Promise<LeadTask[]> => {
  return apiRequest<LeadTask[]>(`/api/leads/${leadId}/tasks`);
};

export type FullLead = Lead & {
  lead_tasks: LeadTask[];
  estimates: Estimate[];
};

export const getFullLeads = async (
  teamId: string,
  installerGroupId: string,
  teamRole: string,
): Promise<FullLead[]> => {
  const query = new URLSearchParams({
    teamId,
    installerGroupId,
    teamRole,
  });

  return apiRequest<FullLead[]>(`/api/full-lead?${query.toString()}`);
};

export const getInstallerDomain = async (
  installerGroupId: string,
): Promise<string> => {
  return apiRequest(`/api/installerGroups/${installerGroupId}/domain`);
};

export const getLeadTaskComments = async (
  leadId: string,
  leadTaskId: string,
): Promise<LeadTask[]> => {
  return apiRequest<LeadTask[]>(
    `/api/leads/${leadId}/tasks/comments?leadTaskId=${leadTaskId}`,
  );
};

// InstallerGroups
export const getInstallerGroups = async (
  teamId: string,
  installer_group_id: string | null,
  teamRole: string,
): Promise<InstallerGroup[]> => {
  return apiRequest<InstallerGroup[]>(
    `/api/installerGroups?team_id=${teamId}&installer_group_id=${installer_group_id}&teamRole=${teamRole}`,
  );
};

// Single installerGroup
export const getInstallerGroup = async (
  groupId: string,
): Promise<InstallerGroup> => {
  return apiRequest<InstallerGroup>(`/api/installerGroups/${groupId}`);
};

// Leads
export const getLeads = async (
  teamId: string,
  installerGroupId: string,
  teamRole: string,
  leadOwner?: string,
  leadCollector?: string,
  searchQuery?: string,
  taskDueDateFilter?: string,
): Promise<Lead[]> => {
  const query = new URLSearchParams({
    teamId,
    installerGroupId,
    teamRole,
  });

  if (leadOwner) query.append("leadOwner", leadOwner);
  if (leadCollector) query.append("leadCollector", leadCollector);
  if (searchQuery) query.append("searchQuery", searchQuery);
  if (taskDueDateFilter) query.append("taskDueDateFilter", taskDueDateFilter);

  return apiRequest<Lead[]>(`/api/leads?${query.toString()}`);
};

// Single lead
export const getLead = async (leadId: string) => {
  return apiRequest<Lead>(`/api/leads/${leadId}`);
};

// Create lead
export const createLead = async (lead: Partial<Lead>) => {
  return apiRequest<Lead>(`/api/leads`, "POST", lead);
};

// Update lead
export const updateLead = async (leadId: string, data: Partial<Lead>) => {
  return apiRequest<Lead>(`/api/leads/${leadId}`, "PATCH", data);
};

// Single estimate by ID
export const getEstimateById = async (estimateId: string) => {
  return apiRequest<Estimate>(`/api/estimates/${estimateId}`);
};

// Get all estimates for a lead
export const getEstimatesByLeadId = async (leadId: string) => {
  return apiRequest<Estimate[]>(`/api/estimates?lead_id=${leadId}`);
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
  noteId?: string,
  attachments?: { name: string; contentType: string; contentBytes: string }[],
): Promise<Note> => {
  return apiRequest<Note>(`/api/leadNotes`, "POST", {
    leadId,
    userId,
    content,
    source,
    noteId,
    attachments,
  });
};

export const getTaggableUsers = async (
  leadId: string,
  installerGroupId?: string | null,
): Promise<{ id: string; name: string; email: string }[]> => {
  const query = installerGroupId ? `?installerGroupId=${installerGroupId}` : "";

  return apiRequest<{ id: string; name: string; email: string }[]>(
    `/api/leadNotes/${leadId}/taggableUsers${query}`,
  );
};

export const getSuppliers = async () => {
  return apiRequest<Supplier[]>("/api/price_table/suppliers");
};

export const getSuppliersWithCategories = async (installerGroupId: string) => {
  return apiRequest<SupplierCategory[]>(
    `/api/price_table/suppliers/categories?installerGroupId=${installerGroupId}`,
  );
};

export const updateSuppliersWithCategories = async (
  installerGroupId: string,
  name: string,
  markup_percentage: number,
) => {
  return apiRequest<SupplierCategory>(
    `/api/price_table/suppliers/categories?installerGroupId=${installerGroupId}`,
    "PATCH",
    { name, markup_percentage },
  );
};

export const getSuppliersWithProducts = async () => {
  return apiRequest<SupplierWithProducts[]>(
    "/api/price_table/suppliers/products",
  );
};

export const getMarkupPercentages = async () => {
  return apiRequest<SupplierWithProducts[]>(
    "/api/price_table/suppliers/products",
  );
};

export const addSupplierProduct = async (
  newProduct: unknown,
): Promise<Product> => {
  return apiRequest<Product>(
    `/api/price_table/suppliers/products`,
    "POST",
    newProduct,
  );
};

export const updateSupplierPrice = async (productId: string, price: number) => {
  return apiRequest(
    `/api/price_table/suppliers/products/${productId}`,
    "PATCH",
    { price },
  );
};

export const deleteSupplierProduct = async (productId: string) => {
  return apiRequest(
    `/api/price_table/suppliers/products/${productId}`,
    "DELETE",
  );
};

export const getCategories = async () => {
  return apiRequest<CategoryWithSubcategories[]>("/api/price_table/categories");
};

export const getElectricalInstallationCategories = async (
  installerGroupId: string,
) => {
  return apiRequest<CategoryWithSubcategories[]>(
    `/api/price_table/categories/electrical?installerGroupId=${installerGroupId}`,
  );
};

export const getElectricalInstallationItems = async (
  installerGroupId: string,
) => {
  return apiRequest<ElectricalInstallationItem[]>(
    `/api/price_table/electrical_items?installerGroupId=${installerGroupId}`,
  );
};

export const addElectricalInstallationItem = async (
  newProduct: unknown,
): Promise<ElectricalInstallationItem> => {
  return apiRequest<ElectricalInstallationItem>(
    `/api/price_table/electrical_items`,
    "POST",
    newProduct,
  );
};

export const updateElectricalInstallationItem = async (
  productId: string,
  price: number,
) => {
  return apiRequest(
    `/api/price_table/electrical_items?productId=${productId}`,
    "PATCH",
    { price },
  );
};

export const deleteElectricalInstallationItem = async (productId: string) => {
  return apiRequest(
    `/api/price_table/electrical_items?productId=${productId}`,
    "DELETE",
  );
};

export const getStoredLeadEmails = async (
  leadId: string,
  installerGroupId: string,
) => {
  return apiRequest<{
    success: boolean;
    emails: import("./types").EmailContent[];
  }>(`/api/leads/${leadId}/emails/stored?installerGroupId=${installerGroupId}`);
};

// Sync emails from Outlook to database (requires Outlook auth)
export const syncLeadEmails = async (
  leadId: string,
  userId: string,
  installerGroupId: string,
) => {
  return apiRequest<{
    success: boolean;
    count: number;
  }>(`/api/leads/${leadId}/emails/sync`, "POST", {
    userId,
    installerGroupId,
  });
};

// Send email (requires Outlook auth)
export const sendLeadEmail = async (
  leadId: string,
  userId: string,
  installerGroupId: string,
  subject: string,
  body: string,
  messageId?: string,
  attachments?: { name: string; contentType: string; contentBytes: string }[],
  cc?: string[],
) => {
  return apiRequest<{
    success: boolean;
    message: string;
  }>(`/api/leads/${leadId}/emails/send`, "POST", {
    userId,
    installerGroupId,
    subject,
    body,
    messageId,
    attachments,
    cc,
  });
};

export const getRoofTypes = async () => {
  return apiRequest<RoofType[]>(`/api/price_table/roof_types`);
};

export const getMountItems = async (installerGroupId: string) => {
  return apiRequest<MountItem[]>(
    `/api/price_table/mount_items?installerGroupId=${installerGroupId}`,
  );
};

export const updateMountItems = async (
  roofTypeId: string,
  installerGroupId: string,
  data: {
    supplier_id: string | null;
    product_id: string | null;
    price_per: number;
  },
) => {
  return apiRequest<MountItem>(`/api/price_table/mount_items`, "PATCH", {
    roof_type_id: roofTypeId,
    installer_group_id: installerGroupId,
    ...data,
  });
};

export const getMountVolumeReductions = async (installerGroupId: string) => {
  return apiRequest<MountVolumeReductionType[]>(
    `/api/price_table/mount_volume_reductions?installerGroupId=${installerGroupId}`,
  );
};

export const updateMountVolumeReductions = async (
  installerGroupId: string,
  data: {
    number: number;
    amount: number;
    amount2: number;
    reduction: number;
  },
) => {
  return apiRequest<MountVolumeReductionType>(
    `/api/price_table/mount_volume_reductions`,
    "PATCH",
    {
      installer_group_id: installerGroupId,
      ...data,
    },
  );
};

export const getTeamCommission = async (teamId: string) => {
  return apiRequest<TeamCommissionType[]>(
    `/api/price_table/team_commission?teamId=${teamId}`,
  );
};

export const updateTeamCommission = async (
  teamId: string,
  data: TeamCommissionType,
) => {
  return apiRequest<TeamCommissionType>(
    `/api/price_table/team_commission`,
    "PATCH",
    {
      team_id: teamId,
      ...data,
    },
  );
};

export const addUserToInstallerGroupOrTeam = async (
  activeSelection: string,
  userId: string,
  code: string,
) => {
  return apiRequest<MountVolumeReductionType>(
    `/api/${activeSelection}/add_user`,
    "POST",
    { userId, code },
  );
};

export const getRole = async (userId: string) => {
  return apiRequest<Session>(`/api/auth/session?userId=${userId}`);
};

export type AddTeamMemberPayload = {
  name: string;
  email: string;
  role: string;
  team_id: string;
  installer_group_id: string;
};

export const addUserToTeam = async (data: AddTeamMemberPayload) => {
  return apiRequest(`/api/teams/add-member`, "POST", data);
};

export const getUser = async () => {
  return apiRequest<User>("/api/user");
};
