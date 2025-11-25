# Role-Based Access Control (RBAC) Design (v2)

This document outlines a proposed RBAC system based on the existing database schema, leveraging a centralized frontend context and backend Row Level Security (RLS).

## 1. Core Principles

- **Simplified Role Structure:** A user's role is primarily defined by their membership in either the `team_members` or `installer_group_members` table. The `installer` role in `team_members` is removed.
- **Centralized Frontend Logic:** A React Context (`RoleProvider`) will fetch and distribute user role information, avoiding redundant API calls in components.
- **Database-level Security:** Supabase Row Level Security (RLS) will be the primary mechanism for enforcing data access rules, ensuring that users can only access data they are permitted to see.

## 2. Roles and Permissions

### Team Roles (`team_members` table)

| Role       | Permissions                                                                                                                                                                                                                                                     |
| :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**  | - Can manage team settings (add/remove members, change roles). <br> - Can manage installer groups (create/delete, add/remove members). <br> - Can view all data within the team (all leads, all estimates, etc.). <br> - Can perform all actions of a `member`. |
| **member** | - Can view and interact with all leads and data within the team. <br> - Cannot manage team settings or installer groups.                                                                                                                                        |

### Installer Group Identification (`installer_group_members` table)

If a user is present in this table, they are considered an "Installer" user for the purpose of data access.

| Role          | Permissions                                                                                                                                                                                                                                                            |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **installer** | - When logged in, the user's view is scoped to their installer group(s). They can only see leads, estimates, and other data associated with their group(s). <br> - Can be assigned leads within their group. <br> - Can update the status of leads within their group. |
| **viewer**    | - Has read-only access to all data within the installer group.                                                                                                                                                                                                         |

## 3. Implementation Strategy

### 3.1. User Session API (`/api/auth/session`)

A single API endpoint is responsible for gathering all necessary role information for a logged-in user.

- **Endpoint:** `GET /api/auth/session`
- **Action:**
  1. Retrieves the authenticated user from Supabase.
  2. Fetches their membership details from `team_members`.
  3. Fetches all their memberships from `installer_group_members`.
  4. If the user is only an installer (not in `team_members`), it infers the `team_id` from the installer group.
  5. Returns a consolidated session object with `user_id`, `team_id`, `team_role`, and an array of `installer_groups`.

### 3.2. Frontend: `RoleProvider` and `useRoles` Hook

A global provider wraps the dashboard layout to manage and distribute role information.

- **`context/RoleProvider.tsx`**:

  - On load, it calls the `/api/auth/session` endpoint.
  - It stores the session data (teamId, teamRole, installerGroups) in a React Context.
  - It provides a `useRoles` hook for easy consumption by any component.
  - It also provides a `refetch` function to allow manual reloading of role data.

- **`app/(dashboard)/layout.tsx`**:
  - The `RoleProvider` is added to the layout, wrapping all dashboard pages.

### 3.3. Backend: Supabase Row Level Security (RLS)

Instead of filtering data in every API route, we will enforce security directly in the database.

**Example RLS Policy on `leads` table:**

```sql
-- Policy: Allow team members/admins to see all leads in their team
CREATE POLICY "Allow team access"
ON public.leads
FOR SELECT
USING (
  team_id = (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  )
);

-- Policy: Allow installers to see leads for their assigned groups
CREATE POLICY "Allow installer group access"
ON public.leads
FOR SELECT
USING (
  installer_group_id IN (
    SELECT installer_group_id FROM installer_group_members WHERE user_id = auth.uid()
  )
);
```

_(Note: These are illustrative policies and need to be refined and tested.)_

This approach moves the security logic closer to the data, making it more robust and easier to manage. API routes become simpler, as they can directly query the tables without adding manual `WHERE` clauses for security.

## 4. Next Steps

1.  **Implement `RoleProvider` and integrate into the dashboard layout.** (Completed)
2.  **Create the `/api/auth/session` endpoint.** (Completed)
3.  **Define and apply Supabase RLS policies:** Go through each relevant table (`leads`, `estimates`, `lead_notes`, etc.) and create appropriate RLS policies.
4.  **Refactor API routes:** Remove manual security filtering from API routes and rely on RLS.
5.  **Adapt Frontend UI:** Use the `useRoles` hook to conditionally render UI elements based on the user's role (e.g., show "Team Settings" only for admins).
6.  **Build Role Management UI:** Create frontend components for admins to manage team and installer group members.
7.  **Create Role Management APIs:**
    - `PUT /api/teams/[id]/members`: To add/update/remove team members.
    - `PUT /api/installer-groups/[id]/members`: To add/update/remove installer group members.
