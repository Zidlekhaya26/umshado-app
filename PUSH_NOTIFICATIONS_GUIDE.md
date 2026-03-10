# Push Notifications Integration Guide

## ✅ Already Implemented

Your app already sends push notifications for:

### 1. **Messages** (`app/api/messages/send/route.ts`)
```typescript
await notifyUsers({
  userIds: [recipientUserId],
  type: 'message',
  title: `New message from ${senderName}`,
  body: messageText.slice(0, 100),
  link: `/messages/${conversationId}`,
});
```

### 2. **Quote Requests** (`app/api/quotes/create/route.ts`)
```typescript
// Notify vendor when couple requests a quote
await notifyUsers({
  userIds: [vendorUserId],
  type: 'quote_request',
  title: 'New Quote Request',
  body: `${coupleName} requested a quote for ${serviceName}`,
  link: `/vendor/quotes/${quoteId}`,
});

// Notify couple when vendor responds
await notifyUsers({
  userIds: [coupleUserId],
  type: 'quote_response',
  title: `Quote from ${vendorName}`,
  body: `${vendorName} sent you a quote`,
  link: `/quotes/${quoteId}`,
});
```

### 3. **Vendor Profile Published** (`app/api/vendor/publish/route.ts`)
```typescript
await notifyUsers({
  userIds: [vendorUserId],
  type: 'vendor_published',
  title: '🎉 Profile Published!',
  body: 'Your profile is now live in the marketplace',
  link: '/vendor/dashboard',
});
```

---

## 🆕 Where to Add Push Notifications

### 1. **Task Reminders** (couple_tasks with due_date)

**When to notify:**
- 7 days before due date
- 3 days before due date
- 1 day before due date
- On the due date

**Example API endpoint** (`app/api/tasks/create/route.ts`):
```typescript
import { notifyUsers } from '@/lib/server/notify';

export async function POST(req: NextRequest) {
  const { coupleId, title, dueDate } = await req.json();
  
  // Create task in DB
  const { data: task } = await supabase
    .from('couple_tasks')
    .insert({ couple_id: coupleId, title, due_date: dueDate })
    .select()
    .single();
  
  // Immediate confirmation notification
  await notifyUsers({
    userIds: [coupleId],
    type: 'task_created',
    title: '✅ Task Added',
    body: `"${title}" - Due ${new Date(dueDate).toLocaleDateString()}`,
    link: '/couple/tasks',
  });
  
  return NextResponse.json({ success: true, task });
}
```

**Task completion notification** (`app/api/tasks/[id]/complete/route.ts`):
```typescript
await notifyUsers({
  userIds: [coupleId],
  type: 'task_completed',
  title: '🎉 Task Completed!',
  body: `"${taskTitle}" marked as done`,
  link: '/couple/tasks',
});
```

---

### 2. **Event Reminders** (live_events)

**When to notify:**
- 1 day before event: "Tomorrow at 2pm: Ceremony begins"
- 1 hour before event: "Starting soon: Ceremony in 1 hour"
- When event starts: "🎊 It's time: Ceremony is starting now!"

**Example** (`app/api/live/events/create/route.ts`):
```typescript
export async function POST(req: NextRequest) {
  const { coupleId, title, time, location } = await req.json();
  
  const { data: event } = await supabase
    .from('live_events')
    .insert({ couple_id: coupleId, title, time, location })
    .select()
    .single();
  
  // Notify couple that event was added to schedule
  await notifyUsers({
    userIds: [coupleId],
    type: 'event_created',
    title: '📅 Event Added',
    body: `${title} at ${time}`,
    link: '/live',
  });
  
  return NextResponse.json({ success: true, event });
}
```

---

### 3. **RSVP Notifications** (couple_guests)

**When to notify:**
- Guest confirms attendance
- Guest declines
- RSVP deadline approaching (7 days before wedding)

**Example** (`app/api/rsvp/submit/route.ts`):
```typescript
export async function POST(req: NextRequest) {
  const { guestId, status } = await req.json(); // status: 'attending' | 'declined'
  
  // Update guest RSVP
  const { data: guest } = await supabase
    .from('couple_guests')
    .update({ rsvp_status: status })
    .eq('id', guestId)
    .select('*, couple:couple_id(id)')
    .single();
  
  // Notify couple
  await notifyUsers({
    userIds: [guest.couple.id],
    type: 'rsvp_update',
    title: status === 'attending' ? '✅ New RSVP Confirmed' : '❌ Guest Declined',
    body: `${guest.name} ${status === 'attending' ? 'will attend' : 'declined'}`,
    link: '/couple/guests',
  });
  
  return NextResponse.json({ success: true });
}
```

