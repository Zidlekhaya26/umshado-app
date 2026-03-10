# Testing Push Notifications

## ✅ Push Infrastructure Status: WORKING
- Test endpoint shows: `"pushResults": [{"ok": true}]`
- Both Apple Push and FCM subscriptions active
- Push notifications successfully delivered

## Issue with Manual SQL Inserts
Direct SQL inserts like this **won't trigger pushes**:
```sql
INSERT INTO notifications (user_id, type, title, body, meta)
VALUES ('a7d1c0e5-2a7f-4cbb-aff4-4f1140b45072'::uuid, 'system', 'Test', 'Body', '{}'::jsonb);
```

**Why?** Database triggers can't reliably send push notifications. Push requires external API calls (web-push library), which database triggers can't make reliably.

---

## ✅ Solution: Use the API Endpoint

### Test via PowerShell:
```powershell
$body = @{
    userId = "a7d1c0e5-2a7f-4cbb-aff4-4f1140b45072"
    type = "system"
    title = "Test Notification"
    body = "You should see this as a push!"
    link = "/"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://umshado-app.vercel.app/api/notifications/create" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### Test via curl:
```bash
curl -X POST https://umshado-app.vercel.app/api/notifications/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "a7d1c0e5-2a7f-4cbb-aff4-4f1140b45072",
    "type": "system",
    "title": "Test Notification",
    "body": "You should see this as a push!",
    "link": "/"
  }'
```

### Test via browser console (umshado-app.vercel.app):
```javascript
fetch('/api/notifications/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'a7d1c0e5-2a7f-4cbb-aff4-4f1140b45072',
    type: 'system',
    title: 'Test from Console',
    body: 'This should push immediately!',
    link: '/'
  })
}).then(r => r.json()).then(console.log);
```

---

## How Notifications Work in Production

All notification-creating code in your app already uses this pattern:

### Example: Message notifications (app/api/messages/send/route.ts)
```typescript
import { notifyUsers } from '@/lib/server/notify';

// ... create message in DB ...

// Then send notification + push
await notifyUsers({
  userIds: [recipientId],
  type: 'message',
  title: 'New Message',
  body: `${senderName}: ${messageText}`,
  link: `/messages/${conversationId}`,
});
```

### Example: Quote notifications (app/api/quotes/create/route.ts)
```typescript
await notifyUsers({
  userIds: [vendorUserId],
  type: 'quote_request',
  title: 'New Quote Request',
  body: `${coupleName} requested a quote`,
  link: `/vendor/quotes/${quoteId}`,
});
```

The `notifyUsers()` function:
1. ✅ Inserts notification into database
2. ✅ Sends push to all user's subscriptions
3. ✅ Auto-deletes expired subscriptions (410/404 responses)
4. ✅ Handles errors gracefully

---

## Expected Result

After calling `/api/notifications/create`:
1. Notification appears in database (`notifications` table)
2. Push notification delivers to all devices immediately
3. API returns:
   ```json
   {
     "success": true,
     "userIds": ["a7d1c0e5-2a7f-4cbb-aff4-4f1140b45072"],
     "pushSent": true
   }
   ```

---

## Verify Deployment

Wait ~2 minutes for Vercel build, then test:
```powershell
# This should now trigger a push notification
$body = @{
    userId = "a7d1c0e5-2a7f-4cbb-aff4-4f1140b45072"
    type = "system"
    title = "🎉 Final Test"
    body = "If you see this as a push, everything works!"
    link = "/"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://umshado-app.vercel.app/api/notifications/create" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

You should:
- ✅ See the notification in your browser
- ✅ Get it in the database
- ✅ Verified via: `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 1;`
