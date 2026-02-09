This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Database Security (RLS)

uMshado uses Row-Level Security (RLS) policies to ensure production-grade access control.

### Applying RLS Policies

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/rls.sql`
4. Paste and run the SQL
5. Verify all tables show `rowsecurity = true`

### Testing RLS

After applying policies, test the following:

**Couple Flow:**
1. Sign up as a new user
2. Complete couple onboarding at `/couple/onboarding`
3. Visit `/debug/whoami` - confirm your couple data appears
4. Refresh the page - data should persist

**Vendor Flow:**
1. Sign up as a vendor
2. Complete vendor onboarding
3. Select services at `/vendor/services`
4. Refresh the page - selections should persist
5. Create packages at `/vendor/packages`
6. Refresh the page - packages should persist

**Security Check:**
- Users should only see their own profile, couple, or vendor data
- Vendors can only modify their own services and packages
- All authenticated users can view the services catalog (read-only)

If you encounter permission errors, check the Supabase logs and verify the policies match your table schema.

## Database Setup Order

Run these SQL files in your Supabase SQL Editor **in this order**:

1. **Schema** - `migrations/001_profiles_couples_vendors.sql` (creates base tables)
2. **Services Schema** - `supabase-services-schema.sql` (creates services and vendor_services tables)
3. **RLS Policies** - `supabase/rls.sql` (enables security on all tables)
4. **RLS Marketplace Update** - `supabase/rls-marketplace-update.sql` (allows marketplace browsing - IMPORTANT!)
5. **Marketplace View** - `supabase/marketplace.sql` (creates marketplace_vendors view)
6. **Quote Engine** - `supabase/quotes.sql` (creates quotes, conversations, messages tables)
7. **Storage Setup** - `supabase/storage.sql` (creates umshado-files bucket + policies for file uploads)
8. **Attachments** - `supabase/attachments.sql` (creates message_attachments + quote_attachments tables)
9. **Seed Data** - `supabase/seed-data.sql` (adds sample vendors, services, and packages for testing)

**Important**: Step 4 (`rls-marketplace-update.sql`) is critical - it updates the RLS policies to allow authenticated users to browse all vendors, not just their own profile. Without this, the marketplace will show no vendors!

## Marketplace Setup

uMshado features a real-time marketplace with intelligent vendor ranking and filtering.

### Setting Up Marketplace View

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/marketplace.sql`
4. Paste and run the SQL to create the `marketplace_vendors` view
5. Verify: Run `SELECT * FROM marketplace_vendors LIMIT 5;`

### Adding Test Data

To test the marketplace, you need sample vendors and packages:

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/seed-data.sql`
4. Paste and run the SQL to create:
   - 8 wedding service categories (Photography, Catering, Venue, etc.)
   - 3 sample vendors (Eternal Moments Photography, Royal Feast Catering, Garden Bliss Estate)
   - 7 packages across different pricing modes and categories
5. Verify: Run `SELECT * FROM marketplace_vendors;` - should show 3 vendors with aggregated data

### Features

- **Smart Ranking**: Vendors are ranked based on couple preferences, service matches, profile completeness, and recency
- **Advanced Filtering**: Search, category filter, service filter (multi-select), and sort options
- **Real Data**: Pulls vendor details, services, and pricing from Supabase
- **Secure**: Uses RLS to protect vendor private data while allowing public marketplace browsing

### Testing Marketplace

See [MARKETPLACE_TESTING.md](MARKETPLACE_TESTING.md) for comprehensive testing checklist.

**Quick Test:**
1. Start dev server: `npm run dev`
2. Navigate to http://localhost:3000/marketplace
3. Verify vendors display with services and pricing
4. Test filters: search, category, service chips, and sort dropdown
5. Confirm "Recommended" sort ranks vendors intelligently

**Test Data Requirements:**
- At least 3 vendors with different categories
- At least 1 vendor with packages (for pricing display)
- At least 2 vendors with services selected

## Quote Engine Setup

uMshado features a complete quote request system that connects couples with vendors through chat.

### Setting Up Quote Engine

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/quotes.sql`
4. Paste and run the SQL to create:
   - `quotes` table - stores quote requests
   - `quote_line_items` table - itemized quote details
   - `conversations` table - chat threads between couples and vendors
   - `messages` table - chat messages
   - `generate_quote_ref()` function - creates unique quote references (e.g., Q-20260206-A3K9M)