---

### 4. **Budget Alerts**

**When to notify:**
- Budget item fully paid
- Budget exceeding planned amount
- Payment reminder (overdue budget items)

**Example** (`app/api/budget/[id]/pay/route.ts`):
```typescript
export async function POST(req: NextRequest) {
  const { itemId, amountPaid } = await req.json();
  
  const { data: item } = await supabase
    .from('couple_budget_items')
    .update({ amount_paid: amountPaid, status: 'paid' })
    .eq('id', itemId)
    .select('*, couple:couple_id(id)')
    .single();
  
  // Notify when fully paid
  if (item.amount_paid >= item.amount) {
    await notifyUsers({
      userIds: [item.couple.id],
      type: 'budget_paid',
      title: '💰 Item Paid in Full',
      body: `${item.title} - R${item.amount.toLocaleString()}`,
      link: '/couple/budget',
    });
  }
  
  return NextResponse.json({ success: true });
}
```

---

### 5. **Guest Well Wishes** (live_well_wishes)

**When to notify:**
- Guest leaves a well wish message on wedding day

**Example** (`app/api/live/well-wishes/create/route.ts`):
```typescript
export async function POST(req: NextRequest) {
  const { coupleId, guestName, message } = await req.json();
  
  await supabase
    .from('live_well_wishes')
    .insert({ couple_id: coupleId, guest_name: guestName, message });
  
  // Notify couple (but only if it's their wedding day to avoid spam)
  await notifyUsers({
    userIds: [coupleId],
    type: 'well_wish',
    title: `💝 Well wish from ${guestName}`,
    body: message.slice(0, 100),
    link: '/live/wishes',
  });
  
  return NextResponse.json({ success: true });
}
```

---

### 6. **Guest Photo Moments** (live_moments)

**When to notify:**
- Guest uploads a photo/moment

**Example** (`app/api/live/moments/create/route.ts`):
```typescript
await notifyUsers({
  userIds: [coupleId],
  type: 'moment_shared',
  title: `📸 New moment from ${guestName}`,
  body: caption || 'Check out this moment from your wedding!',
  link: '/live/moments',
});
```

---

## 🔔 Scheduled Reminders (Requires Cron Job)

For time-based reminders, you need a scheduled job that runs periodically.

### Option 1: Vercel Cron Jobs (Recommended)

**1. Create the cron endpoint** (`app/api/cron/reminders/route.ts`):
```typescript
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { notifyUsers } from '@/lib/server/notify';

export async function GET() {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0];
  const in3Days = new Date(Date.now() + 3*24*60*60*1000).toISOString().split('T')[0];
  const in7Days = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];

  // 1. Task reminders (due tomorrow)
  const { data: dueTasks } = await supabase
    .from('couple_tasks')
    .select('*')
    .eq('is_done', false)
    .eq('due_date', tomorrow);

  for (const task of dueTasks || []) {
    await notifyUsers({
      userIds: [task.couple_id],
      type: 'task_reminder',
      title: '⏰ Task Due Tomorrow',
      body: `"${task.title}" is due tomorrow`,
      link: '/couple/tasks',
    });
  }

  // 2. Task reminders (overdue today)
  const { data: overdueTasks } = await supabase
    .from('couple_tasks')
    .select('*')
    .eq('is_done', false)
    .eq('due_date', today);

  for (const task of overdueTasks || []) {
    await notifyUsers({
      userIds: [task.couple_id],
      type: 'task_overdue',
      title: '🚨 Task Due Today!',
      body: `"${task.title}" is due today`,
      link: '/couple/tasks',
    });
  }

  // 3. Event reminders (live_events table doesn't have dates yet - you'd need to add wedding_date)
  // Placeholder for when you add proper dates to events
  
  return NextResponse.json({ 
    success: true, 
    processed: {
      dueTasks: dueTasks?.length || 0,
      overdueTasks: overdueTasks?.length || 0,
    }
  });
}
```

**2. Add to `vercel.json`**:
```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```
This runs daily at 9am UTC (adjust timezone as needed).

**3. Add CRON_SECRET to Vercel env vars**:
```bash
CRON_SECRET=your-random-secret-here
```

---

### Option 2: External Cron Service (Alternative)

