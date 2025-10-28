# Lead Email Integration

This document describes the email integration feature for lead management, which allows bidirectional email communication with leads directly from the lead detail page.

## Overview

The email integration connects Microsoft Outlook/Office 365 emails with leads, enabling:
- Automatic syncing of email conversations with leads
- Sending emails to leads from the dashboard
- Thread-based email organization using Microsoft Graph conversation IDs
- Full email history tracking in the database

## Architecture

### Data Flow

```
Lead Detail Page
    ↓
LeadEmailSection Component
    ↓
API Endpoints (/api/leads/[leadId]/emails/*)
    ↓
Microsoft Graph API (Outlook) ← → Database (lead_emails table)
```

### Components

1. **Database Layer** (`lib/db/leadEmails.ts`)
   - `getLeadEmails()` - Fetch all emails for a lead
   - `createLeadEmail()` - Store a sent/received email
   - `syncLeadEmails()` - Bulk upsert emails from sync
   - `getLeadEmailByMessageId()` - Check if email already exists

2. **API Endpoints**
   - `GET /api/leads/[leadId]/emails` - Get all emails for a lead
   - `POST /api/leads/[leadId]/emails/sync` - Sync emails from Outlook
   - `POST /api/leads/[leadId]/emails/send` - Send email to lead

3. **Client API** (`lib/api.ts`)
   - `getLeadEmails(leadId)` - Fetch emails
   - `syncLeadEmails(leadId, userId, installerGroupId)` - Trigger sync
   - `sendLeadEmail(leadId, userId, installerGroupId, subject, body, conversationId?)` - Send email

4. **UI Component** (`app/components/leads/LeadEmailSection.tsx`)
   - Display email threads grouped by conversation ID
   - Compose and send new emails
   - Reply to existing threads
   - Sync button to fetch latest emails

## Database Schema

The `lead_emails` table stores email correspondence:

```sql
CREATE TABLE lead_emails (
  id UUID PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  message_id TEXT UNIQUE, -- Microsoft Graph message ID
  conversation_id TEXT, -- Thread ID
  subject TEXT,
  from_address TEXT,
  from_name TEXT,
  to_address TEXT,
  to_name TEXT,
  body_preview TEXT,
  body_content TEXT, -- Full HTML body
  received_date TIMESTAMPTZ,
  sent_date TIMESTAMPTZ,
  is_sent BOOLEAN, -- true if sent by us
  has_attachments BOOLEAN,
  created_at TIMESTAMPTZ
);
```

### Key Fields

- **message_id**: Unique identifier from Microsoft Graph API (prevents duplicates)
- **conversation_id**: Groups emails into threads (used by Outlook threading)
- **is_sent**: Distinguishes between sent (true) and received (false) emails
- **received_date / sent_date**: Timestamps for proper ordering

## Setup Instructions

### 1. Database Migration

Run the SQL migration to create the table:

```bash
# In Supabase SQL Editor or your database client
cat migrations/create_lead_emails_table.sql
```

Or manually run:
```sql
-- See: migrations/create_lead_emails_table.sql
```

This creates:
- `lead_emails` table with proper indexes
- Row Level Security (RLS) policies
- Composite indexes for performance

### 2. Environment Variables

Ensure your `.env` file has the required Outlook OAuth credentials:

```env
NEXT_PUBLIC_OUTLOOK_CLIENT_ID=your_client_id
NEXT_PUBLIC_OUTLOOK_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_OUTLOOK_REDIRECT_URI=your_redirect_uri
NEXT_PUBLIC_OUTLOOK_EMAIL=your_outlook_email
NEXT_PUBLIC_OUTLOOK_APP_PASSWORD=your_app_password
```

### 3. Email Account Connection

Users must connect their Outlook account:
1. Go to the emailtest page (or create an auth flow)
2. Complete OAuth authentication
3. Tokens are stored in `email_accounts` table per user and installer group

## Usage

### In Lead Detail Page

1. Navigate to a lead: `/dashboard/leads/[leadId]`
2. Click the **"E-poster"** tab
3. Click **"Synkroniser"** to fetch emails from Outlook
4. View email threads grouped by conversation
5. Click **"Ny e-post"** to compose a new email
6. Click **"Svar"** on a thread to reply in that conversation

### Email Threading

Emails are automatically grouped by `conversation_id`:
- New emails create new threads
- Replies use the parent email's `conversation_id`
- Threads are sorted by most recent activity

### Sync Behavior

The sync endpoint:
1. Fetches emails from Microsoft Graph API
2. Filters emails where lead's email address is in FROM or TO fields
3. Uses `$filter` query: `from/emailAddress/address eq 'lead@email.com' or toRecipients/any(...)`
4. Upserts emails (based on `message_id`) to avoid duplicates
5. Automatically detects if email was sent by the user or received

