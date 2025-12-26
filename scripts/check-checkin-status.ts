/**
 * Check daily check-in status and records
 */

import { db } from '../src/core/db';
import { dailyCheckins, user } from '../src/config/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getUserInfo } from '../src/shared/models/user';

async function checkCheckinStatus() {
  try {
    console.log('Checking daily check-in status...\n');

    // Get current user
    const currentUser = await getUserInfo();
    if (!currentUser) {
      console.log('✗ No user logged in');
      process.exit(1);
    }

    console.log(`User ID: ${currentUser.id}`);
    console.log(`User Email: ${currentUser.email}\n`);

    // Get UTC date
    const todayUTC = new Date().toISOString().split('T')[0];
    console.log(`Today (UTC): ${todayUTC}`);

    // Get local date
    const todayLocal = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
    console.log(`Today (Local): ${todayLocal}\n`);

    // Check existing check-ins for today
    const todayCheckins = await db()
      .select()
      .from(dailyCheckins)
      .where(
        and(
          eq(dailyCheckins.userId, currentUser.id),
          eq(dailyCheckins.checkinDate, todayUTC)
        )
      )
      .limit(10);

    console.log(`Check-ins for today (UTC ${todayUTC}): ${todayCheckins.length}`);
    if (todayCheckins.length > 0) {
      todayCheckins.forEach((checkin: typeof dailyCheckins.$inferSelect, index: number) => {
        console.log(`  ${index + 1}. Check-in ID: ${checkin.id}, Date: ${checkin.checkinDate}, Created: ${checkin.createdAt}`);
      });
    }

    // Get recent check-ins (last 7 days)
    console.log('\nRecent check-ins (last 7 days):');
    const recentCheckins = await db()
      .select()
      .from(dailyCheckins)
      .where(eq(dailyCheckins.userId, currentUser.id))
      .orderBy(desc(dailyCheckins.checkinDate))
      .limit(7);

    if (recentCheckins.length > 0) {
      recentCheckins.forEach((checkin: typeof dailyCheckins.$inferSelect, index: number) => {
        const isToday = checkin.checkinDate === todayUTC;
        console.log(`  ${index + 1}. Date: ${checkin.checkinDate} ${isToday ? '(TODAY)' : ''}, Created: ${checkin.createdAt}`);
      });
    } else {
      console.log('  No recent check-ins found');
    }

    // Check user's last check-in date
    const [userRecord] = await db()
      .select({ lastCheckinDate: user.lastCheckinDate })
      .from(user)
      .where(eq(user.id, currentUser.id))
      .limit(1);

    console.log(`\nUser's last check-in date: ${userRecord?.lastCheckinDate || 'Never'}`);

    // Check if can check in
    const canCheckIn = todayCheckins.length === 0;
    console.log(`\nCan check in today: ${canCheckIn ? 'YES ✓' : 'NO ✗'}`);

    if (!canCheckIn) {
      console.log('\n⚠ Reason: User has already checked in today (UTC date)');
      console.log('Note: Check-in uses UTC timezone. If you are in a different timezone,');
      console.log('      you may need to wait until UTC midnight to check in again.');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkCheckinStatus();

