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
  created_at?: string;
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
  priority: string;
  address?: string;
  estimate?: Estimate;
}

export type CreateLeadInput = {
  team_id: string;
  installer_group_id: string;
  assigned_to?: string;
  name: string;
  email?: string;
  phone?: string;
  status: LeadStatus;
  source?: string;
  priority: string;
  address?: string;
};

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Estimate {
  id: string;
  lead_id: string;
  created_at?: string;
  updated_at?: string;

  image_url?: string;

  total_panels?: number;
  selected_panel_type?: string;
  selected_roof_type?: string;
  checked_roof_data?: Array<{
    roof_id: string;
    adjusted_panel_count: number;
    max_panels: number;
    direction: string;
    angle: number;
  }>;
  selected_el_price?: number;
  yearly_cost?: number;
  yearly_cost2?: number;
  yearly_prod?: number;
  desired_kwh?: number;
  coverage_percentage?: number;
}

export type CreateEstimateInput = Partial<Estimate> & { lead_id: string };

export type Note = {
  id: string;
  lead_id: string;
  user_id: string;
  user?: { id: string; name: string };
  content: string;
  created_at?: string;
  updated_at?: string;
  source: "note" | "comment";
  note_id?: string | null;
};