Use services like:
- **Cron-job.org** (free, reliable)
- **EasyCron**
- **GitHub Actions** (scheduled workflows)

They'll hit your `/api/cron/reminders` endpoint daily.

---

## 📱 Push Notification Types Summary

| Type | Title | Body | Link | When |
|------|-------|------|------|------|
| `message` | New message from {name} | {message preview} | `/messages/{id}` | Message sent |
| `quote_request` | New Quote Request | {couple} requested a quote | `/vendor/quotes/{id}` | Quote requested |
| `quote_response` | Quote from {vendor} | {vendor} sent you a quote | `/quotes/{id}` | Quote received |
| `task_created` | ✅ Task Added | {title} - Due {date} | `/couple/tasks` | Task created |
| `task_reminder` | ⏰ Task Due Tomorrow | {title} is due tomorrow | `/couple/tasks` | 1 day before due |
| `task_overdue` | 🚨 Task Due Today! | {title} is due today | `/couple/tasks` | On due date |
| `task_completed` | 🎉 Task Completed | {title} marked as done | `/couple/tasks` | Task marked done |
| `event_created` | 📅 Event Added | {title} at {time} | `/live` | Event added |
| `event_reminder_1d` | 📅 Tomorrow: {event} | {title} at {time} | `/live` | 1 day before |
| `event_reminder_1h` | ⏰ Starting Soon | {title} in 1 hour | `/live` | 1 hour before |
| `event_starting` | 🎊 It's Time! | {title} is starting now | `/live` | Event time |
| `rsvp_confirmed` | ✅ New RSVP | {guest} will attend | `/couple/guests` | Guest confirms |
| `rsvp_declined` | ❌ Guest Declined | {guest} declined | `/couple/guests` | Guest declines |
| `budget_paid` | 💰 Item Paid | {title} paid in full | `/couple/budget` | Payment complete |
| `well_wish` | 💝 Well wish from {guest} | {message preview} | `/live/wishes` | Guest posts wish |
| `moment_shared` | 📸 New moment | {guest} shared a photo | `/live/moments` | Guest uploads |
| `vendor_published` | 🎉 Profile Published | Now live in marketplace | `/vendor/dashboard` | Profile approved |

---

## 🎯 Quick Integration Checklist

### Immediate Actions:
- [ ] Add notifications to RSVP submission (`app/api/rsvp/submit/route.ts`)
- [ ] Add notifications to task completion (`app/api/tasks/[id]/complete/route.ts`)
- [ ] Add notifications to well wishes (`app/api/live/well-wishes/create/route.ts`)
- [ ] Add notifications to moments upload (`app/api/live/moments/create/route.ts`)
- [ ] Add notifications to budget payments (`app/api/budget/[id]/pay/route.ts`)

### Scheduled Reminders:
- [ ] Create `/api/cron/reminders/route.ts`
- [ ] Add `vercel.json` with cron schedule
- [ ] Set `CRON_SECRET` in Vercel environment variables
- [ ] Test cron endpoint manually: `/api/cron/reminders?secret=your-secret`

### Future Enhancements:
- [ ] Add wedding_date to live_events for proper time-based reminders
- [ ] Add notification preferences UI (let users mute certain types)
- [ ] Add "Mark all as read" functionality
- [ ] Add notification grouping (e.g., "3 new messages" instead of 3 separate notifications)
- [ ] Add quiet hours (don't send notifications between 10pm-8am)

---

## 🧪 Testing Push Notifications

Always test new notification types with the API:

```powershell
# Test task reminder
$body = @{
    userId = "your-user-id"
    type = "task_reminder"
    title = "⏰ Task Due Tomorrow"
    body = "Book venue is due tomorrow"
    link = "/couple/tasks"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://umshado-app.vercel.app/api/notifications/create" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

Or from browser console:
```javascript
fetch('/api/notifications/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'your-user-id',
    type: 'event_reminder_1h',
    title: '⏰ Starting Soon',
    body: 'Ceremony begins in 1 hour',
    link: '/live'
  })
}).then(r => r.json()).then(console.log);
```

---

## 🎊 Your Push Notifications Are Now Live!

The infrastructure is complete and working. Now just integrate `notifyUsers()` wherever you want to alert users. Every notification automatically:
- ✅ Saves to database
- ✅ Sends push to all user's devices
- ✅ Handles errors gracefully
- ✅ Auto-deletes expired subscriptions

Happy notifying! 🔔
