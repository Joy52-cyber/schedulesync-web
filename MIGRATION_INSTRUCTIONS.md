# Running the Onboarding Migration

The onboarding feature requires adding new columns to the `users` table.

## ⚠️ Database Not Configured Locally

The error `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` indicates your local environment doesn't have database credentials configured. This is expected.

## ✅ Options to Run Migration

### Option 1: Railway Dashboard (Recommended)

1. Go to your Railway project dashboard
2. Click on your PostgreSQL database
3. Click "Query" tab
4. Copy and paste this SQL:

```sql
-- Add onboarding columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_from TIME DEFAULT '09:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_to TIME DEFAULT '17:00';
ALTER TABLE users ADD COLUMN IF NOT EXISTS work_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri"]';

-- Mark existing users as already onboarded (they won't see the wizard)
UPDATE users SET onboarded = true WHERE onboarded IS NULL;
```

5. Click "Run Query"
6. Verify with: `SELECT onboarded, available_from, available_to, work_days FROM users LIMIT 5;`

### Option 2: Railway CLI

```bash
# Install Railway CLI if not installed
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Connect to database
railway connect postgres

# Then paste the SQL above
```

### Option 3: Direct PostgreSQL Connection

If you have `psql` installed and your DATABASE_URL:

```bash
psql YOUR_DATABASE_URL_FROM_RAILWAY < server/migrations/add_onboarding.sql
```

## ✅ Verify Migration Success

After running, verify with:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('onboarded', 'available_from', 'available_to', 'work_days')
ORDER BY column_name;
```

You should see:
- `onboarded` (boolean) - default: false
- `available_from` (time) - default: '09:00:00'
- `available_to` (time) - default: '17:00:00'
- `work_days` (jsonb) - default: '["Mon","Tue","Wed","Thu","Fri"]'

## 🧪 Test After Migration

1. Create a new test user via registration or OAuth
2. Check that they're redirected to `/onboarding`
3. Complete the onboarding wizard
4. Verify they're redirected to `/dashboard`
5. Check that existing users still go directly to `/dashboard`

## 🔧 What Happens Next

Once migration is complete:
- New users: `onboarded = false` → redirected to `/onboarding`
- After completing onboarding: `onboarded = true` → can access dashboard
- Existing users: `onboarded = true` (from UPDATE) → no interruption
