# Email Bot Database Schema Documentation

## Overview

The email bot feature allows users to schedule meetings directly via email by CC'ing `schedule@mg.trucal.xyz`. The bot automatically proposes available times, handles replies, and books meetings without requiring recipients to visit a booking page.

## Database Tables

### 1. `email_bot_settings`

Stores per-user configuration for the email bot.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique settings ID |
| `user_id` | INTEGER | REFERENCES users(id), UNIQUE | User who owns these settings |
| `is_enabled` | BOOLEAN | DEFAULT true | Whether bot is active for this user |
| `bot_email_prefix` | VARCHAR(100) | - | Custom prefix (reserved for future use) |
| `default_duration` | INTEGER | DEFAULT 30 | Default meeting duration in minutes |
| `default_event_type_id` | INTEGER | REFERENCES event_types(id) | Default event type to use |
| `intro_message` | TEXT | DEFAULT 'I''m helping {{hostName}} find a time for your meeting.' | Customizable intro message |
| `signature` | TEXT | DEFAULT 'Powered by TruCal' | Email signature |
| `max_slots_to_show` | INTEGER | DEFAULT 5 | Maximum time slots to propose |
| `prefer_time_of_day` | VARCHAR(20) | - | 'morning', 'afternoon', 'evening', or null |
| `created_at` | TIMESTAMP | DEFAULT NOW() | When settings were created |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `email_bot_settings_pkey` - Primary key on `id`
- `email_bot_settings_user_id_key` - Unique constraint on `user_id`
- `idx_email_bot_settings_user` - Index on `user_id`

**Usage Example:**

```sql
-- Get bot settings for user
SELECT * FROM email_bot_settings WHERE user_id = 1;

-- Enable/disable bot
UPDATE email_bot_settings SET is_enabled = false WHERE user_id = 1;

-- Update intro message
UPDATE email_bot_settings
SET intro_message = 'Hey! I''m helping {{hostName}} find time to meet.'
WHERE user_id = 1;
```

---

### 2. `email_bot_threads`

Tracks email conversation threads where the bot is participating.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique thread ID |
| `user_id` | INTEGER | REFERENCES users(id) | TruCal user for this thread |
| `thread_id` | VARCHAR(255) | NOT NULL | Email Message-ID or thread reference |
| `subject` | TEXT | - | Email subject line |
| `participants` | JSONB | - | Array of {email, name} objects |
| `status` | VARCHAR(20) | DEFAULT 'active' | 'active', 'booked', 'expired', 'cancelled' |
| `booking_id` | INTEGER | REFERENCES bookings(id) | Related booking if booked |
| `proposed_slots` | JSONB | - | Time slots offered to guest |
| `created_at` | TIMESTAMP | DEFAULT NOW() | When thread started |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Last activity |
| `expires_at` | TIMESTAMP | DEFAULT NOW() + 7 days | When slots expire |

**Indexes:**
- `email_bot_threads_pkey` - Primary key on `id`
- `idx_email_bot_threads_user` - Index on `(user_id, status)`
- `idx_email_bot_threads_thread` - Index on `thread_id`

**Status Flow:**
```
active → booked (when guest confirms a time)
active → expired (when expires_at is reached)
active → cancelled (when cancelled by host/guest)
```

**JSONB Fields:**

`participants`:
```json
[
  {"email": "john@company.com", "name": "John Smith"},
  {"email": "sarah@company.com", "name": "Sarah Johnson"}
]
```

`proposed_slots`:
```json
[
  {
    "start": "2024-01-22T10:00:00Z",
    "end": "2024-01-22T10:30:00Z",
    "formatted": "Jan 22 at 10:00 AM",
    "dayLabel": "Today"
  },
  {
    "start": "2024-01-23T14:00:00Z",
    "end": "2024-01-23T14:30:00Z",
    "formatted": "Jan 23 at 2:00 PM",
    "dayLabel": "Tomorrow"
  }
]
```

**Usage Example:**

```sql
-- Get active threads for user
SELECT * FROM email_bot_threads
WHERE user_id = 1 AND status = 'active'
ORDER BY created_at DESC;

-- Mark thread as booked
UPDATE email_bot_threads
SET status = 'booked', booking_id = 123, updated_at = NOW()
WHERE id = 456;

-- Find expired threads
SELECT * FROM email_bot_threads
WHERE status = 'active' AND expires_at < NOW();
```

---

### 3. `email_bot_messages`

Stores individual email messages within threads.

