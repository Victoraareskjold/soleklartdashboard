export interface Base {
  id: string;
  created_at: string;
  updated_at: string;
}

export interface User extends Base {
  email: string;
  name?: string;
  password_hash?: string;
}

export interface Team extends Base {
  name: string;
  members?: TeamMember[];
}

export interface TeamMember {
  user_id: string;
  name: string;
  role: string;
  created_at?: string;
}

export interface InstallerGroup extends Base {
  team_id: string;
  name: string;
}

export interface InstallerGroupMember {
  user_id: string;
  name: string;
  role: string;
  installer_group_id: string;
  created_at?: string;
}

export interface Session {
  user_id: string;
  team_id: string;
  team_role: "admin" | "member" | "installer" | "viewer";
  installer_groups: InstallerGroup[];
}

export interface Lead {
  id: string;
  team_id: string;
  installer_group_id: string;
  assigned_to?: string;
  person_info?: string;
  birth_date?: string;
  company?: string;
  address?: string;
  priority: string;
  own_consumption?: number;
  voltage?: number;
  phases?: number;
  roof_type_id?: string;
  roof_slope?: number;
  roof_age?: number;
  electricity_price_avg?: number;
  main_fuse?: number;
  estimate_id?: Estimate;
  created_at: string;
  updated_at?: string;
  status?: LeadStatus;
  email?: string;
  phone?: string;
}

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

// LeadEmail now only stores references to emails in Microsoft Graph
// All content is fetched on-demand from the Graph API
export interface LeadEmail {
  id: string;
  lead_id: string;
  message_id: string; // Microsoft Graph message ID
  conversation_id: string; // Thread ID from Microsoft Graph
  created_at?: string;
}

export interface EmailContent {
  id: string;
  installer_group_id: string;
  lead_id: string;
  message_id: string;
  conversation_id: string;
  subject: string;
  from_address: string;
  to_addresses: string[];
  body_preview: string;
  body: string;
  received_at: string;
  has_attachments: boolean;
  created_at?: string;
}

export interface RoofType {
  id: string;
  name: string;
}

export interface MountVolumeReductionType {
  id: string;
  number: number;
  amount: number;
  amount2: number;
  reduction: number;
}

export interface TeamCommissionType {
  id: string;
  amount: number;
  amount2?: number;
  commission: number;
  index: number;
}

export interface UserRole {
  role: string;
  team_id: string | null;
  team_role: string | null;
  installer_groups: string | null;
}
