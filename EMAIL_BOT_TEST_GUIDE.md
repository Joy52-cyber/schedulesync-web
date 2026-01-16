# Email Bot End-to-End Test Guide

## 🎯 Goal
Verify the email bot works completely from sending an email to completing a booking.

---

## Pre-Test Checklist

### Step 1: Get Your Bot Email Address

1. Log in to TruCal: https://www.trucal.xyz (or schedulesync-web-production.up.railway.app)
2. Go to **Settings** or **User Settings**
3. Look for "Email Bot" section
4. Your bot email should show: `{yourUsername}@mg.trucal.xyz`

**📝 Write down your bot email:** `________________@mg.trucal.xyz`

---

### Step 2: Verify Mailgun Webhook is Configured

**Check in Mailgun Dashboard:**
1. Go to https://app.mailgun.com
2. Select domain: `mg.trucal.xyz`
3. Go to **Receiving** → **Routes**
4. Look for a route with:
   - **Priority:** 0
   - **Filter Expression:** `match_recipient(".*@mg.trucal.xyz")`
   - **Actions:** `forward("https://schedulesync-web-production.up.railway.app/api/email/inbound")`

**If route doesn't exist, create it:**
```
Expression Type: Match Recipient
Recipient: .*@mg.trucal.xyz
Actions: Forward to URL
URL: https://schedulesync-web-production.up.railway.app/api/email/inbound
```

---

### Step 3: Verify Bot is Enabled in Settings

1. In TruCal, go to **User Settings** → **Email Bot**
2. Make sure bot is **enabled** (toggle should be ON)
3. Check settings:
   - Default duration: 30 minutes (or your preference)
   - Max slots to show: 5 (or your preference)

---

## 📧 Test 1: Send Email to Bot

### Scenario: Simple scheduling request

**From:** Your personal email (Gmail, Outlook, etc.)

**To:** `client@example.com` (any fake email, or a real person)

**CC:** `{yourUsername}@mg.trucal.xyz` ← YOUR BOT EMAIL

**Subject:** `Partnership Discussion`

**Body:**
```
Hi John,

Let's schedule a meeting to discuss the partnership.

Looking forward to connecting!

Best,
[Your Name]
```

### Expected Result:
- ✅ Email is delivered to your inbox
- ✅ Bot receives email via webhook
- ✅ Bot sends reply with time slot proposals
- ✅ Reply email appears in thread

### Timeline:
- Email delivery: Instant
- Bot processing: 5-30 seconds
- Response email: 10-60 seconds

---

## 🔍 Monitoring the Test

### Check Railway Logs (Real-time):

1. Go to Railway dashboard: https://railway.app
2. Click on your project
3. Click on the **web service** (not database)
4. Go to **Deployments** → Latest deployment → **View Logs**

**Look for these log messages:**
```
📬 Processing inbound email to bot
🔍 Extracted username from bot email: {yourUsername}
✅ Found TruCal user: {yourEmail}
🧠 Parsed intent: { action: 'propose_times' }
📤 Sent bot response from {yourUsername}@mg.trucal.xyz
✅ Email sent successfully
```

### Check Email Inbox:

**Gmail/Outlook:**
1. Check **Inbox** (not spam)
2. Look for email **in the same thread** as your original email
3. **From:** TruCal Scheduling Assistant <{yourUsername}@mg.trucal.xyz>
4. **Subject:** Re: Partnership Discussion

---

## ✅ Test 2: Verify Bot Response

### What the Email Should Contain:

1. **Header:**
   - Purple/pink gradient banner
   - "📅 Pick a Time" heading

2. **Body:**
   - Greeting: "Hi there! 👋"
   - Context: "I'm helping {Your Name} schedule your meeting"
   - Duration badge: "🕒 30 min • 🎥 Video call"

3. **Time Slots:**
   - 5 clickable time slot buttons
   - First slot: Purple gradient background with checkmark
   - Other slots: Light gray background
   - Format: "Tomorrow at 2:00 PM" or "Monday, Jan 20 at 10:00 AM"

4. **Footer:**
   - "View full calendar →" link
   - "Powered by TruCal"

### Troubleshooting:

**If bot doesn't respond:**
- Check spam folder
- Wait 2 minutes (processing delay)
- Check Railway logs for errors
- Verify Mailgun webhook is configured
- Check bot is enabled in settings

**If email looks broken:**
- Templates might not be compiling
- Check Railway logs for MJML errors
- Verify templates exist in `server/templates/`

---

## 🎯 Test 3: Book a Time Slot

### Step 1: Click a Time Slot

1. Open the bot's response email
2. Click on any time slot button
3. Should open booking page in browser

### Expected URL Format:
```
https://www.trucal.xyz/quick-book?user={username}&time={timestamp}&thread={threadId}
```

### Step 2: Booking Page

**Should show:**
- Selected time in large text (e.g., "Tomorrow at 2:00 PM")
- Meeting duration (e.g., "30 minutes")
- Guest information form:
  - Name (pre-filled from email)
  - Email (pre-filled)
  - Optional: Phone, Notes
- "Confirm Booking" button

### Step 3: Confirm Booking

