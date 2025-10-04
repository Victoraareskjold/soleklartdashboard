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
