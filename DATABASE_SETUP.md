# Supabase Database Setup Instructions

## Step 1: Run the SQL Schema

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project: `gaeallcsvqxnrycdoigy`
3. Click on **SQL Editor** in the left sidebar
4. Click **New query**
5. Copy and paste the contents of `supabase-schema.sql` into the editor
6. Click **Run** to execute the SQL

This will create:
- `vendors` table
- `vendor_packages` table
- Row Level Security (RLS) policies
- Indexes for performance

## Step 2: Test the Integration

### Test without authentication (will show alert):
1. Visit: http://localhost:3000/vendor/packages
2. You'll see a "Please sign in" message

### Test with demo user (recommended):
1. First, create a test user in Supabase:
   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add user" → "Create new user"
   - Email: `vendor@test.com`
   - Password: `test123456`
   - Click "Create user"

2. Sign in on your app:
   - Visit: http://localhost:3000/auth/sign-in
   - Click "Demo as Vendor" button (or sign in with the credentials above)

3. Test the packages page:
   - Visit: http://localhost:3000/vendor/packages
   - Click "+ Add Package" to create a package
   - Fill in the form and save
   - Package should be saved to Supabase
   - Refresh the page - packages should persist

## What's Connected:

✅ **Vendor Packages Page** now uses Supabase instead of local state
✅ **Create Package** - saves to `vendor_packages` table
✅ **Edit Package** - updates database record
✅ **Delete Package** - removes from database
✅ **Auto-create Vendor** - creates vendor record if it doesn't exist
✅ **Load Packages** - fetches from database on page load

## Database Structure:

### vendors table
- `id` (UUID, primary key)
- `user_id` (UUID, references auth.users)
- `business_name`, `category`, `location`, `description`
- `created_at`, `updated_at`

### vendor_packages table
- `id` (UUID, primary key)
- `vendor_id` (UUID, references vendors)
- `name`, `description`
- `pricing_mode` ('guest' or 'time')
- `base_price`, `base_guests`, `base_hours`
- `price_per_guest`, `price_per_hour`
- `included_services` (text array)
- `is_popular` (boolean)
- `created_at`, `updated_at`

## Troubleshooting:

**Issue: "Please sign in to manage packages"**
- Solution: You need to be authenticated. Use the demo buttons on sign-in page.

**Issue: "Error creating vendor profile"**
- Check if RLS policies were created correctly
- Check browser console for detailed error messages
- Verify your Supabase credentials in .env.local

**Issue: Packages not saving**
- Check the SQL was run successfully in Supabase
- Open browser DevTools → Console to see error messages
- Verify RLS policies allow INSERT operations