1. Fill in any missing information
2. Click **"Confirm Booking"**
3. Should see success page

### Expected Success Page:
- ✅ "Booking Confirmed!" message
- Meeting details (date, time, duration)
- "Add to Calendar" buttons (Google, Outlook, iCal)
- Join link (if video call)

---

## 📨 Test 4: Verify Confirmation Email

### Check Email Inbox Again:

**Should receive:**
1. **Confirmation email to guest** (client@example.com or you)
   - Subject: "✅ Meeting Confirmed - Partnership Discussion"
   - Meeting details
   - Calendar invite attached (.ics file)
   - Video call link
   - Cancel/Reschedule links

2. **Notification to host** (you)
   - Subject: "New Booking: Partnership Discussion"
   - Guest details
   - Meeting time
   - Link to manage booking

---

## 🗄️ Test 5: Verify Database

### Check in Railway PostgreSQL:

**Query 1: Check thread was created**
```sql
SELECT * FROM email_bot_threads
WHERE user_id = YOUR_USER_ID
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- `status`: 'booked' or 'proposed'
- `subject`: 'Partnership Discussion'
- `created_at`: Recent timestamp

**Query 2: Check messages were stored**
```sql
SELECT * FROM email_bot_messages
WHERE thread_id = THREAD_ID_FROM_ABOVE
ORDER BY created_at;
```

**Expected:**
- 1 inbound message (your original email)
- 1 outbound message (bot's response)

**Query 3: Check booking was created**
```sql
SELECT * FROM bookings
WHERE user_id = YOUR_USER_ID
ORDER BY created_at DESC
LIMIT 1;
```

**Expected:**
- Guest email, name
- Start time, end time
- Status: 'confirmed'

---

## 📋 Test Checklist

- [ ] Got bot email address
- [ ] Verified Mailgun webhook configured
- [ ] Bot is enabled in settings
- [ ] Sent test email with bot CC'd
- [ ] Bot received email (Railway logs show processing)
- [ ] Bot sent response email
- [ ] Response email appeared in same thread
- [ ] Email contains time slots with purple gradient
- [ ] Clicked time slot button
- [ ] Booking page opened with correct details
- [ ] Confirmed booking
- [ ] Saw success page
- [ ] Received confirmation email with calendar invite
- [ ] Host received notification email
- [ ] Database shows thread, messages, booking

---

## 🐛 Common Issues & Fixes

### Issue 1: Bot doesn't receive email
**Possible causes:**
- Mailgun route not configured
- Wrong webhook URL
- Bot email misspelled

**Fix:**
- Verify Mailgun route matches exactly
- Check webhook URL is `https://` not `http://`
- Double-check username spelling

### Issue 2: Bot receives but doesn't respond
**Possible causes:**
- Bot disabled in settings
- User not found (username lookup failed)
- Error in time slot generation

**Fix:**
- Check Railway logs for errors
- Enable bot in settings
- Verify username exists in database

### Issue 3: Email goes to spam
**Possible causes:**
- SPF/DKIM not configured
- Email content flagged

**Fix:**
- Add to safe senders list
- Check Mailgun domain authentication

### Issue 4: Time slots don't load
**Possible causes:**
- No availability configured
- Calendar not connected
- Buffer times blocking all slots

**Fix:**
- Set availability in settings
- Connect Google/Outlook calendar
- Adjust buffer times

### Issue 5: Booking fails
**Possible causes:**
- Invalid time slot (expired)
- Double booking
- Database error

**Fix:**
- Check Railway logs
- Try different time slot
- Verify database connection

---

## 🎉 Success Criteria

### Complete Success:
- ✅ Email received by bot
- ✅ Bot responded with time slots
- ✅ Time slots clickable and working
- ✅ Booking completed successfully
- ✅ Confirmation emails sent
- ✅ Database records created

### Partial Success:
- ⚠️ Bot responds but time slots don't work → Fix booking page
- ⚠️ Booking works but no confirmation email → Fix email sending
- ⚠️ Everything works but slow → Optimize performance

### Failure:
- ❌ Bot doesn't respond at all → Debug webhook and processing
- ❌ Response email malformed → Fix templates
- ❌ Can't complete booking → Debug booking endpoint

---

## 📊 Test Results Template

**Date:** ________________

**Bot Email Tested:** ________________@mg.trucal.xyz

**Results:**
- [ ] Email sent to bot: ✅ / ❌
- [ ] Bot received email: ✅ / ❌
- [ ] Bot sent response: ✅ / ❌
- [ ] Response in same thread: ✅ / ❌
- [ ] Time slots displayed correctly: ✅ / ❌
- [ ] Booking page opened: ✅ / ❌
- [ ] Booking completed: ✅ / ❌
- [ ] Confirmation email received: ✅ / ❌

**Issues Encountered:**
-

**Notes:**
-

---

## Next Steps After Testing

**If everything works:**
- Test with real client email
- Try different scenarios (reschedule, cancel)
- Monitor performance
- Gather user feedback

**If issues found:**
- Document specific errors
- Check Railway logs
- Fix issues one by one
- Re-test

**Enhancements to add:**
- Better email templates
- Email analytics
- Smarter time proposals
- Multi-timezone support
