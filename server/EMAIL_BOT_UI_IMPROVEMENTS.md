# Email Bot UI Improvements - Matching Premium Landing Page Design

## Issue Identified

The **landing page mockup** shows a premium design with day labels (Today, Tomorrow, Friday), but the **actual email template** was generating generic "Available" labels.

---

## Before (Old Design)

### Landing Page Mockup Shows:
```
✓ Today - Jan 15 at 4:00 PM          [Gradient button]
  Tomorrow - Jan 16 at 10:00 AM       [Gray button]
  Friday - Jan 19 at 2:00 PM          [Gray button]
```

### Actual Emails Were Showing:
```
✓ Available - Friday, January 23 at 9:00 AM     [Gradient button]
  Available - Friday, January 23 at 10:00 AM    [Gray button]
  Available - Friday, January 23 at 11:00 AM    [Gray button]
  Available - Monday, January 26 at 9:00 AM     [Gray button]
  Available - Monday, January 26 at 10:00 AM    [Gray button]
```

**Problems:**
- ❌ All slots show "Available" instead of smart day labels
- ❌ Dates are too verbose (Friday, January 23 at 9:00 AM)
- ❌ Doesn't match the premium UI shown on landing page

---

## After (New Design)

### What Emails Will Now Show:
```
✓ Today - Jan 23 at 9:00 AM          [Gradient button]
  Today - Jan 23 at 10:00 AM          [Gray button]
  Today - Jan 23 at 11:00 AM          [Gray button]
  Monday - Jan 26 at 9:00 AM          [Gray button]
  Monday - Jan 26 at 10:00 AM         [Gray button]
```

Or if slots span multiple days:
```
✓ Today - Jan 16 at 4:00 PM           [Gradient button]
  Tomorrow - Jan 17 at 10:00 AM       [Gray button]
  Friday - Jan 19 at 2:00 PM          [Gray button]
  Monday - Jan 22 at 9:00 AM          [Gray button]
  Tuesday - Jan 23 at 11:00 AM        [Gray button]
```

**Improvements:**
- ✅ Smart day labels: "Today", "Tomorrow", or day name
- ✅ Shorter date format: "Jan 23 at 9:00 AM" vs "Friday, January 23 at 9:00 AM"
- ✅ Matches landing page premium design
- ✅ More scannable and professional

---

## Technical Changes

### File: `server/services/emailBot.js`

#### 1. Updated `getAvailableSlots()` function (Line 428-436)

**Before:**
```javascript
if (!hasConflict) {
  slots.push({
    start: slotStart.toISOString(),
    end: slotEnd.toISOString(),
    formatted: formatSlotForEmail(slotStart, duration)
  });
}
```

**After:**
```javascript
if (!hasConflict) {
  // Calculate day label (Today, Tomorrow, or day name)
  const dayLabel = getDayLabel(slotStart, now);

  slots.push({
    start: slotStart.toISOString(),
    end: slotEnd.toISOString(),
    formatted: formatSlotForEmail(slotStart, duration),
    dayLabel: dayLabel  // ← NEW: Smart day labels
  });
}
```

#### 2. Updated `formatSlotForEmail()` function (Line 447-457)

**Before:**
```javascript
function formatSlotForEmail(date, duration) {
  const options = {
    weekday: 'long',      // ← "Friday"
    month: 'long',        // ← "January"
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  return date.toLocaleDateString('en-US', options);
  // Output: "Friday, January 23 at 9:00 AM"
}
```

**After:**
```javascript
function formatSlotForEmail(date, duration) {
  const options = {
    month: 'short',       // ← "Jan" (shorter)
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  return date.toLocaleDateString('en-US', options);
  // Output: "Jan 23 at 9:00 AM"
}
```

#### 3. Added new `getDayLabel()` helper function (Line 459-482)

```javascript
/**
 * Get day label for a time slot (Today, Tomorrow, or day name)
 */
function getDayLabel(slotDate, now) {
  const slotDay = new Date(slotDate);
  slotDay.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const daysDiff = Math.floor((slotDay - today) / (1000 * 60 * 60 * 24));

  if (daysDiff === 0) {
    return 'Today';
  } else if (daysDiff === 1) {
    return 'Tomorrow';
  } else {
    // Return day name (Monday, Tuesday, etc.)
    return slotDate.toLocaleDateString('en-US', { weekday: 'long' });
  }
}
```

---

## Email Template Structure (Unchanged)

The MJML template structure remains the same. It uses the `dayLabel` and `timeFormatted` values:

**Template: `server/templates/pick-a-time.mjml`**
```html
<mj-raw>
  {{slotsHtml}}
</mj-raw>
```

**Generated HTML (from `emailTemplates.js`):**

First slot (gradient):
```html
<a href="/quick-book?...">
  <table style="background:linear-gradient(90deg,#7c3aed 0%,#ec4899 100%);">
    <tr>
      <td>
        <span>✓</span>
        <span><strong>Today</strong></span>  <!-- ← dayLabel -->
        <span><strong>Jan 23 at 9:00 AM</strong></span>  <!-- ← timeFormatted -->
      </td>
    </tr>
  </table>
</a>
```

Other slots (gray):
```html
<a href="/quick-book?...">
  <table style="background:#f6f6f8; border:1px solid #eeeeef;">
    <tr>
      <td>
        <span>Tomorrow</span>  <!-- ← dayLabel -->
        <span><strong>Jan 24 at 10:00 AM</strong></span>  <!-- ← timeFormatted -->
      </td>
    </tr>
  </table>
</a>
```

---

## Visual Comparison

