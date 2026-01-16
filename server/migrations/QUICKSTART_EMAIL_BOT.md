# Email Bot Quick Start Guide

## Setup (One-Time)

### 1. Run the Migration

```bash
cd C:\Users\joyla\OneDrive\schedulesync-web
node server/migrations/run-migration.js add_email_bot.sql
```

### 2. Verify Schema

```bash
node server/migrations/verify-email-bot-schema.js
```

You should see:
```
✅ Table "email_bot_settings" exists
✅ Table "email_bot_threads" exists
✅ Table "email_bot_messages" exists
✅ Found 8 indexes
```

### 3. Initialize Bot Settings for a User

First, find a user ID:
```bash
# Connect to database
psql $DATABASE_URL

# List users
SELECT id, email, username, name FROM users;
```

Then initialize bot settings:
```bash
node server/migrations/init-bot-settings.js <user_id>

# Example:
node server/migrations/init-bot-settings.js 1
```

You should see:
```
✅ Found user: John Doe (john@example.com)
✅ Email bot settings created successfully!
📧 Bot Email Address: schedule@mg.trucal.xyz
```

---

## Usage Examples

### Example 1: Check Bot Settings

```javascript
const pool = require('../config/database');

async function getBotSettings(userId) {
  const result = await pool.query(
    'SELECT * FROM email_bot_settings WHERE user_id = $1',
    [userId]
  );
  return result.rows[0];
}

// Usage
const settings = await getBotSettings(1);
console.log('Bot enabled:', settings.is_enabled);
console.log('Default duration:', settings.default_duration, 'minutes');
```

### Example 2: Create a Thread When Email Arrives

