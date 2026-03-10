import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { notifyUsers } from '@/lib/server/notify';

/**
 * Cron job endpoint for sending scheduled reminders.
 * 
 * Setup:
 * 1. Add to vercel.json:
 *    {
 *      "crons": [{
 *        "path": "/api/cron/reminders",
 *        "schedule": "0 9 * * *"
 *      }]
 *    }
 * 
 * 2. Add CRON_SECRET to Vercel environment variables
 * 
 * 3. This will run daily at 9am UTC
 * 
 * Manual testing:
 * curl https://umshado-app.vercel.app/api/cron/reminders \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function GET(req: NextRequest) {
  // Verify authorization
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const results = {
    tasksDueTomorrow: 0,
    tasksDueToday: 0,
    errors: [] as string[],
  };

  try {
    // Calculate dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // ============================================================
    // 1. TASK REMINDERS (Due tomorrow)
    // ============================================================
    const { data: dueTomorrow, error: err1 } = await supabase
      .from('couple_tasks')
      .select('*')
      .eq('is_done', false)
      .eq('due_date', tomorrowStr);

    if (err1) {
      results.errors.push(`Tasks query error: ${err1.message}`);
    } else if (dueTomorrow && dueTomorrow.length > 0) {
      for (const task of dueTomorrow) {
        try {
          await notifyUsers({
            userIds: [task.couple_id],
            type: 'task_reminder',
            title: '⏰ Task Due Tomorrow',
            body: `"${task.title}" is due tomorrow`,
            link: '/couple/tasks',
          });
          results.tasksDueTomorrow++;
        } catch (e: any) {
          results.errors.push(`Task ${task.id} notification failed: ${e.message}`);
        }
      }
    }

    // ============================================================
    // 2. TASK REMINDERS (Due today)
    // ============================================================
    const { data: dueToday, error: err2 } = await supabase
      .from('couple_tasks')
      .select('*')
      .eq('is_done', false)
      .eq('due_date', todayStr);

    if (err2) {
      results.errors.push(`Overdue tasks query error: ${err2.message}`);
    } else if (dueToday && dueToday.length > 0) {
      for (const task of dueToday) {
        try {
          await notifyUsers({
            userIds: [task.couple_id],
            type: 'task_overdue',
            title: '🚨 Task Due Today!',
            body: `"${task.title}" is due today`,
            link: '/couple/tasks',
          });
          results.tasksDueToday++;
        } catch (e: any) {
          results.errors.push(`Overdue task ${task.id} notification failed: ${e.message}`);
        }
      }
    }

    // ============================================================
    // 3. FUTURE: Event reminders
    // ============================================================
    // When you add wedding_date to couples table and event_date to live_events:
    // - Find events happening in 1 day
    // - Find events happening in 1 hour
    // - Send appropriate reminders

    console.log('[cron/reminders] Completed:', results);
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('[cron/reminders] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        results,
      },
      { status: 500 }
    );
  }
}

// Allow manual testing via POST (with same auth)
export async function POST(req: NextRequest) {
  return GET(req);
}
