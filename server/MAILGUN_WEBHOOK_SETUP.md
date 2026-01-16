# Mailgun Webhook Setup Guide

## Overview

The Email Bot receives inbound emails via Mailgun webhooks. When someone sends an email to `schedule@mg.trucal.xyz` (or CC's the bot), Mailgun forwards the email to your webhook endpoint where the bot processes it.

## Prerequisites

1. ✅ Database schema migrated (email_bot_settings, email_bot_threads, email_bot_messages)
2. ✅ At least one user with bot settings enabled
3. ✅ Mailgun account with verified domain `mg.trucal.xyz`
4. ✅ Server running and publicly accessible

---

## Step 1: Configure Environment Variables

Add these to your `.env` file:

```env
# Mailgun Configuration
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=mg.trucal.xyz
MAILGUN_WEBHOOK_SIGNING_KEY=your-webhook-signing-key
BOT_EMAIL=schedule@mg.trucal.xyz

# Server URL (must be publicly accessible)
FRONTEND_URL=https://schedulesync-web-production.up.railway.app
```

**Where to find these:**
- `MAILGUN_API_KEY`: Mailgun Dashboard → Settings → API Keys
- `MAILGUN_DOMAIN`: Your verified sending domain (mg.trucal.xyz)
- `MAILGUN_WEBHOOK_SIGNING_KEY`: Mailgun Dashboard → Sending → Webhooks → HTTP webhook signing key
- `BOT_EMAIL`: The email address that receives scheduling requests

---

## Step 2: Configure Mailgun Receiving Routes

### Option A: Via Mailgun Dashboard (Recommended)

1. Log in to [Mailgun Dashboard](https://app.mailgun.com/)
2. Navigate to **Sending** → **Receiving** (or **Routes**)
3. Click **Create Route**
4. Configure the route:

**Priority:** 0 (highest priority)

**Expression Type:** Match Recipient

**Recipient:** `schedule@mg.trucal.xyz`

**Actions:**
- ✅ **Store and notify:** (webhook URL)
- **Webhook URL:** `https://schedulesync-web-production.up.railway.app/api/email/inbound`

5. Click **Create Route**

### Option B: Via Mailgun API

```bash
curl -s --user 'api:YOUR_MAILGUN_API_KEY' \
    https://api.mailgun.net/v3/routes \
    -F priority=0 \
    -F description='TruCal Email Bot' \
    -F expression='match_recipient("schedule@mg.trucal.xyz")' \
    -F action='forward("https://schedulesync-web-production.up.railway.app/api/email/inbound")' \
    -F action='stop()'
```

---

## Step 3: Test the Webhook Locally

### Start the Server

```bash
npm run dev
```

Server should start on `http://localhost:3000`

### Test with Local Payload

```bash
node server/test-email-webhook.js
```

**Expected Output:**
```
✅ Webhook Response:
{
  "success": true,
  "threadId": 123
}

✅ Email processed successfully!
Thread ID: 123

📧 Check the database for:
  - New thread in email_bot_threads (ID: 123)
  - Inbound message in email_bot_messages
  - Outbound bot response in email_bot_messages
```

**If you get `no_user_found` error:**
```bash
# 1. Check which users exist
psql $DATABASE_URL -c "SELECT id, email FROM users;"

# 2. Update test payload in server/test-email-webhook.js
# Replace "user@example.com" with actual user email

# 3. Re-run test
node server/test-email-webhook.js
```

**If you get `bot_disabled` error:**
```bash
# Enable bot for user
node server/migrations/init-bot-settings.js <user_id>
```

---

## Step 4: Expose Localhost for Testing (Optional)

If you want to test with real Mailgun webhooks locally, use ngrok:

```bash
# Install ngrok
npm install -g ngrok

# Expose localhost:3000
ngrok http 3000
```

You'll get a public URL like `https://abc123.ngrok.io`

Update Mailgun route webhook URL to:
```
https://abc123.ngrok.io/api/email/inbound
```

---

## Step 5: Production Deployment

### Verify Server is Running

```bash
curl https://schedulesync-web-production.up.railway.app/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-16T10:30:00.000Z"
}
```

### Test Webhook Endpoint

```bash
curl -X POST https://schedulesync-web-production.up.railway.app/api/email/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@example.com",
    "to": [{"email": "schedule@mg.trucal.xyz"}, {"email": "user@example.com"}],
    "subject": "Test Email",
    "text": "Can we schedule a meeting?",
    "messageId": "test-123"
  }'
```

---

## Step 6: Send a Real Test Email

1. Send an email from your personal email (e.g., Gmail)

**To:** `youruser@example.com` (your TruCal user email)

**CC:** `schedule@mg.trucal.xyz` (the bot)

**Subject:** `Let's schedule a meeting`

**Body:**
```
Hi!

Can we find a time to chat this week? I'm flexible, mornings would be great.

Thanks!
```

2. Wait 5-10 seconds

3. Check your inbox - you should receive an email from:
```
TruCal Scheduling Assistant <schedule@mg.trucal.xyz>
```

With **3 time slot options** in a beautifully formatted email!

---

## Webhook Endpoint Details

### Endpoint

```
POST https://schedulesync-web-production.up.railway.app/api/email/inbound
```

### Authentication

- **Mailgun Signature Verification:** HMAC-SHA256
- Verifies `timestamp`, `token`, and `signature` fields
- Requires `MAILGUN_WEBHOOK_SIGNING_KEY` in environment

### Supported Formats

1. **Mailgun Format** (recommended)
2. **SendGrid Inbound Parse**
3. **Generic JSON**

### Request Headers

```
Content-Type: application/x-www-form-urlencoded
```

or

```
Content-Type: multipart/form-data
```

### Response Format

**Success:**
```json
{
  "success": true,
  "threadId": 123
}
```

**Failure:**
```json
{
  "success": false,
  "reason": "no_user_found"
}
```

**Reasons for Failure:**
- `no_user_found` - No TruCal user found in recipients
- `bot_disabled` - Bot is disabled for this user
- `{error message}` - Other errors

---

## Troubleshooting

### Webhook Returns `no_user_found`

**Cause:** The bot couldn't identify which TruCal user the email is for.

**Solution:**
1. Make sure a TruCal user's email is in the To/CC fields
2. Check user exists:
   ```sql
   SELECT id, email, name FROM users WHERE email = 'user@example.com';
   ```
3. If user doesn't exist, create one via `/register` or SQL

### Webhook Returns `bot_disabled`

**Cause:** User exists but bot settings are disabled.

**Solution:**
```bash
# Initialize bot settings for user
node server/migrations/init-bot-settings.js <user_id>

# Or update existing settings
psql $DATABASE_URL -c "UPDATE email_bot_settings SET is_enabled = true WHERE user_id = <user_id>;"
```

### No Response Email Sent

**Check logs:**
```bash
# On Railway
railway logs

# Local
# Check terminal output
```

**Common issues:**
1. `MAILGUN_API_KEY` not set or incorrect
2. `MAILGUN_DOMAIN` not verified
3. User has no calendar availability
4. Error in MJML template compilation

### Mailgun Route Not Triggering

**Check:**
1. Route exists: Mailgun Dashboard → Sending → Receiving → Routes
2. Route priority is 0 (highest)
3. Route expression: `match_recipient("schedule@mg.trucal.xyz")`
4. Route action includes webhook URL
5. Webhook URL is correct and publicly accessible

**Test route manually:**
```bash
# Send test email via Mailgun API
curl -s --user 'api:YOUR_MAILGUN_API_KEY' \
    https://api.mailgun.net/v3/mg.trucal.xyz/messages \
    -F from='Test <test@mg.trucal.xyz>' \
    -F to='schedule@mg.trucal.xyz' \
    -F cc='user@example.com' \
    -F subject='Test Email Bot' \
    -F text='Can we schedule a meeting?'
```

### Webhook Returns 403 Invalid Signature

**Cause:** Mailgun signature verification failed.

**Solution:**
1. Check `MAILGUN_WEBHOOK_SIGNING_KEY` in `.env`
2. Get correct key from: Mailgun Dashboard → Sending → Webhooks → HTTP webhook signing key
3. Restart server after updating `.env`

**Temporary fix (development only):**
```env
# Remove or comment out MAILGUN_WEBHOOK_SIGNING_KEY
# MAILGUN_WEBHOOK_SIGNING_KEY=
```
This will skip signature verification (not recommended for production).

---

## Monitoring

### Check Recent Threads

```sql
SELECT
  t.id,
  t.subject,
  t.status,
  t.created_at,
  u.email as user_email
FROM email_bot_threads t
JOIN users u ON u.id = t.user_id
ORDER BY t.created_at DESC
LIMIT 10;
```

### Check Recent Messages

```sql
SELECT
  m.id,
  m.direction,
  m.from_email,
  m.subject,
  m.created_at,
  t.id as thread_id
FROM email_bot_messages m
JOIN email_bot_threads t ON t.id = m.thread_id
ORDER BY m.created_at DESC
LIMIT 20;
```

### Check Bot Settings

```sql
SELECT
  u.email,
  s.is_enabled,
  s.default_duration,
  s.max_slots_to_show
FROM email_bot_settings s
JOIN users u ON u.id = s.user_id;
```

---

## Advanced Configuration

### Custom Bot Email Prefix

```sql
-- Allow user to have custom bot address like "schedule-john@mg.trucal.xyz"
UPDATE email_bot_settings
SET bot_email_prefix = 'john'
WHERE user_id = 1;
```

Then create Mailgun route:
```
match_recipient("schedule-john@mg.trucal.xyz")
```

### Custom Intro Message

```sql
UPDATE email_bot_settings
SET intro_message = 'Hey! I''m helping {user.name} find time to connect with you.'
WHERE user_id = 1;
```

### Time of Day Preference

```sql
-- Only propose morning slots (9 AM - 12 PM)
UPDATE email_bot_settings
SET prefer_time_of_day = 'morning'
WHERE user_id = 1;

-- Options: 'morning', 'afternoon', 'evening', NULL (any time)
```

### Max Slots to Show

```sql
-- Show maximum of 3 time slots instead of default 5
UPDATE email_bot_settings
SET max_slots_to_show = 3
WHERE user_id = 1;
```

---

## Security Best Practices

1. ✅ **Always verify Mailgun signature in production**
2. ✅ **Use HTTPS for webhook URL**
3. ✅ **Keep `MAILGUN_WEBHOOK_SIGNING_KEY` secret**
4. ✅ **Rate limit webhook endpoint** (consider adding middleware)
5. ✅ **Log all webhook requests** for debugging
6. ✅ **Return 200 even on errors** (prevents Mailgun retries)

---

## Next Steps

1. ✅ Set up Mailgun route
2. ✅ Configure environment variables
3. ✅ Test with sample payload
4. ✅ Send real test email
5. ✅ Monitor logs and database
6. 🔜 Configure bot settings UI in dashboard
7. 🔜 Add quick-book endpoint for one-click time selection
8. 🔜 Implement calendar event creation
9. 🔜 Add analytics dashboard

---

## Resources

- [Mailgun Receiving Docs](https://documentation.mailgun.com/en/latest/user_manual.html#receiving-forwarding-and-storing-messages)
- [Mailgun Routes API](https://documentation.mailgun.com/en/latest/api-routes.html)
- [Mailgun Webhooks](https://documentation.mailgun.com/en/latest/api-webhooks.html)
- [Email Bot Schema](./migrations/EMAIL_BOT_SCHEMA.md)
- [Email Bot Quickstart](./migrations/QUICKSTART_EMAIL_BOT.md)
