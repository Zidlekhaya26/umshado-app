# Vendor Onboarding Bug Fix - Database Migration Required

## Issue Summary
Vendor accounts were being redirected to couple onboarding because the profile database was missing the `has_vendor`, `has_couple`, and `active_role` columns needed to track multi-role users.

## What Was Fixed

### 1. **Database Schema** (NEW MIGRATION)
Created `migrations/017_add_role_flags_to_profiles.sql` which adds:
- `has_couple boolean` - tracks if user has completed couple onboarding
- `has_vendor boolean` - tracks if user has completed vendor onboarding  
- `active_role text` - tracks which role is currently active (couple/vendor)

### 2. **Vendor Onboarding Page** (`app/vendor/onboarding/page.tsx`)
- ✅ Fixed syntax error (trailing comma in function call)
- ✅ Added load-on-mount to fetch existing vendor data from database
- ✅ Added loading state while fetching data
- ✅ Changed navigation to use `router.push()` instead of `window.location.href` to preserve auth session

### 3. **Auth Routing** (`lib/authRouting.ts`)
- ✅ Added check for existing vendor row when determining post-auth redirect
- ✅ Auto-updates profile flags when vendor row is detected
- ✅ Prefers vendor role if vendor record exists

## Required Action: Run the Migration

**You must run the new migration in Supabase to add the missing columns:**

```sql
-- Go to Supabase Dashboard → SQL Editor → New Query
-- Copy-paste the entire contents of: migrations/017_add_role_flags_to_profiles.sql
-- Click "Run"
```

Or via Supabase CLI:
```bash
supabase db push
```

## How It Works Now

1. **Vendor Signs In**
   - Auth routing checks if vendor row exists for user
   - If yes → sets `active_role = 'vendor'` and `has_vendor = true`
   - Redirects to `/vendor/onboarding`

2. **Vendor Onboarding Page Loads**
   - Fetches existing vendor data from database
   - Populates form fields with saved data (if previous session)
   - Allows vendor to review/update their info

3. **Vendor Submits Form**
   - `upsertVendor()` saves data and updates profile flags
   - Profile now has: `has_vendor = true`, `active_role = 'vendor'`
   - Navigates to `/vendor/services`

4. **Middleware Validation**
   - When accessing `/vendor/*` routes, middleware checks:
     - `activeRole == 'vendor'` ✅ → Allow through
     - Otherwise → Redirect to appropriate dashboard

## Testing

1. Run migration in Supabase
2. Sign in with a vendor account
3. Verify:
   - ✅ Not redirected to couple onboarding
   - ✅ Form shows existing vendor data (if any)
   - ✅ After submit, redirected to `/vendor/services`
   - ✅ Can access vendor dashboard without redirect loops

## Database Schema After Migration

```sql
-- profiles table now has:
- id (uuid) - Primary key
- role (text) - Legacy column: 'couple' or 'vendor'
- has_couple (boolean) - User has completed couple onboarding
- has_vendor (boolean) - User has completed vendor onboarding  
- active_role (text) - Currently active role
- full_name (text)
- created_at (timestamptz)
- wedding_date (date)
- wedding_venue (text)
- avatar_url (text)
```

## File Changes

- **New:** `migrations/017_add_role_flags_to_profiles.sql`
- **Modified:** `app/vendor/onboarding/page.tsx` - Load data, fix syntax
- **Modified:** `lib/authRouting.ts` - Vendor detection logic
