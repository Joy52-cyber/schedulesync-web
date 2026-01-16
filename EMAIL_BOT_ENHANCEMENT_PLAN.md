# Email Bot Enhancement Plan

## Current State Analysis

### ✅ What's Already Working:

1. **Vanity URL System**
   - Each user has personalized bot email: `{username}@mg.trucal.xyz`
   - Backend correctly identifies users from username
   - Dynamic FROM email generation working

2. **Email Processing Pipeline**
   - Inbound email webhook configured
   - Email parsing and intent detection
   - Thread management (find or create)
   - Message storage

3. **MJML Email Templates**
   - `pick-a-time.mjml` - Time slot proposals
   - `confirmation.mjml` - Booking confirmed
   - `cancelled.mjml` - Booking cancelled
   - `no-slots.mjml` - No availability
   - `already-booked.mjml` - Already has booking
   - All templates use purple/pink gradient branding

4. **Bot Intelligence**
   - Parses email intent (select_time, reschedule, cancel)
   - Proposes available time slots
   - Handles time selection
   - Handles rescheduling and cancellation

---

## 🎯 Enhancement Plan

### Enhancement 1: Improved Email Templates (High Priority)

**Current Issue:**
- Templates are good but could be more visually appealing
- Need better mobile responsiveness
- Time slot buttons could be more prominent

**Improvements:**
1. **pick-a-time.mjml:**
   - Larger, more clickable time slot buttons
   - Better visual hierarchy
   - Add host's profile photo (if available)
   - Show meeting location/link type clearly
   - Add timezone information

2. **confirmation.mjml:**
   - Show calendar event preview
   - Include "Add to Calendar" buttons (Google, Outlook, iCal)
   - Show cancellation/reschedule link
   - Include video call link prominently if virtual
   - Show what to prepare for the meeting

3. **All templates:**
   - Consistent spacing and padding
   - Better color contrast for accessibility
   - Mobile-first design
   - Faster loading (optimize images if any)

---

### Enhancement 2: Auto-Send Time Proposals (Critical)

**Current State:**
- Bot receives email when CC'd
- Parses intent and generates response
- But does it actually AUTO-SEND?

**Need to verify:**
```javascript
// In emailBot.js line 100
if (response) {
  await sendBotResponse(thread, trucalUser, response, emailData);
}
```

**Check:**
1. Is `sendBotResponse` actually sending via Mailgun?
2. Are emails being delivered to recipients?
3. Is Reply-To set correctly?
4. Are CC's being preserved in responses?

**Enhancements:**
1. Add delivery confirmation tracking
2. Log all sent emails to database
3. Add retry logic for failed sends
4. Better error handling and user notifications

---

### Enhancement 3: Booking Confirmation Tracking (High Priority)

**What to Track:**
1. **Email Metrics:**
   - Email sent timestamp
   - Email opened (pixel tracking)
   - Links clicked (which time slot?)
   - Booking completed from which email

2. **Database Schema:**
```sql
CREATE TABLE email_bot_analytics (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER REFERENCES email_bot_threads(id),
  email_type VARCHAR(50), -- 'propose_times', 'confirmation', 'cancelled'
  sent_at TIMESTAMP DEFAULT NOW(),
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  slot_clicked VARCHAR(255),
  booked_at TIMESTAMP,
  user_agent TEXT,
  ip_address INET
);
```

3. **Implementation:**
   - Add tracking pixel to email templates
   - Add click tracking to booking URLs
   - Dashboard to show email analytics
   - Show in bot settings: open rate, click rate, booking rate

---

### Enhancement 4: Smart Time Proposals (Medium Priority)

**Improvements to time slot algorithm:**

1. **Better Time Selection:**
   - Consider user's typical booking patterns
   - Weight recent time slots higher (if user books mornings often, show more mornings)
   - Avoid slots too close to existing bookings (buffer time)
   - Show slots spread across different days
   - Respect user's "prefer_time_of_day" setting

