# uMshado Quick Start Guide

Get your uMshado wedding planning app running in minutes.

## Prerequisites

- Node.js 18+ installed
- Supabase account with a project created
- Supabase connection details (URL and anon key)

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Get these from your Supabase project settings → API.

## 3. Set Up Database

Run these SQL files **in order** in your Supabase SQL Editor:

### Step 1: Base Schema
File: `migrations/001_profiles_couples_vendors.sql`
- Creates profiles, couples, vendors tables
- Sets up user type system

### Step 2: Services Schema
File: `supabase-services-schema.sql`
- Creates services catalog
- Creates vendor_services linking table
- Creates vendor_packages table

### Step 3: Security (RLS)
File: `supabase/rls.sql`
- Enables Row-Level Security on all tables
- Sets up granular access policies
- Protects user data

### Step 4: RLS Marketplace Update (CRITICAL!)
File: `supabase/rls-marketplace-update.sql`
- Updates vendor RLS policies to allow marketplace browsing
- Allows all authenticated users to view vendors, packages, and services
- Without this, marketplace will show no vendors!

### Step 5: Marketplace View
File: `supabase/marketplace.sql`
- Creates marketplace_vendors view
- Aggregates vendor data with services and pricing
- Adds performance indexes

### Step 6: Quote Engine
File: `supabase/quotes.sql`
- Creates quotes, quote_line_items tables
- Creates conversations, messages tables
- Adds generate_quote_ref() function
- Sets up RLS for chat

### Step 7: Seed Data (Testing)
File: `supabase/seed-data.sql`
- Adds 8 service categories
- Adds 3 sample vendors with profiles
- Adds 7 packages across different categories
- Links vendors to services

## 4. Verify Database Setup

Run these queries in Supabase SQL Editor:

```sql
-- Check all tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'couples', 'vendors', 'vendor_services', 'vendor_packages', 'quotes');

-- Check seed data loaded
SELECT COUNT(*) FROM services;  -- Should be 8
SELECT COUNT(*) FROM vendors;   -- Should be 3
SELECT COUNT(*) FROM vendor_packages;  -- Should be 7

-- Check marketplace view
SELECT * FROM marketplace_vendors;  -- Should show 3 vendors
```

## 5. Start Development Server

```bash
npm run dev
```

Open http://localhost:3000

## 6. Test Key Flows

### Test Authentication
1. Visit http://localhost:3000/auth/sign-up
2. Create a test account
3. Select "Couple" or "Vendor" user type

### Test Marketplace (Couple View)
1. Sign in as a couple
2. Visit http://localhost:3000/marketplace
3. Browse vendors - should see 3 sample vendors
4. Test filters: search, category, service chips
5. Click a vendor to view profile
6. Click "Request Quote" on a package

### Test Quote Flow
1. From vendor profile, click "Request Quote"
2. Adjust guest count or hours
3. Select add-ons
4. Add notes
5. Click "Request Quote"
6. Should redirect to chat with quote reference

### Test Vendor Dashboard
1. Sign in as a vendor (or create vendor account)
2. Visit http://localhost:3000/vendor/dashboard
3. Should see quote requests (if any)
4. Click "Open Chat" to view conversation

## Common Issues

### "Error fetching vendor profile: {}"
**Solution**: 
1. Run `supabase/rls-marketplace-update.sql` to allow marketplace browsing
2. Run `supabase/seed-data.sql` to create sample vendors for testing
3. Verify RLS policies: `SELECT * FROM vendors;` should return all vendors

### "Permission denied" errors
**Solution**: Verify `supabase/rls.sql` was run and RLS is enabled on all tables.

### Marketplace shows no vendors
**Solution**: 
1. Check `supabase/marketplace.sql` was run
2. Run `SELECT * FROM marketplace_vendors;` to verify view exists
3. Run `supabase/seed-data.sql` to add sample data

### Quote request fails
**Solution**:
1. Verify `supabase/quotes.sql` was run
2. Check `generate_quote_ref()` function exists: `SELECT generate_quote_ref();`
3. Ensure vendor has packages created

### Build errors
**Solution**:
1. Delete `.next` folder: `rm -rf .next`
2. Restart dev server: `npm run dev`
3. Check for TypeScript errors: `npm run build`

## Next Steps

- Read [MARKETPLACE_IMPLEMENTATION.md](MARKETPLACE_IMPLEMENTATION.md) for marketplace details
- Read [QUOTE_ENGINE_IMPLEMENTATION.md](QUOTE_ENGINE_IMPLEMENTATION.md) for quote system details
- Customize vendor categories in seed data
- Add your own sample vendors
- Implement real vendor onboarding flow
- Set up production environment variables

## Support

For detailed documentation, see:
- [README.md](README.md) - Full project documentation
- [MARKETPLACE_TESTING.md](MARKETPLACE_TESTING.md) - Marketplace testing checklist
- [DATABASE_SETUP.md](DATABASE_SETUP.md) - Database schema details
