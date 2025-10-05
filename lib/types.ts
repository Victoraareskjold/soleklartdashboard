export interface User {
  id: string;
  email: string;
  name?: string;
  password_hash?: string;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  leader_id: string;
  created_at: string;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  created_at: string;
}

export interface InstallerGroup {
  id: string;
  team_id: string;
  name: string;
  manager_id?: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  team_id: string;
  installer_group_id: string;
  assigned_to?: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: LeadStatus;
  source?: string;
  created_at: string;
  updated_at?: string;
}

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
