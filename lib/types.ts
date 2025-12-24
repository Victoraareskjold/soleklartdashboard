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
  installer_group_id?: string;
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
  installer_group_id: string | null;
}

export interface Lead {
  id: string;
  team_id: string;
  installer_group_id: string;
  assigned_to?: string | null;
  created_by?: string | null;
  person_info?: string | null;
  birth_date?: string | null;
  company?: string | null;
  address?: string | null;
  priority: string | null;
  own_consumption?: number | null;
  voltage?: number | null;
  phases?: number | null;
  roof_type_id?: string | null;
  roof_slope?: number | null;
  roof_age?: number | null;
  electricity_price_avg?: number | null;
  main_fuse?: number | null;
  estimate_id?: Estimate;
  created_at: string | null;
  updated_at?: string | null;
  status?: number | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  role?: string | null;
  note?: string | null;
}

import { SolarData } from "@/app/components/SolarDataView";
import { PriceOverview } from "@/types/price_table";

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
  price_data?: PriceOverview;
}

export type CreateEstimateInput = Partial<Estimate> & { lead_id: string } & {
  solarData: SolarData;
  imageUrl?: File | null;
};

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

export type LeadTask = {
  id: string;
  lead_id: string;
  created_at: string;
  due_date: string;
  title: string;
  description: string;
  assigned_to: string;
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

export interface EmailAccount extends Base {
  user_id: string;
  installer_group_id: string;
  provider: "outlook" | "gmail";
  email: string;
  access_token: string;
  refresh_token: string;
  id_token?: string;
  scope?: string;
  token_type: string;
  expires_at: string; // ISO 8601 string
  ext_expires_at?: string; // ISO 8601 string
}