### Landing Page Mockup (Target Design)
```
╔═══════════════════════════════════════════════════════╗
║  📅 Pick a Time                                       ║
╠═══════════════════════════════════════════════════════╣
║  Hi John! 👋                                          ║
║  I'm helping schedule your meeting.                   ║
║                                                       ║
║  ┌──────────────────────────────────────────┐        ║
║  │  ✓ Today - Jan 15 at 4:00 PM          → │  ← Gradient
║  └──────────────────────────────────────────┘        ║
║  ┌──────────────────────────────────────────┐        ║
║  │  Tomorrow                                 │        ║
║  │  Jan 16 at 10:00 AM                       │  ← Gray
║  └──────────────────────────────────────────┘        ║
║  ┌──────────────────────────────────────────┐        ║
║  │  Friday                                   │        ║
║  │  Jan 19 at 2:00 PM                        │  ← Gray
║  └──────────────────────────────────────────┘        ║
╚═══════════════════════════════════════════════════════╝
```

### Old Email Output (Before Fix)
```
╔═══════════════════════════════════════════════════════╗
║  📅 Pick a Time                                       ║
╠═══════════════════════════════════════════════════════╣
║  Hi John! 👋                                          ║
║  I'm helping Jay Bersales schedule your meeting.      ║
║                                                       ║
║  ┌──────────────────────────────────────────┐        ║
║  │  ✓ Available                             │        ║
║  │  Friday, January 23 at 9:00 AM         → │  ← Too long!
║  └──────────────────────────────────────────┘        ║
║  ┌──────────────────────────────────────────┐        ║
║  │  Available                                │  ← Generic!
║  │  Friday, January 23 at 10:00 AM           │        ║
║  └──────────────────────────────────────────┘        ║
╚═══════════════════════════════════════════════════════╝
```

### New Email Output (After Fix)
```
╔═══════════════════════════════════════════════════════╗
║  📅 Pick a Time                                       ║
╠═══════════════════════════════════════════════════════╣
║  Hi John! 👋                                          ║
║  I'm helping Jay Bersales schedule your meeting.      ║
║                                                       ║
║  ┌──────────────────────────────────────────┐        ║
║  │  ✓ Today - Jan 23 at 9:00 AM          → │  ← Matches!
║  └──────────────────────────────────────────┘        ║
║  ┌──────────────────────────────────────────┐        ║
║  │  Today                                    │  ← Smart label
║  │  Jan 23 at 10:00 AM                       │        ║
║  └──────────────────────────────────────────┘        ║
║  ┌──────────────────────────────────────────┐        ║
║  │  Monday                                   │  ← Day name
║  │  Jan 26 at 9:00 AM                        │        ║
║  └──────────────────────────────────────────┘        ║
╚═══════════════════════════════════════════════════════╝
```

---

## Testing

### To Test Locally:

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Run webhook test:**
   ```bash
   node server/test-email-webhook.js
   ```

3. **Check proposed slots:**
   ```bash
   psql $DATABASE_URL -c "SELECT proposed_slots FROM email_bot_threads ORDER BY created_at DESC LIMIT 1;" -x
   ```

4. **Expected output:**
   ```json
   [
     {
       "start": "2026-01-16T14:00:00.000Z",
       "end": "2026-01-16T14:30:00.000Z",
       "formatted": "Jan 16 at 2:00 PM",
       "dayLabel": "Today"  ← NEW!
     },
     {
       "start": "2026-01-17T10:00:00.000Z",
       "end": "2026-01-17T10:30:00.000Z",
       "formatted": "Jan 17 at 10:00 AM",
       "dayLabel": "Tomorrow"  ← NEW!
     }
   ]
   ```

### To Deploy to Production:

```bash
# Commit changes
git add server/services/emailBot.js
git commit -m "Add premium day labels to email bot time slots"

# Push to Railway
git push origin main

# Railway will auto-deploy
```

---

## Benefits

1. **✅ Consistency** - Emails now match the landing page mockup
2. **✅ Professional** - Cleaner, more scannable time slot labels
3. **✅ User-Friendly** - "Today" and "Tomorrow" are easier to parse than dates
4. **✅ Shorter** - "Jan 23" vs "Friday, January 23" saves space
5. **✅ Premium Feel** - Matches Calendly/Skej-level polish

---

## Example Scenarios

### Scenario 1: All slots today
```
✓ Today - Jan 16 at 2:00 PM
  Today - Jan 16 at 3:00 PM
  Today - Jan 16 at 4:00 PM
```

### Scenario 2: Slots spanning 2 days
```
✓ Today - Jan 16 at 4:00 PM
  Tomorrow - Jan 17 at 9:00 AM
  Tomorrow - Jan 17 at 10:00 AM
  Tomorrow - Jan 17 at 2:00 PM
```

### Scenario 3: Slots across week
```
✓ Today - Jan 16 at 2:00 PM
  Tomorrow - Jan 17 at 10:00 AM
  Friday - Jan 19 at 2:00 PM
  Monday - Jan 22 at 9:00 AM
  Tuesday - Jan 23 at 11:00 AM
```

---

## Files Changed

1. **server/services/emailBot.js**
   - Added `getDayLabel()` helper function
   - Updated `getAvailableSlots()` to include dayLabel
   - Shortened date format in `formatSlotForEmail()`

No changes needed to:
- ✅ MJML templates (already support dayLabel)
- ✅ Email template generation (already uses dayLabel with fallback)
- ✅ Database schema (stores slots as JSON)
- ✅ Frontend (QuickBook page unchanged)

---

## Impact

**Before:** Users see generic "Available" labels
**After:** Users see smart labels matching the premium landing page design

This improves the user experience and makes the email bot feel more polished and professional, matching the quality shown in the marketing materials.