5. Verify tables exist: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('quotes', 'conversations', 'messages');`

### Features

- **Quote Request Flow**: Couples can request quotes directly from vendor packages
- **Dynamic Pricing**: Calculates totals based on guest count, hours, and add-ons
- **Chat Integration**: Automatically creates/opens chat thread when quote is requested
- **Vendor Inbox**: Vendors see pending quote requests on their dashboard
- **Quote References**: Human-friendly IDs for tracking (Q-YYYYMMDD-XXXXX)

### Testing Quote Engine

**End-to-End Flow:**

1. **Setup**:
   - Start dev server: `npm run dev`
   - Have at least 1 vendor with packages created
   - Sign in as a couple

2. **Browse & Request Quote**:
   - Visit http://localhost:3000/marketplace
   - Click on a vendor card
   - Click on a package "Request Quote" button
   - This should redirect to `/quotes/summary?vendorId=...&packageId=...`

3. **Customize Quote**:
   - Adjust guest count or hours based on package type
   - Select optional add-ons (cake, decor, photography, music)
   - Add notes for the vendor
   - Review estimated total
   - Click "Request Quote"

4. **Verify Chat Opens**:
   - Should redirect to `/messages/thread/[conversationId]`
   - Initial message should contain quote reference (Q-...) and details
   - Chat should be between couple and vendor

5. **Vendor View**:
   - Sign in as the vendor
   - Visit `/vendor/dashboard`
   - Quote request should appear in "Quote Requests" section
   - Shows: quote ref, couple name, package, guests/hours, estimated total
   - Click "Open Chat" to view conversation

6. **Verify Database**:
   ```sql
   -- Check quotes were created
   SELECT quote_ref, status, package_name, base_from_price FROM quotes;
   
   -- Check conversations exist
   SELECT * FROM conversations;
   
   -- Check messages contain quote refs
   SELECT message_text, quote_ref FROM messages WHERE quote_ref IS NOT NULL;
   ```

**Expected Behavior:**
- ✅ Quote reference generates successfully (Q-YYYYMMDD-XXXXX format)
- ✅ Quote saves with correct pricing calculations
- ✅ Conversation creates or finds existing thread
- ✅ Initial message posts with quote summary
- ✅ Vendor dashboard shows pending quote requests
- ✅ "Open Chat" navigates to correct conversation

**Troubleshooting:**
- If `generate_quote_ref()` fails, ensure function was created in SQL
- If conversation not found, check RLS policies on conversations table
- If vendor dashboard empty, verify vendor_id matches authenticated user
- Check browser console and Supabase logs for detailed errors

### Testing Links

- Marketplace: http://localhost:3000/marketplace
- Quote Summary (requires params): http://localhost:3000/quotes/summary?vendorId=UUID&packageId=UUID
- Vendor Dashboard: http://localhost:3000/vendor/dashboard
- Messages: http://localhost:3000/messages/thread/[conversationId]

## File Uploads & Attachments

uMshado supports secure file uploads in chat conversations using Supabase Storage.

### Setting Up File Uploads

1. **Create Storage Bucket** (Option A - Dashboard):
   - Go to Supabase Dashboard → Storage
   - Click "Create new bucket"
   - Bucket name: `umshado-files`
   - Public bucket: **OFF** (unchecked)
   - File size limit: `10485760` (10 MB)
   - Click "Create bucket"

2. **Or use SQL** (Option B):
   - Open Supabase SQL Editor
   - Run `supabase/storage.sql`

3. **Create Attachment Tables**:
   - Run `supabase/attachments.sql` in SQL Editor
   - Creates `message_attachments` and `quote_attachments` tables with RLS

### Features

- **Supported Files**: Images (JPEG, PNG, WebP, GIF), PDFs, Word docs, Excel sheets
- **File Size Limit**: 10 MB per file
- **Security**: Private bucket with signed URLs (1-hour expiry)
- **Image Previews**: Inline image display in chat bubbles
- **Document Cards**: File name, size, and download button for non-images
- **Real-time**: Attachments appear instantly via Supabase Realtime
- **Multiple Uploads**: Select and upload multiple files at once

### Testing File Uploads

See [FILE_UPLOADS_IMPLEMENTATION.md](FILE_UPLOADS_IMPLEMENTATION.md) for detailed testing guide.

**Quick Test:**
1. Open a conversation: http://localhost:3000/messages/thread/[conversationId]
2. Click the attachment button (📎 icon)
3. Select an image and/or PDF
4. Wait for upload to complete
5. Verify:
   - ✅ Image appears as inline preview
   - ✅ PDF shows as document card with download button
   - ✅ Can click to download/view
   - ✅ Refresh page - files still display

**Database Check:**
```sql
-- Check attachments were created
SELECT * FROM message_attachments ORDER BY created_at DESC LIMIT 5;

-- Check storage bucket exists
SELECT * FROM storage.buckets WHERE id = 'umshado-files';

-- Check storage policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
```
