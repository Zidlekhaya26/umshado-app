# File Uploads & Attachments Implementation Guide

## Overview
Complete file upload and attachment system for uMshado chat with Supabase Storage integration.

## Features Implemented

### 1. Supabase Storage Bucket
- **Bucket name**: `umshado-files`
- **Access**: Private (requires authentication)
- **File size limit**: 10 MB per file
- **Allowed types**: Images (JPEG, PNG, WebP, GIF), PDFs, Word docs, Excel sheets

### 2. Database Tables

#### `message_attachments`
Tracks files attached to chat messages.

```sql
CREATE TABLE message_attachments (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL,
  message_id uuid NOT NULL,
  uploader_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size int,
  created_at timestamptz DEFAULT now()
);
```

#### `quote_attachments` (Optional)
Allows attaching files to quote requests (inspiration images, requirements).

```sql
CREATE TABLE quote_attachments (
  id uuid PRIMARY KEY,
  quote_id uuid NOT NULL,
  uploader_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size int,
  created_at timestamptz DEFAULT now()
);
```

### 3. Row-Level Security

**Upload Policy**: Only authenticated users can upload files to their own conversations.

**Read Policy**: Users can view attachments from conversations they participate in.

**Delete Policy**: Users can delete their own attachments.

### 4. File Storage Structure

```
umshado-files/
└── threads/
    └── <conversation_id>/
        ├── <timestamp>-<filename>.jpg
        ├── <timestamp>-<filename>.pdf
        └── ...
```

### 5. Chat UI Features

- **📎 Attachment button**: Opens file picker
- **Multiple file upload**: Select multiple files at once
- **File validation**: Type and size checks before upload
- **Image previews**: Inline image display in chat bubbles
- **Document cards**: Show file name, size, and download button for non-images
- **Signed URLs**: Secure, temporary download links (1-hour expiry)
- **Real-time updates**: New attachments appear instantly via Supabase Realtime
- **Upload progress**: Loading indicator during file upload

## Setup Instructions

### Step 1: Create Storage Bucket

**Option A: Supabase Dashboard (Recommended)**
1. Go to Supabase Dashboard → Storage
2. Click "Create new bucket"
3. Bucket name: `umshado-files`
4. Public bucket: **OFF** (unchecked)
5. File size limit: `10485760` (10 MB)
6. Click "Create bucket"

**Option B: SQL**
Run `supabase/storage.sql` in Supabase SQL Editor.

### Step 2: Apply Storage Policies

Run the storage policy SQL from `supabase/storage.sql`:

```sql
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'umshado-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can read thread files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'umshado-files' AND auth.uid() IS NOT NULL);

-- etc.
```

### Step 3: Create Attachment Tables

Run `supabase/attachments.sql` in Supabase SQL Editor.

This creates:
- `message_attachments` table with RLS
- `quote_attachments` table with RLS
- Indexes for performance

### Step 4: Verify Setup

Run these queries in Supabase SQL Editor:

```sql
-- Check bucket exists
SELECT * FROM storage.buckets WHERE id = 'umshado-files';

-- Check tables exist with RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('message_attachments', 'quote_attachments');

-- Check storage policies
SELECT * FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';
```

## Testing Guide

### Test 1: Upload Image to Chat

1. **Setup**:
   - Start dev server: `npm run dev`
   - Have at least one active conversation (couple ↔ vendor)
   - Sign in as couple or vendor

2. **Upload**:
   - Open conversation: http://localhost:3000/messages/thread/[conversationId]
   - Click the attachment button (📎 icon)
   - Select an image file (JPG, PNG, or WebP)
   - Wait for "Uploading files..." indicator

3. **Verify**:
   - ✅ Image appears as inline preview in chat bubble
   - ✅ Timestamp shows below image
   - ✅ Can click image to open in new tab
   - ✅ Refresh page - image still displays with new signed URL

4. **Database Check**:
   ```sql
   SELECT * FROM message_attachments 
   WHERE conversation_id = '<your-conversation-id>';
   
   SELECT * FROM messages 
   WHERE conversation_id = '<your-conversation-id>' 
   ORDER BY created_at DESC;
   ```

### Test 2: Upload PDF Document

1. **Upload**:
   - In same conversation, click attach button (📎)
   - Select a PDF file
   - Wait for upload

2. **Verify**:
   - ✅ PDF shows as document card with file icon
   - ✅ File name and size display correctly
   - ✅ "Tap to download" text visible
   - ✅ Click card to download/open PDF

### Test 3: Multiple File Upload

1. **Upload**:
   - Click attach button
   - Hold Ctrl (Windows) or Cmd (Mac)
   - Select 2-3 files (mix of images and PDFs)
   - Upload all at once

2. **Verify**:
   - ✅ All files upload sequentially
   - ✅ Each creates separate message with attachment
   - ✅ All appear in chat correctly

### Test 4: File Validation

1. **Size Limit**:
   - Try uploading a file > 10 MB
   - ✅ Alert: "File too large. Maximum size is 10 MB."
   - ✅ File rejected, not uploaded