2. **Contextual Awareness:**
   - Parse meeting duration from email (e.g., "30 minute call" → 30 min)
   - Detect urgency keywords ("urgent", "asap", "this week") → show sooner slots
   - Detect timezone in guest's signature → show times in their timezone
   - Multi-participant detection → check all participants' calendars if possible

3. **Slot Formatting:**
   - Show timezone for each slot (e.g., "Tomorrow at 2:00 PM PST")
   - Show day of week (e.g., "Monday, January 20")
   - Relative times (e.g., "Tomorrow", "This Friday", "Next Monday")

---

### Enhancement 5: Reply Threading (Medium Priority)

**Current Issue:**
- Need to verify reply threading is working correctly
- Check if "In-Reply-To" and "References" headers are set

**Improvements:**
1. Keep all bot conversation in single email thread
2. Show email history in dashboard
3. Allow manual replies from dashboard
4. Smart detection of which email thread a reply belongs to

---

### Enhancement 6: Guest Experience Improvements (High Priority)

**One-Click Booking:**
1. Guest clicks time slot → immediately books (no form)
2. Send confirmation email instantly
3. Add calendar invite automatically
4. Show success page with meeting details

**Smart Defaults:**
1. Pre-fill guest name from email signature
2. Pre-fill email address
3. Detect timezone from email headers
4. Remember guest preferences for future bookings

**Progress Indicators:**
1. Show "Booking..." state after clicking
2. Show success animation
3. Clear next steps
4. Option to add to calendar

---

### Enhancement 7: Host Dashboard Improvements (Medium Priority)

**Email Bot Analytics Page:**
1. Total emails sent/received
2. Open rate, click rate, booking rate
3. Most common time slots booked
4. Average response time
5. Failed/bounced emails
6. Thread history view

**Bot Settings Enhancements:**
1. Custom intro message templates
2. Time slot preferences (morning/afternoon/evening)
3. Blackout dates (holidays, vacations)
4. Custom signature
5. Auto-response rules

---

## 🚀 Implementation Priority

### Phase 1 (This Session): Quick Wins
1. ✅ Verify auto-send is working in production
2. ✅ Test vanity URL email flow end-to-end
3. ✅ Improve pick-a-time template (bigger buttons, better spacing)
4. ✅ Add timezone to slot display
5. ✅ Improve confirmation email template

### Phase 2 (Next Session): Analytics
1. Add email tracking pixel
2. Add click tracking to booking URLs
3. Create analytics database table
4. Build analytics dashboard page

### Phase 3 (Future): Intelligence
1. Smart time slot algorithm
2. Contextual awareness (duration, urgency)
3. Multi-participant detection
4. Guest preferences memory

### Phase 4 (Future): Advanced
1. Custom bot personalities
2. Multi-language support
3. Integration with CRM tools
4. Advanced automation rules

---

## 📋 Testing Checklist

### Before We Start:
- [ ] Verify Mailgun is configured correctly
- [ ] Test sending email to bot address
- [ ] Verify email arrives at webhook
- [ ] Check database has bot_email_settings table
- [ ] Verify MJML templates compile correctly

### After Each Enhancement:
- [ ] Test on real email client (Gmail, Outlook)
- [ ] Test on mobile devices
- [ ] Verify all links work
- [ ] Check email deliverability (not spam)
- [ ] Monitor error logs

---

## 🎯 Success Metrics

**User Adoption:**
- % of users with bot enabled
- Emails processed per day
- Successful bookings via bot

**Email Performance:**
- Open rate > 60%
- Click rate > 30%
- Booking rate > 15%

**User Satisfaction:**
- Time to book < 2 minutes
- Guest survey rating > 4.5/5
- Host satisfaction > 4.0/5

---

## Next Steps

**Let's start with Phase 1!** What would you like to tackle first?

1. Test the vanity URL email bot in production (verify it works)
2. Improve the email templates (better design)
3. Add timezone display to time slots
4. Improve one-click booking experience
5. Something else?
