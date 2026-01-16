# Email Bot End-to-End Testing Guide

Complete guide for testing the TruCal Email Bot feature from setup to booking confirmation.

---

## Prerequisites

### 1. Environment Variables

Verify these are set in your `.env` file:

```env
# Mailgun Configuration (REQUIRED)
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=mg.trucal.xyz
MAILGUN_WEBHOOK_SIGNING_KEY=your-webhook-signing-key
BOT_EMAIL=schedule@mg.trucal.xyz

# Server URL (REQUIRED)
FRONTEND_URL=https://schedulesync-web-production.up.railway.app

# Database (REQUIRED)
DATABASE_URL=postgresql://...

# Calendar Integration (OPTIONAL - for calendar events)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2. Database Schema

Verify tables exist:

```bash
node server/migrations/verify-email-bot-schema.js
```

Expected output:
```
✅ Table "email_bot_settings" exists
✅ Table "email_bot_threads" exists
✅ Table "email_bot_messages" exists
✅ Found 8 indexes
```

### 3. Server Running

```bash
# Development
npm run dev

# Production (Railway)
# Check Railway logs to ensure server is running
railway logs
```

---

## Test Checklist

### Phase 1: Setup & Configuration ✓

- [ ] **1.1 Database Schema Verified**
  - All 3 tables exist (email_bot_settings, email_bot_threads, email_bot_messages)
  - Indexes are created

- [ ] **1.2 User Has Bot Settings**
  ```bash
  node server/migrations/init-bot-settings.js <user_id>
  ```

- [ ] **1.3 Mailgun Route Configured**
  - Route exists for `match_recipient("schedule@mg.trucal.xyz")`
  - Webhook URL: `https://schedulesync-web-production.up.railway.app/api/email/inbound`
  - Action: Store and notify

- [ ] **1.4 User Settings UI**
  - Navigate to Settings → Email Bot tab
  - Verify bot email shows: `schedule@mg.trucal.xyz`
  - Verify "Email Bot Active" toggle is ON
  - Verify default duration is set (e.g., 30 minutes)

### Phase 2: Webhook Integration ✓

- [ ] **2.1 Test Webhook Locally**
  ```bash
  # Ensure server is running
  npm run dev

  # In another terminal
  node server/test-email-webhook.js
  ```

  **Expected Output:**
  ```
  ✅ Webhook Response:
  {
    "success": true,
    "threadId": 123
  }
  ```

- [ ] **2.2 Test Webhook Signature Verification**
  - Check logs show: `✅ Mailgun signature verified`
  - Or: `⚠️ MAILGUN_WEBHOOK_SIGNING_KEY not set, skipping signature verification`

- [ ] **2.3 Verify Database Records Created**
  ```sql
  -- Check thread created
  SELECT id, user_id, subject, status FROM email_bot_threads
  ORDER BY created_at DESC LIMIT 5;

  -- Check messages stored
  SELECT id, thread_id, direction, from_email, subject
  FROM email_bot_messages
  ORDER BY created_at DESC LIMIT 10;
  ```

### Phase 3: Send Real Email Test ✓

- [ ] **3.1 Send Test Email**

  **From:** Your personal email (Gmail, etc.)

  **To:** `<your-trucal-user-email>@example.com`

  **CC:** `schedule@mg.trucal.xyz`

  **Subject:** `Quick sync to discuss project`

  **Body:**
  ```
  Hi there,

  Can we find 30 minutes this week to sync on the new project?
  I'm flexible on timing - mornings work best for me.

  Thanks!
  ```

- [ ] **3.2 Check Server Logs**
  ```bash
  # Railway production
  railway logs --tail

  # Local development
  # Check terminal output
  ```

  Look for:
  ```
  📨 Received inbound email webhook
  ✅ Found TruCal user: user@example.com (ID: 1)
  ✅ Email processed successfully
  📤 Sent bot response to: sender@gmail.com
  ```

- [ ] **3.3 Verify Bot Response Received**

  Check your inbox for email from:
  ```
  TruCal Scheduling Assistant <schedule@mg.trucal.xyz>
  ```

  **Response should contain:**
  - Greeting with guest name
  - Intro message
  - 3-5 time slot buttons with gradient styling
  - "View full calendar" link
  - Signature

### Phase 4: Quick Book Flow ✓

- [ ] **4.1 Click Time Slot Button**
  - Click one of the time slot buttons in the bot's email
  - Should redirect to: `/quick-book?user=<username>&time=<timestamp>&thread=<id>`

- [ ] **4.2 Verify Booking Confirmation Page**

  **Expected UI:**
  - ✅ Green "Booking Confirmed!" header
  - Calendar icon with meeting date
  - Clock icon with meeting time
  - User icon with host name
  - "A confirmation email has been sent" message
  - Link to manage/reschedule booking

- [ ] **4.3 Check Database: Booking Created**
  ```sql
  SELECT id, title, attendee_email, start_time, end_time,
         status, source, calendar_event_id
  FROM bookings
  ORDER BY created_at DESC LIMIT 5;
  ```

  **Verify:**
  - `status = 'confirmed'`
  - `source = 'email_bot'`
  - `calendar_event_id` is populated (if calendar connected)

- [ ] **4.4 Check Database: Thread Updated**
  ```sql
  SELECT id, status, booking_id
  FROM email_bot_threads
  WHERE id = <thread_id>;
  ```

  **Verify:**
  - `status = 'booked'`
  - `booking_id` matches created booking

### Phase 5: Calendar Integration ✓

- [ ] **5.1 Verify Calendar Connection**
  - Settings → Calendar tab
  - Ensure Google or Microsoft calendar is connected

