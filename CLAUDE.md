# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 dashboard application for managing solar installation sales. The application handles lead management, solar estimates, pricing tables, and team collaboration for solar installation businesses.

## Development Commands

```bash
# Start development server (runs on port 4000)
bun run dev

# Build for production (uses Turbopack)
bun run build

# Start production server
bun start

# Run linter
bun run lint
```

Note: The dev server runs on port 4000, not the default 3000.

## Architecture

### Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode enabled)
- **Styling**: Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth with JWT tokens
- **Key Libraries**:
  - `@hello-pangea/dnd` for drag-and-drop kanban boards
  - `react-toastify` for notifications
  - `nodemailer` for email functionality

### Application Structure

The app uses Next.js App Router with route groups:

- `app/(auth)/` - Authentication pages
- `app/(dashboard)/` - Protected dashboard pages with shared layout
- `app/api/` - Backend API routes

Key pages:

- `/dashboard/leads` - Kanban board for lead management
- `/dashboard/leads/[leadId]` - Individual lead detail with notes and estimates
- `/dashboard/pricetable` - Supplier product pricing management
- `/dashboard/team` - Team member management

### Data Flow Pattern

The application follows a strict three-layer architecture:

1. **Client Layer** (`lib/api.ts`)

   - All client-side API calls go through wrapper functions
   - Automatically includes Bearer token from Supabase session
   - Centralized error handling

2. **API Route Layer** (`app/api/**/route.ts`)

   - Extract token from Authorization header
   - Create authenticated Supabase client
   - Call database layer functions
   - Return JSON responses

3. **Database Layer** (`lib/db/*.ts`)
   - Direct Supabase queries using `.from()` and `.select()`
   - Each entity has its own file (leads.ts, teams.ts, estimates.ts, etc.)
   - Functions accept authenticated SupabaseClient as first parameter

Example flow:

```
Component → lib/api.ts:getLeads() → /api/leads → lib/db/leads.ts:getLeads() → Supabase
```

### State Management

- **TeamContext** (`context/TeamContext.tsx`): Manages selected team, persisted to localStorage
- **InstallerGroupContext** (`context/InstallerGroupContext.tsx`): Manages selected installer group (session state)
- Both providers wrap the dashboard layout at `app/(dashboard)/layout.tsx`

### Authentication Pattern

All API routes require authentication:

1. Extract token: `req.headers.get("authorization")?.replace("Bearer ", "")`
2. Create authenticated client: `createClient(token)`
3. Client automatically validates token and includes it in queries

Client-side API calls automatically include token from Supabase session via `lib/api.ts:getToken()`.

### Import Aliases

- `@/*` maps to root directory (configured in tsconfig.json)
- Example: `import { Lead } from "@/lib/types"`

## Key Data Models

Core types defined in `lib/types.ts`:

- **Lead**: Sales lead with status (new → contacted → qualified → won/lost)
- **Estimate**: Solar installation estimate with panel count, roof data, production/cost calculations
- **Team**: Organization unit with leader and members
- **InstallerGroup**: Sub-team within a Team
- **Note**: Lead notes/comments with mention support

Lead statuses: `"new" | "contacted" | "qualified" | "won" | "lost"`

## Important Patterns

### Adding a New API Endpoint

1. Create database function in `lib/db/[entity].ts`:

```typescript
export async function getEntity(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("table_name")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
```

2. Create API route in `app/api/[entity]/route.ts`:

```typescript
export async function GET(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const client = createClient(token);
    const data = await getEntity(client, id);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

3. Add client wrapper in `lib/api.ts`:

```typescript
export const getEntity = async (id: string) => {
  return apiRequest<Entity>(`/api/entity/${id}`);
};
```

### Lead Notes with Mentions

Lead notes support @mentions:

- Use `@` to trigger mention suggestions
- Tagged users are stored in `lead_note_tags` table
- Get mentionable users via `getTaggableUsers(leadId)`
- Notes can have comments (replies with `note_id` set)

### Drag-and-Drop Leads

Uses `@hello-pangea/dnd` library:

- Leads organized by status in kanban columns
- Drag updates lead status optimistically
- API call to persist change with rollback on error

## Database Schema Notes

- Supabase PostgreSQL with Row Level Security (RLS)
- All queries must use authenticated client for RLS to work
- Common tables: `users`, `teams`, `team_members`, `installer_groups`, `leads`, `estimates`, `lead_notes`, `lead_note_tags`, `suppliers`, `products`

## Environment Variables

The application requires a `.env` file (see `.env.example` if available) with:

- Supabase URL and anon key
- Database connection strings
- Email service credentials (for nodemailer)

## Code Style

- Use TypeScript strict mode
- Prefer functional components with hooks
- Use async/await over promises
- Keep components focused and modular
- Use Tailwind utility classes for styling
- Follow established patterns in `lib/api.ts` and `lib/db/` for consistency