**Columns:**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Unique message ID |
| `thread_id` | INTEGER | REFERENCES email_bot_threads(id) | Parent thread |
| `message_id` | VARCHAR(255) | - | Email Message-ID header |
| `direction` | VARCHAR(10) | - | 'inbound' or 'outbound' |
| `from_email` | VARCHAR(255) | - | Sender email address |
| `from_name` | VARCHAR(255) | - | Sender name |
| `to_emails` | JSONB | - | Array of recipient emails |
| `cc_emails` | JSONB | - | Array of CC'd emails |
| `subject` | TEXT | - | Email subject |
| `body_text` | TEXT | - | Plain text body |
| `body_html` | TEXT | - | HTML body |
| `parsed_intent` | JSONB | - | AI-parsed intent/preferences |
| `created_at` | TIMESTAMP | DEFAULT NOW() | When message was received/sent |

**Indexes:**
- `email_bot_messages_pkey` - Primary key on `id`
- `idx_email_bot_messages_thread` - Index on `thread_id`

**Direction Values:**
- `inbound` - Message received by the bot
- `outbound` - Message sent by the bot

**JSONB Fields:**

`to_emails`, `cc_emails`:
```json
["john@company.com", "sarah@company.com"]
```

`parsed_intent`:
```json
{
  "action": "schedule",
  "duration": 30,
  "preferences": ["morning", "this week"],
  "urgency": "normal",
  "confidence": 0.95
}
```

**Usage Example:**

```sql
-- Get all messages in a thread
SELECT * FROM email_bot_messages
WHERE thread_id = 123
ORDER BY created_at ASC;

-- Get latest inbound message
SELECT * FROM email_bot_messages
WHERE thread_id = 123 AND direction = 'inbound'
ORDER BY created_at DESC
LIMIT 1;

-- Count messages per thread
SELECT thread_id, COUNT(*) as message_count
FROM email_bot_messages
GROUP BY thread_id;
```

---

## Common Queries

### Get Complete Thread with Messages

```sql
SELECT
  t.*,
  json_agg(
    json_build_object(
      'id', m.id,
      'direction', m.direction,
      'from_email', m.from_email,
      'subject', m.subject,
      'created_at', m.created_at
    ) ORDER BY m.created_at ASC
  ) as messages
FROM email_bot_threads t
LEFT JOIN email_bot_messages m ON m.thread_id = t.id
WHERE t.id = 123
GROUP BY t.id;
```

### Find User by Bot Email

```sql
-- When email arrives at schedule@mg.trucal.xyz
-- Find all users who might be the target (check CC/To fields)
SELECT u.id, u.email, u.name, s.is_enabled
FROM users u
INNER JOIN email_bot_settings s ON s.user_id = u.id
WHERE s.is_enabled = true
  AND u.email = 'user@example.com'; -- from CC/To list
```

### Active Threads Summary

```sql
SELECT
  u.name as user_name,
  COUNT(t.id) as active_threads,
  MAX(t.updated_at) as last_activity
FROM email_bot_threads t
INNER JOIN users u ON u.id = t.user_id
WHERE t.status = 'active'
GROUP BY u.id, u.name
ORDER BY active_threads DESC;
```

---

## Migration Scripts

### Run Migration

```bash
node server/migrations/run-migration.js add_email_bot.sql
```

### Verify Schema

```bash
node server/migrations/verify-email-bot-schema.js
```

### Initialize Bot Settings for User

```bash
node server/migrations/init-bot-settings.js <user_id>
```

---

## Email Bot Flow

1. **Email Arrives** at schedule@mg.trucal.xyz
   - Mailgun webhook delivers to `/api/webhooks/mailgun`

2. **Identify User**
   - Parse To/CC fields to find TruCal user
   - Check if user has `email_bot_settings.is_enabled = true`

3. **Find or Create Thread**
   - Check if `thread_id` exists in `email_bot_threads`
   - If not, create new thread with status='active'

4. **Store Message**
   - Insert into `email_bot_messages` with direction='inbound'

5. **Parse Intent**
   - Use AI/keywords to detect scheduling request
   - Store in `parsed_intent` JSONB field

6. **Generate Slots**
   - Check user's calendar availability
   - Create array of time slots
   - Store in `email_bot_threads.proposed_slots`

7. **Send Response**
   - Use MJML template: `pick-a-time.mjml`
   - Insert into `email_bot_messages` with direction='outbound'
   - Send via Resend API

8. **Guest Clicks Time Slot**
   - `/quick-book?user=X&time=Y&thread=Z`
   - Update thread: status='booked', booking_id=<new_booking>
   - Send confirmation emails

---

## Security Considerations

- **User Privacy**: Only store necessary email content
- **JSONB Indexing**: Consider GIN indexes for JSONB columns if querying nested data
- **Expiration**: Automatically clean up threads older than 30 days
- **Rate Limiting**: Limit bot responses per user/thread

---

## Future Enhancements

- [ ] Custom bot email prefixes (schedule-john@trucal.xyz)
- [ ] AI-powered intent parsing
- [ ] Multi-language support
- [ ] Calendar conflict detection
- [ ] Automated follow-ups for expired threads
- [ ] Analytics dashboard (threads created, bookings made, etc.)
