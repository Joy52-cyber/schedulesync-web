# AI Inbox Assistant Removal Plan

## Overview
Removing the AI Inbox Assistant feature (inbox scanning) while keeping Email Bot (CC approach) and calendar OAuth functionality.

## Files to Remove

### Frontend Files
1. ✅ `client/src/pages/InboxAssistant.jsx` (1,196 lines)
   - Complete inbox monitoring UI
   - Quick Paste email analysis
   - Draft management interface
   - Email connection management

### Backend Files
2. ✅ `server/routes/inbox.js` (1,164 lines)
   - Inbox email management endpoints
   - Draft creation and approval
   - Activity logging
   - Stats and settings

3. ✅ `server/routes/emailIntegration.js` (746 lines)
   - Gmail OAuth for inbox access
   - Outlook OAuth for inbox access
   - Email sync functions
   - Detected email management

4. ✅ `server/cron/emailSync.js` (40 lines)
   - Background email syncing cron job
   - Runs every 15 minutes
   - Scans inboxes for scheduling requests

### Database Tables (to document for removal)
5. ✅ `email_connections` - OAuth tokens for inbox access
6. ✅ `detected_emails` - Emails detected by inbox scanner
7. ✅ `inbox_emails` - Inbox monitoring emails
8. ✅ `inbox_settings` - User inbox preferences
9. ✅ `inbox_activity` - Activity log
10. ✅ `email_drafts` - Generated draft responses

### Navigation & Routes
11. ✅ Route in `client/src/App.jsx` line 78
12. ✅ Navigation item in `client/src/components/Layout.jsx` line 78
13. ✅ Onboarding reference in `client/src/pages/OnboardingWizard.jsx`
14. ✅ Settings reference in `server/routes/settings.js`

### Server Registration
15. ✅ Routes registered in `server/src/index.js`

---

## Files to Keep

### Email Bot (CC Approach)
- ✅ `server/services/emailBot.js` - Email bot logic
- ✅ `server/routes/emailWebhook.js` - Mailgun webhook handler
- ✅ `server/routes/public.js` - Quick-book endpoint
- ✅ `server/templates/*.mjml` - Email templates
- ✅ `server/services/emailTemplates.js` - Template compiler

### Calendar OAuth (Different from Inbox OAuth)
- ✅ Google Calendar OAuth - For calendar sync
- ✅ Outlook Calendar OAuth - For calendar sync
- ✅ Tables: `google_calendar_tokens`, `microsoft_calendar_tokens`

### Email Bot Tables
- ✅ `email_bot_settings` - Bot configuration
- ✅ `email_bot_threads` - Email conversations
- ✅ `email_bot_messages` - Thread messages

---

## Environment Variables to Note

### Can Be Removed (Inbox OAuth)
- Gmail/Outlook scopes for inbox reading (if separate from calendar)
- Webhook signing keys for inbox push notifications

### Must Keep
- ✅ `MAILGUN_API_KEY` - For Email Bot sending
- ✅ `MAILGUN_DOMAIN` - Email Bot domain
- ✅ `MAILGUN_WEBHOOK_SIGNING_KEY` - Email Bot webhook verification
- ✅ Google/Outlook Calendar OAuth credentials

---

## Database Migration Notes

The following tables should be dropped in production:
```sql
DROP TABLE IF EXISTS inbox_activity CASCADE;
DROP TABLE IF EXISTS email_drafts CASCADE;
DROP TABLE IF EXISTS inbox_emails CASCADE;
DROP TABLE IF EXISTS detected_emails CASCADE;
DROP TABLE IF EXISTS email_connections CASCADE;
DROP TABLE IF EXISTS inbox_settings CASCADE;
```

**Note:** These tables are defined in `server/migrations/add_email_integration.sql` and referenced in `server/routes/inbox.js`.

---

## Execution Steps

1. Remove frontend files and references
2. Remove backend routes and services
3. Remove cron job
4. Update server index to unregister routes
5. Document database tables for manual cleanup
6. Test Email Bot still works
7. Test calendar OAuth still works
8. Commit changes

---

## Why Remove This?

The Email Bot (CC approach) replaces the need for inbox scanning:
- **Inbox Assistant:** Required OAuth to scan user's inbox, detect scheduling emails, generate drafts
- **Email Bot:** User CCs schedule@mg.trucal.xyz, Mailgun forwards to webhook, bot responds automatically
- **Simpler:** No OAuth needed, no polling, instant response
- **More reliable:** Works with any email client, no token expiration issues