- [ ] **5.2 Check Calendar Event Created**

  **In Google Calendar:**
  - Open your calendar
  - Find event at the booked time
  - Verify attendee email is listed
  - Verify event title matches booking

  **OR check database:**
  ```sql
  SELECT calendar_event_id FROM bookings WHERE id = <booking_id>;
  ```

- [ ] **5.3 Check Server Logs for Calendar Creation**
  ```
  ✅ Calendar event created: <event_id>
  ```

### Phase 6: Email Confirmations ✓

- [ ] **6.1 Guest Receives Confirmation**

  **Check guest inbox** (sender of original email) for:
  - Subject: Contains "Confirmed" or "Meeting Scheduled"
  - Meeting date and time displayed
  - Duration shown
  - Link to manage booking
  - Calendar .ics attachment (optional)

- [ ] **6.2 Host Receives Copy (CC'd)**

  **Check TruCal user's inbox** for:
  - Same confirmation email
  - Shows guest name and details

### Phase 7: Error Handling ✓

- [ ] **7.1 Test: Already Booked**
  - Try to book the same time slot again
  - Should show: "This meeting has already been scheduled"

- [ ] **7.2 Test: No User Found**
  - Send email without TruCal user in To/CC
  - Should return: `{ success: false, reason: "no_user_found" }`

- [ ] **7.3 Test: Bot Disabled**
  - Disable bot in Settings UI
  - Send test email
  - Should return: `{ success: false, reason: "bot_disabled" }`

- [ ] **7.4 Test: Time Conflict**
  - Book a time slot
  - Manually create another booking at same time
  - Try to book via email bot
  - Should show: "This time slot is no longer available"

---

## Common Issues & Troubleshooting

### Issue: No Bot Response Email Received

**Possible Causes:**
1. Mailgun route not configured
2. Webhook URL incorrect
3. User has no available slots

**Debug Steps:**
```bash
# Check Mailgun logs
# Dashboard → Sending → Logs

# Check webhook was received
railway logs | grep "Received inbound email"

# Check if user has bookings blocking all times
SELECT start_time, end_time FROM bookings
WHERE user_id = <user_id> AND status = 'confirmed'
ORDER BY start_time DESC;
```

### Issue: Webhook Returns 403 Invalid Signature

**Solution:**
1. Get correct signing key from Mailgun Dashboard → Webhooks
2. Update `MAILGUN_WEBHOOK_SIGNING_KEY` in `.env`
3. Restart server
4. Or temporarily disable verification for testing (DEV ONLY)

### Issue: Calendar Event Not Created

**Possible Causes:**
1. No calendar connected
2. Calendar tokens expired
3. Calendar API not enabled

**Debug Steps:**
```bash
# Check calendar connection status
curl -H "Authorization: Bearer <jwt>" \
  https://schedulesync-web-production.up.railway.app/api/calendar/status

# Check server logs
railway logs | grep "Calendar event"
```

### Issue: Quick Book Link Doesn't Work

**Possible Causes:**
1. Frontend route not configured
2. User not found
3. Thread ID invalid

**Debug Steps:**
```bash
# Check frontend route exists in App.jsx
grep "quick-book" client/src/App.jsx

# Check backend endpoint
curl -X POST https://schedulesync-web-production.up.railway.app/api/public/quick-book \
  -H "Content-Type: application/json" \
  -d '{"username":"janedoe","time":"2024-01-22T10:00:00","threadId":123}'
```

---

## Production Deployment Checklist

- [ ] Environment variables configured in Railway
- [ ] Mailgun domain verified and route configured
- [ ] Database migrations run successfully
- [ ] All users initialized with bot settings
- [ ] Email templates rendering correctly
- [ ] Calendar integration tested (Google & Microsoft)
- [ ] Quick-book links working from production URLs
- [ ] Confirmation emails being sent
- [ ] Server logs showing no errors

---

## Performance Monitoring

### Key Metrics to Track

```sql
-- Email bot usage (last 30 days)
SELECT
  COUNT(*) as total_threads,
  SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) as booked,
  SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
  SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
FROM email_bot_threads
WHERE created_at > NOW() - INTERVAL '30 days';

-- Conversion rate
SELECT
  COUNT(*) as threads_created,
  SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) as bookings_made,
  ROUND(100.0 * SUM(CASE WHEN status = 'booked' THEN 1 ELSE 0 END) / COUNT(*), 2) as conversion_rate_percent
FROM email_bot_threads
WHERE created_at > NOW() - INTERVAL '30 days';

-- Average response time
SELECT
  AVG(EXTRACT(EPOCH FROM (outbound.created_at - inbound.created_at))) as avg_response_time_seconds
FROM email_bot_messages inbound
JOIN email_bot_messages outbound ON outbound.thread_id = inbound.thread_id
  AND outbound.direction = 'outbound'
  AND outbound.created_at > inbound.created_at
WHERE inbound.direction = 'inbound'
  AND inbound.created_at > NOW() - INTERVAL '30 days';
```

---

## Next Steps

Once all tests pass:

1. **Document for Users**
   - Create user-facing guide showing how to use email bot
   - Add video tutorial on landing page

2. **Monitor & Optimize**
   - Track conversion rates
   - Optimize slot selection algorithm
   - Improve email templates based on feedback

3. **Feature Enhancements**
   - Multi-language support
   - AI-powered intent parsing
   - Custom bot email prefixes
   - Automated follow-ups for expired threads

---

## Support & Documentation

- [Mailgun Webhook Setup Guide](./MAILGUN_WEBHOOK_SETUP.md)
- [Email Bot Schema Documentation](./migrations/EMAIL_BOT_SCHEMA.md)
- [Email Bot Quickstart](./migrations/QUICKSTART_EMAIL_BOT.md)
- [Mailgun Documentation](https://documentation.mailgun.com/)
- [Google Calendar API](https://developers.google.com/calendar)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/api/resources/calendar)