```javascript
async function createThread(userId, emailData) {
  const result = await pool.query(`
    INSERT INTO email_bot_threads (
      user_id,
      thread_id,
      subject,
      participants,
      status
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `, [
    userId,
    emailData.messageId,
    emailData.subject,
    JSON.stringify(emailData.participants),
    'active'
  ]);

  return result.rows[0];
}

// Usage
const thread = await createThread(1, {
  messageId: 'msg-123456',
  subject: 'Partnership Discussion',
  participants: [
    { email: 'john@company.com', name: 'John Smith' }
  ]
});

console.log('Thread created:', thread.id);
```

### Example 3: Store Inbound Message

```javascript
async function storeMessage(threadId, emailData) {
  const result = await pool.query(`
    INSERT INTO email_bot_messages (
      thread_id,
      message_id,
      direction,
      from_email,
      from_name,
      to_emails,
      cc_emails,
      subject,
      body_text,
      body_html
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *;
  `, [
    threadId,
    emailData.messageId,
    'inbound',
    emailData.from.email,
    emailData.from.name,
    JSON.stringify(emailData.to),
    JSON.stringify(emailData.cc || []),
    emailData.subject,
    emailData.text,
    emailData.html
  ]);

  return result.rows[0];
}
```

### Example 4: Store Proposed Slots

```javascript
async function storeProposedSlots(threadId, slots) {
  await pool.query(`
    UPDATE email_bot_threads
    SET proposed_slots = $1, updated_at = NOW()
    WHERE id = $2;
  `, [
    JSON.stringify(slots),
    threadId
  ]);
}

// Usage
const slots = [
  {
    start: '2024-01-22T10:00:00Z',
    end: '2024-01-22T10:30:00Z',
    formatted: 'Jan 22 at 10:00 AM',
    dayLabel: 'Today'
  },
  {
    start: '2024-01-23T14:00:00Z',
    end: '2024-01-23T14:30:00Z',
    formatted: 'Jan 23 at 2:00 PM',
    dayLabel: 'Tomorrow'
  }
];

await storeProposedSlots(thread.id, slots);
```

### Example 5: Mark Thread as Booked

```javascript
async function markThreadBooked(threadId, bookingId) {
  await pool.query(`
    UPDATE email_bot_threads
    SET status = 'booked',
        booking_id = $1,
        updated_at = NOW()
    WHERE id = $2;
  `, [bookingId, threadId]);
}

// Usage
await markThreadBooked(123, 456); // thread_id=123, booking_id=456
```

### Example 6: Get Active Threads for User

```javascript
async function getActiveThreads(userId) {
  const result = await pool.query(`
    SELECT t.*, COUNT(m.id) as message_count
    FROM email_bot_threads t
    LEFT JOIN email_bot_messages m ON m.thread_id = t.id
    WHERE t.user_id = $1 AND t.status = 'active'
    GROUP BY t.id
    ORDER BY t.updated_at DESC;
  `, [userId]);

  return result.rows;
}

// Usage
const threads = await getActiveThreads(1);
console.log(`Found ${threads.length} active threads`);
```

---

## Integration with Existing Code

### Update emailBot.js to Use Schema

```javascript
// server/services/emailBot.js

// Get bot settings
async function getBotSettings(userId) {
  const result = await pool.query(
    'SELECT * FROM email_bot_settings WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

// Find or create thread
async function findOrCreateThread(userId, emailData) {
  // Check if thread exists
  const existing = await pool.query(
    'SELECT * FROM email_bot_threads WHERE user_id = $1 AND thread_id = $2',
    [userId, emailData.messageId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // Create new thread
  const result = await pool.query(`
    INSERT INTO email_bot_threads (user_id, thread_id, subject, participants, status)
    VALUES ($1, $2, $3, $4, 'active')
    RETURNING *;
  `, [
    userId,
    emailData.messageId,
    emailData.subject,
    JSON.stringify(emailData.participants)
  ]);

  return result.rows[0];
}

// Store message
async function storeMessage(threadId, direction, emailData) {
  await pool.query(`
    INSERT INTO email_bot_messages (
      thread_id, message_id, direction, from_email, from_name,
      to_emails, cc_emails, subject, body_text, body_html
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);
  `, [
    threadId,
    emailData.messageId,
    direction,
    emailData.from?.email,
    emailData.from?.name,
    JSON.stringify(emailData.to || []),
    JSON.stringify(emailData.cc || []),
    emailData.subject,
    emailData.text,
    emailData.html
  ]);
}
```

---

## Testing

### Test Database Queries

```bash
# Connect to database
psql $DATABASE_URL

# Check bot settings
SELECT * FROM email_bot_settings;

# Check threads
SELECT id, user_id, subject, status, created_at FROM email_bot_threads;

# Check messages
SELECT id, thread_id, direction, from_email, subject, created_at FROM email_bot_messages;
```

### Test with Sample Data

```sql
-- Insert test thread
INSERT INTO email_bot_threads (user_id, thread_id, subject, participants, status)
VALUES (1, 'test-msg-123', 'Test Meeting', '[{"email":"test@example.com","name":"Test User"}]', 'active');

-- Insert test message
INSERT INTO email_bot_messages (thread_id, direction, from_email, subject, body_text)
VALUES (1, 'inbound', 'test@example.com', 'Test Meeting', 'Let''s schedule a meeting!');

-- Query results
SELECT * FROM email_bot_threads WHERE thread_id = 'test-msg-123';
SELECT * FROM email_bot_messages WHERE thread_id = 1;
```

---

## Troubleshooting

### Error: relation "email_bot_settings" does not exist

**Solution:** Run the migration:
```bash
node server/migrations/run-migration.js add_email_bot.sql
```

### Error: duplicate key value violates unique constraint "email_bot_settings_user_id_key"

**Cause:** Bot settings already exist for this user.

**Solution:** Delete existing settings:
```sql
DELETE FROM email_bot_settings WHERE user_id = 1;
```

Then re-run init script.

### Error: column "user_id" of relation "email_bot_settings" does not exist

**Cause:** Users table doesn't exist or migration failed.

**Solution:** Check if users table exists:
```sql
SELECT * FROM information_schema.tables WHERE table_name = 'users';
```

---

## Next Steps

1. **Implement Mailgun Webhook Handler**
   - Create `/api/webhooks/mailgun` endpoint
   - Parse inbound emails
   - Call `findOrCreateThread()` and `storeMessage()`

2. **Implement Slot Generation**
   - Check user's calendar
   - Generate available time slots
   - Store in `email_bot_threads.proposed_slots`

3. **Implement Quick Book Endpoint**
   - Create `/quick-book?user=X&time=Y&thread=Z` route
   - Create booking in database
   - Update thread status to 'booked'
   - Send confirmation email

4. **Add Bot Settings UI**
   - Settings page in dashboard
   - Enable/disable toggle
   - Customize intro message & signature

---

## Resources

- [Email Bot Schema Documentation](./EMAIL_BOT_SCHEMA.md)
- [MJML Email Templates](../templates/)
- [Email Bot Service](../services/emailBot.js)
- [Email Templates Service](../services/emailTemplates.js)
