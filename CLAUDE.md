# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server on PORT=4000 (Turbopack)
npm run build    # Production build (Turbopack)
npm start        # Run production server
npm run lint     # ESLint check
```

No test runner is configured.

## Architecture Overview

**SoleKlart Dashboard** — a Next.js 16 App Router application for managing solar panel installation leads, estimates, and teams.

### Tech Stack

- **Frontend**: React 19, Next.js 16, Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Auth)
- **Email**: Nodemailer + Microsoft Graph API (Outlook integration)
- **UI**: Lucide React icons, React Toastify, TipTap (rich text), Recharts, @hello-pangea/dnd

### Route Groups

- `app/(auth)/` — public auth pages
- `app/(dashboard)/` — protected dashboard pages (leads, estimates, contacts, cold-calling, overview, team, price-table)
- `app/api/` — REST API routes

### Data Model Hierarchy

Teams → Installer Groups → Leads → Estimates / Notes / Tasks / Emails

Key tables: `users`, `teams`, `team_members`, `installer_groups`, `installer_group_members`, `leads`, `estimates`, `lead_notes`, `email_accounts`, `email_messages`

See [dbschema.sql](dbschema.sql) for full schema documentation.

### Auth & RBAC

- **Supabase Auth** with JWT tokens passed as Bearer headers to all API routes
- **Two role layers**: team roles (`admin`/`member`) and installer group roles (`installer`/`viewer`)
- Auth state from `context/AuthProvider.tsx`; roles from `context/RoleProvider.tsx`
- Team/installer group selection persisted in `localStorage` and managed via `context/TeamContext.tsx` and `context/InstallerGroupContext.tsx`
- See [roles.md](roles.md) for the full RBAC design

### API Pattern

Every API route:

1. Extracts the Bearer token: `req.headers.get("Authorization")?.replace("Bearer ", "")`
2. Creates a per-request Supabase client with that token
3. Filters data by `teamId`/`installerGroupId` from query params

Frontend API calls go through `lib/api.ts` which wraps `apiRequest()` — a typed helper that adds Bearer auth headers automatically.

### Key Files

- [lib/api.ts](lib/api.ts) — all frontend-to-backend API calls
- [lib/types.ts](lib/types.ts) — shared TypeScript interfaces
- [lib/db/](lib/db/) — Supabase database query helpers
- [lib/graph.ts](lib/graph.ts) — Microsoft Graph API utilities
- [constants/leadStatuses.ts](constants/leadStatuses.ts) — lead status definitions
- [constants/mailTemplates.json](constants/mailTemplates.json) — email templates