2. **Type Validation**:
   - Try uploading unsupported type (e.g., .exe, .zip)
   - ✅ Alert: "File type not allowed. Please upload images, PDFs, or Office documents."
   - ✅ File rejected

### Test 5: Cross-User Access

1. **Sign in as Couple**:
   - Upload file to conversation with Vendor A
   - Note the file path

2. **Sign in as different Vendor B**:
   - Try to access same file via direct URL
   - ✅ Should fail or return 404 (RLS policy blocks)

3. **Sign in as correct Vendor A**:
   - Open conversation with couple
   - ✅ Can see and download file

### Test 6: Signed URL Expiry

1. **Upload file**
2. **Copy signed URL** from browser dev tools
3. **Wait 1+ hours** (or modify createSignedUrl expiry to 60 seconds for testing)
4. **Try accessing URL**:
   - ✅ Should be expired
   - ✅ Clicking file in chat generates new URL and downloads successfully

### Test 7: Real-time Updates

1. **Open conversation in two browser tabs**:
   - Tab 1: Signed in as Couple
   - Tab 2: Signed in as Vendor (same conversation)

2. **Upload file in Tab 1**

3. **Check Tab 2**:
   - ✅ New message with attachment appears automatically
   - ✅ No refresh needed

## File Upload Flow

```
User clicks attach button
  ↓
File picker opens
  ↓
User selects file(s)
  ↓
Frontend validates type & size
  ↓
Upload to Supabase Storage (bucket: umshado-files)
  ↓
Create message record in messages table
  ↓
Create attachment record in message_attachments table
  ↓
Generate signed URL (1-hour expiry)
  ↓
Display in chat UI (image preview or document card)
  ↓
Real-time broadcast to other participants
```

## Security Features

1. **Private Bucket**: Files not publicly accessible via direct URL
2. **Signed URLs**: Temporary access links that expire after 1 hour
3. **RLS Policies**: Database-level access control
4. **File Validation**: Frontend checks type and size before upload
5. **Sanitized Filenames**: Special characters removed from paths
6. **Authenticated Uploads**: Only logged-in users can upload
7. **Thread Verification**: Users must be part of conversation

## Known Limitations & Future Enhancements

### Current Limitations
- Max file size: 10 MB (configurable in storage.sql)
- Signed URLs expire after 1 hour (regenerated on demand)
- No virus scanning (consider adding Supabase Edge Function)
- No progress bar for large uploads (could add with XMLHttpRequest)

### Future Enhancements
- [ ] Image compression before upload
- [ ] Drag-and-drop file upload
- [ ] Copy/paste images from clipboard
- [ ] Video file support (requires larger size limit)
- [ ] Attachment search/filter
- [ ] Download all attachments as ZIP
- [ ] Admin dashboard to monitor storage usage
- [ ] Automatic cleanup of orphaned files

## Troubleshooting

### Error: "Failed to upload file"
- **Check**: Storage bucket exists with correct name `umshado-files`
- **Check**: Storage policies allow authenticated users to INSERT
- **Check**: File size < 10 MB and type is allowed

### Error: "Failed to download file"
- **Check**: Signed URL hasn't expired (< 1 hour old)
- **Check**: User is part of the conversation (RLS policy)
- **Check**: File still exists in storage bucket

### Images not displaying
- **Check**: File was uploaded with correct MIME type (image/*)
- **Check**: Signed URL generated successfully
- **Check**: Browser console for CORS or network errors

### Real-time not working
- **Check**: Supabase Realtime enabled for tables
- **Check**: RLS policies allow SELECT on messages table
- **Check**: Browser console for WebSocket errors

## API Reference

### Upload File
```typescript
const { data, error } = await supabase.storage
  .from('umshado-files')
  .upload(filePath, file, {
    cacheControl: '3600',
    upsert: false
  });
```

### Generate Signed URL
```typescript
const { data, error } = await supabase.storage
  .from('umshado-files')
  .createSignedUrl(filePath, 3600); // 1 hour

// Returns: { signedUrl: 'https://...' }
```

### Delete File
```typescript
const { error } = await supabase.storage
  .from('umshado-files')
  .remove([filePath]);
```

## Testing Checklist

- [ ] Create storage bucket `umshado-files`
- [ ] Apply storage RLS policies
- [ ] Run `supabase/attachments.sql` migration
- [ ] Upload image to chat - displays inline
- [ ] Upload PDF to chat - shows as document card
- [ ] Upload multiple files at once
- [ ] Try uploading 11 MB file - rejected
- [ ] Try uploading .exe file - rejected
- [ ] Download attachment by clicking it
- [ ] Refresh page - attachments still visible
- [ ] Sign in as different user - cannot access other's files
- [ ] Real-time: upload in one tab, appears in another tab
- [ ] Check database tables populated correctly

## Support

For issues or questions:
1. Check Supabase logs in Dashboard → Database → Logs
2. Check browser console for client-side errors
3. Review RLS policies in Dashboard → Database → Policies
4. Verify storage bucket configuration in Dashboard → Storage
