import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';
import { notifyUsers } from '@/lib/server/notify';

/**
 * Cron job endpoint for sending scheduled reminders.
 * Runs daily at 9am UTC via Vercel Crons.
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
    weddingCountdowns: 0,
    guestListNudges: 0,
    vendorVerificationNudges: 0,
    errors: [] as string[],
  };

  try {
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
    // 3. WEDDING COUNTDOWN REMINDERS (30, 7, 1 day before)
    // ============================================================
    const countdownDays = [30, 7, 1];
    for (const days of countdownDays) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + days);
      const targetStr = targetDate.toISOString().split('T')[0];

      const { data: upcoming } = await supabase
        .from('couples')
        .select('id, partner_name, wedding_date')
        .eq('wedding_date', targetStr);

      if (upcoming && upcoming.length > 0) {
        for (const couple of upcoming) {
          try {
            const label = days === 1 ? 'Tomorrow! 🎉' : `in ${days} days 💍`;
            await notifyUsers({
              userIds: [couple.id],
              type: 'wedding_countdown',
              title: days === 1 ? '🎊 The big day is tomorrow!' : `💍 ${days} days to go!`,
              body: days === 1
                ? `Your wedding is tomorrow! We're so excited for you. Everything is ready — enjoy every moment.`
                : `Your wedding is ${label}. Time to check your checklist and confirm final details.`,
              link: '/couple/planner',
              meta: { days, weddingDate: couple.wedding_date },
            });
            results.weddingCountdowns++;
          } catch (e: any) {
            results.errors.push(`Wedding countdown for couple ${couple.id} failed: ${e.message}`);
          }
        }
      }
    }

    // ============================================================
    // 4. GUEST LIST NUDGE (< 5 guests added after 7+ days on platform)
    // ============================================================
    // Find couples who joined 7+ days ago with fewer than 5 guests
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    const { data: youngCouples } = await supabase
      .from('couples')
      .select('id, partner_name, created_at')
      .lt('created_at', sevenDaysAgoStr);

    if (youngCouples && youngCouples.length > 0) {
      for (const couple of youngCouples) {
        try {
          // Count their guests
          const { count: guestCount } = await supabase
            .from('couple_guests')
            .select('id', { count: 'exact', head: true })
            .eq('couple_id', couple.id);

          if ((guestCount ?? 0) < 5) {
            // Only nudge once every 14 days — check last notification of this type
            const fourteenDaysAgo = new Date(today);
            fourteenDaysAgo.setDate(today.getDate() - 14);
            const { data: recentNudge } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', couple.id)
              .eq('type', 'guest_list_nudge')
              .gte('created_at', fourteenDaysAgo.toISOString())
              .limit(1)
              .maybeSingle();

            if (!recentNudge) {
              await notifyUsers({
                userIds: [couple.id],
                type: 'guest_list_nudge',
                title: '👥 Build your guest list',
                body: `You have ${guestCount ?? 0} guests added. Start building your list so you can track RSVPs and send invites via WhatsApp.`,
                link: '/couple/planner',
              });
              results.guestListNudges++;
            }
          }
        } catch (e: any) {
          results.errors.push(`Guest list nudge for couple ${couple.id} failed: ${e.message}`);
        }
      }
    }

    // ============================================================
    // 5. UNVERIFIED VENDOR NUDGE (published but not verified, weekly)
    // ============================================================
    const { data: unverifiedVendors } = await supabase
      .from('vendors')
      .select('id, user_id, business_name, verification_status, created_at')
      .eq('is_published', true)
      .neq('verification_status', 'approved')
      .neq('verification_status', 'paid_pending_review');

    if (unverifiedVendors && unverifiedVendors.length > 0) {
      const sevenDaysAgoIso = sevenDaysAgo.toISOString();
      for (const vendor of unverifiedVendors) {
        try {
          // Only nudge once per week
          const { data: recentNudge } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', vendor.user_id)
            .eq('type', 'verification_nudge')
            .gte('created_at', sevenDaysAgoIso)
            .limit(1)
            .maybeSingle();

          if (!recentNudge) {
            await notifyUsers({
              userIds: [vendor.user_id],
              type: 'verification_nudge',
              title: '✅ Get verified on uMshado',
              body: `Verified vendors get a blue badge, appear higher in search, and build more trust with couples. Get ${vendor.business_name || 'your profile'} verified today.`,
              link: '/vendor/billing',
              meta: { vendorId: vendor.id },
            });
            results.vendorVerificationNudges++;
          }
        } catch (e: any) {
          results.errors.push(`Verification nudge for vendor ${vendor.id} failed: ${e.message}`);
        }
      }
    }

    console.log('[cron/reminders] Completed:', results);
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('[cron/reminders] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: error.message, results },
      { status: 500 }
    );
  }
}

// Allow manual testing via POST (with same auth)
export async function POST(req: NextRequest) {
  return GET(req);
}