## API Examples

### Fetch Emails for a Lead

```typescript
import { getLeadEmails } from "@/lib/api";

const response = await getLeadEmails(leadId);
// Returns: { success: true, emails: LeadEmail[] }
```

### Sync Emails from Outlook

```typescript
import { syncLeadEmails } from "@/lib/api";

const response = await syncLeadEmails(
  leadId,
  userId,
  installerGroupId
);
// Returns: { success: true, count: number, emails: LeadEmail[] }
```

### Send Email to Lead

```typescript
import { sendLeadEmail } from "@/lib/api";

const response = await sendLeadEmail(
  leadId,
  userId,
  installerGroupId,
  "Subject line",
  "<p>HTML body content</p>",
  conversationId // optional, for replies
);
// Returns: { success: true, email: LeadEmail, message: string }
```

## Microsoft Graph API Integration

### Authentication

Uses OAuth 2.0 tokens stored in `email_accounts` table:
- `access_token`: Short-lived token for API requests
- `refresh_token`: Used to obtain new access tokens
- `expires_at`: Token expiration timestamp

### API Calls

**Fetch Messages:**
```
GET https://graph.microsoft.com/v1.0/me/messages
  ?$filter=from/emailAddress/address eq 'lead@email.com' or toRecipients/any(...)
  &$top=50
  &$orderby=receivedDateTime desc
```

**Send Email:**
```
POST https://graph.microsoft.com/v1.0/me/sendMail
{
  "message": {
    "subject": "...",
    "body": { "contentType": "HTML", "content": "..." },
    "toRecipients": [...]
  },
  "saveToSentItems": true
}
```

## Security

### Row Level Security (RLS)

Policies ensure users can only access emails for leads in their teams:

```sql
-- Users can view emails if they're members of the lead's team
CREATE POLICY "Users can view lead emails in their teams"
  ON lead_emails FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads
      INNER JOIN team_members ON team_members.team_id = leads.team_id
      WHERE leads.id = lead_emails.lead_id
        AND team_members.user_id = auth.uid()
    )
  );
```

### API Authentication

All endpoints require:
1. Bearer token in Authorization header
2. Valid Supabase session
3. Team membership verification via RLS

## Performance Considerations

### Indexes

Key indexes for optimal performance:
- `idx_lead_emails_lead_id` - Fast lookup by lead
- `idx_lead_emails_conversation_id` - Thread grouping
- `idx_lead_emails_message_id` - Duplicate prevention
- `idx_lead_emails_lead_conversation` - Composite for common queries

### Pagination

Currently loads all emails for a lead. For high-volume scenarios, consider:
- Implement pagination in `getLeadEmails()`
- Add `?limit=20&offset=0` query parameters
- Use cursor-based pagination for better performance

## Troubleshooting

### "No Outlook connection found"

- Ensure user has connected their Outlook account
- Check `email_accounts` table for valid tokens
- Verify `installerGroupId` matches the connected account

### "Failed to fetch emails from Outlook"

- Check access token expiration
- Implement token refresh logic (not yet implemented)
- Verify Microsoft Graph API permissions

### Emails not syncing

- Verify lead has a valid email address
- Check the `$filter` query includes both FROM and TO recipients
- Test the Graph API query in Microsoft Graph Explorer

### Duplicate emails

- Should not occur due to `message_id` UNIQUE constraint
- `syncLeadEmails()` uses upsert with `onConflict: "message_id"`

## Future Enhancements

1. **Token Refresh**: Automatic refresh of expired access tokens
2. **Attachments**: Support for email attachments (upload/download)
3. **Rich Text Editor**: WYSIWYG editor for composing emails
4. **Email Templates**: Pre-built templates for common scenarios
5. **Read Receipts**: Track when lead opens emails
6. **Search**: Full-text search across email content
7. **Filters**: Filter by date, sender, subject, etc.
8. **Notifications**: Real-time notifications for new emails

## Related Files

- `lib/types.ts` - LeadEmail type definition
- `lib/db/leadEmails.ts` - Database functions
- `lib/api.ts` - Client API wrappers
- `app/api/leads/[leadId]/emails/route.ts` - GET endpoint
- `app/api/leads/[leadId]/emails/sync/route.ts` - Sync endpoint
- `app/api/leads/[leadId]/emails/send/route.ts` - Send endpoint
- `app/components/leads/LeadEmailSection.tsx` - UI component
- `app/(dashboard)/dashboard/leads/[leadId]/page.tsx` - Lead detail page
- `migrations/create_lead_emails_table.sql` - Database migration
