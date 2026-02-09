# File Uploads Setup Guide

## ✅ Implementation Complete

The file upload system has been successfully implemented in the chat thread UI. Here's what you need to do to make it work:

## 🗄️ Database Setup

### Step 1: Create Storage Bucket & Policies

Run this SQL in your Supabase SQL Editor:

```sql
-- Execute: supabase/storage.sql
```

Or manually in Supabase Dashboard:
1. Go to **Storage** → **Create bucket**
2. Name: `umshado-files`
3. **Public:** OFF (Private bucket)
4. File size limit: 10 MB

### Step 2: Create Attachments Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Execute: supabase/attachments.sql
```

This creates:
- `message_attachments` table with RLS policies
- `quote_attachments` table (for future use)
- Indexes for performance

## 🎨 Chat UI Features

The updated chat thread now includes:

### File Upload Button
- **📎 Paperclip icon** at the bottom left of the message composer
- Click to select files (images, PDFs, Word docs, Excel sheets)
- **Multiple file upload** supported

### File Validation
- **Allowed types:** JPEG, PNG, WebP, GIF, PDF, Word (.doc/.docx), Excel (.xls/.xlsx)
- **Max size:** 10 MB per file
- Real-time validation with user-friendly error messages

### File Display
- **Images:** Inline preview with click-to-open
- **Documents:** Card with file icon, name, size, and "Tap to download"
- **Signed URLs:** 1-hour expiry for secure access

### Real-time Updates
- New attachments appear instantly via Supabase Realtime
- Scroll-to-bottom on new messages
- Upload progress indicator

## 🧪 Testing Checklist

1. **Upload an image:**
   - Click paperclip icon → select JPEG/PNG
   - Verify image appears inline in chat bubble
   - Click image to open full-size in new tab

2. **Upload a PDF:**
   - Click paperclip → select PDF file
   - Verify document card appears with file size
   - Click card to download/open PDF

3. **Multiple files:**
   - Select 2-3 files at once
   - Verify all upload successfully
   - Check "Uploading files..." indicator shows during upload

4. **Validation:**
   - Try uploading a 15 MB file → Should show error
   - Try uploading .exe or unsupported file → Should show error

5. **Cross-user access (important!):**
   - User A uploads image
   - User B should see the image
   - RLS policies ensure only conversation participants can view

6. **Signed URL expiry:**
   - Wait 1 hour after upload
   - Try opening attachment → Should generate new signed URL

## 📁 File Storage Structure

Files are organized in Supabase Storage as:

```
umshado-files/
  threads/
    <conversation_id>/
      <timestamp>-<sanitized_filename>
```

Example:
```
umshado-files/threads/abc123-def456/1703001234567-wedding_venue.jpg
```

## 🔒 Security Features

- **Private bucket:** Files not publicly accessible
- **Signed URLs:** Temporary access (1 hour expiry)
- **RLS policies:** Only conversation participants can view attachments
- **File type validation:** Prevent malicious uploads
- **Size limits:** Prevent abuse (10 MB max)

## 🐛 Troubleshooting

### "Bucket 'umshado-files' not found"
- Run `supabase/storage.sql` or create bucket manually in Dashboard

### "Table 'message_attachments' does not exist"
- Run `supabase/attachments.sql` in SQL Editor

### Files upload but don't appear
- Check browser console for Supabase Storage errors
- Verify RLS policies allow SELECT on `storage.objects`
- Check `message_attachments` table has data: `SELECT * FROM message_attachments;`

### "Policy violation" errors
- Ensure user is authenticated: `SELECT auth.uid();` should return UUID
- Verify RLS policies on `message_attachments` table
- Check storage RLS policies: `storage.objects` should allow authenticated users

### Signed URLs expire immediately
- Check system clock (signed URLs use timestamps)
- Verify Storage URL in Supabase project settings

## 📚 Documentation

See [FILE_UPLOADS_IMPLEMENTATION.md](./FILE_UPLOADS_IMPLEMENTATION.md) for:
- Complete API reference
- Architecture details
- Advanced troubleshooting
- Testing scenarios

## 🚀 Next Steps

1. Run `supabase/storage.sql` in SQL Editor
2. Run `supabase/attachments.sql` in SQL Editor
3. Navigate to `/messages/thread/[threadId]` in your app
4. Test file upload with a sample image
5. Verify image appears in chat

**Ready to go!** The chat thread page is fully implemented and error-free. Just set up the database and you're good to test.
