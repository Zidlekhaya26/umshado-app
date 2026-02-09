# Testing Services Persistence - Step by Step

## Prerequisites
1. ✅ Dev server is running at http://localhost:3000
2. ⚠️ SQL schema must be run in Supabase Dashboard first
3. ⚠️ Need authenticated user session

## Step 1: Run SQL Schema
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** → **New query**
4. Copy all contents from `supabase-services-schema.sql`
5. Click **Run** (Ctrl+Enter)
6. Verify no errors

## Step 2: Create Test User (if not exists)
In Supabase Dashboard → Authentication → Users:
- Click **Add user**
- Email: `vendor@test.com`
- Password: `test123456`
- Click **Create user**

## Step 3: Manual Browser Test

### A. Without Auth (Current State)
1. Open: http://localhost:3000/vendor/services
2. Open browser DevTools (F12) → Console tab
3. You'll see: "No active session"
4. Selections will NOT persist (auth required)

### B. With Mock Manual Test
Since real auth isn't integrated yet, test database directly:

```sql
-- In Supabase SQL Editor

-- 1. Get or create a test vendor
INSERT INTO vendors (user_id, business_name, category)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Caterer', 'Catering')
ON CONFLICT DO NOTHING
RETURNING id;

-- 2. Save some services (use vendor id from above)
INSERT INTO vendor_services (vendor_id, service_id, is_custom)
SELECT 'VENDOR_ID_HERE', id, false
FROM services 
WHERE name IN ('Wedding catering', 'Custom menus', 'Beverage service');

-- 3. Add custom service
INSERT INTO vendor_services (vendor_id, service_name, is_custom)
VALUES ('VENDOR_ID_HERE', 'BBQ Catering', true);

-- 4. Verify saved
SELECT 
  vs.is_custom,
  COALESCE(s.name, vs.service_name) as service_name
FROM vendor_services vs
LEFT JOIN services s ON vs.service_id = s.id
WHERE vs.vendor_id = 'VENDOR_ID_HERE';
```

## Step 4: What Should Happen (When Auth Works)

1. **Visit page** → Shows loading spinner
2. **Page loads** → Previously selected services are checked
3. **Select more services** → Click checkboxes
4. **Add custom service** → Type "BBQ Special" → Click Add
5. **Click Continue** → Button shows "Saving..." → Redirects to packages
6. **Browser back or revisit** → All selections still checked
7. **Check database**:
   ```sql
   SELECT * FROM vendor_services WHERE vendor_id = 'YOUR_VENDOR_ID';
   ```

## Current Limitation

⚠️ **Auth not integrated yet** - The page requires `supabase.auth.getUser()` to return a valid user. Currently returns "No active session".

**Next steps to enable full testing:**
1. Integrate real Supabase authentication
2. Add sign-in functionality  
3. Test with authenticated session

## Quick Verification

Check browser console at http://localhost:3000/vendor/services:
- ✅ No compile errors = Code structure correct
- ⚠️ "No active session" = Need auth integration
- ❌ Other errors = Need debugging
