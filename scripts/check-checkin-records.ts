/**
 * Check daily check-in records directly from database
 * This script doesn't require authentication context
 */

import { db } from '../src/core/db';
import { dailyCheckins } from '../src/config/db/schema';
import { desc, sql } from 'drizzle-orm';

async function checkCheckinRecords() {
  try {
    console.log('Checking daily check-in records...\n');

    // Get UTC date
    const todayUTC = new Date().toISOString().split('T')[0];
    console.log(`Today (UTC): ${todayUTC}`);

    // Get local date
    const now = new Date();
    const localDate = now.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    const localTime = now.toLocaleTimeString();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    console.log(`Today (Local ${timezone}): ${localDate} ${localTime}`);
    console.log(`Current UTC time: ${now.toISOString()}\n`);

    // Get all check-ins for today (UTC)
    const todayCheckins = await db()
      .execute(sql`
        SELECT 
          id, 
          user_id, 
          checkin_date, 
          created_at,
          EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_ago
        FROM daily_checkins 
        WHERE checkin_date = ${todayUTC}
        ORDER BY created_at DESC
        LIMIT 20
      `);

    console.log(`Total check-ins for today (UTC ${todayUTC}): ${todayCheckins.rows?.length || 0}\n`);

    if (todayCheckins.rows && todayCheckins.rows.length > 0) {
      console.log('Today\'s check-ins:');
      todayCheckins.rows.forEach((row: any, index: number) => {
        const hoursAgo = parseFloat(row.hours_ago || 0).toFixed(1);
        console.log(`  ${index + 1}. User: ${row.user_id.substring(0, 8)}..., Date: ${row.checkin_date}, Created: ${row.created_at} (${hoursAgo} hours ago)`);
      });
    } else {
      console.log('No check-ins found for today (UTC)\n');
    }

    // Get recent check-ins (last 10)
    const recentCheckins = await db()
      .select()
      .from(dailyCheckins)
      .orderBy(desc(dailyCheckins.createdAt))
      .limit(10);

    console.log('\nRecent check-ins (last 10, all users):');
    if (recentCheckins.length > 0) {
      recentCheckins.forEach((checkin: typeof dailyCheckins.$inferSelect, index: number) => {
        const isToday = checkin.checkinDate === todayUTC;
        console.log(`  ${index + 1}. User: ${checkin.userId.substring(0, 8)}..., Date: ${checkin.checkinDate} ${isToday ? '(TODAY UTC)' : ''}, Created: ${checkin.createdAt}`);
      });
    } else {
      console.log('  No check-ins found');
    }

    console.log('\n⚠ Important Notes:');
    console.log('1. Check-in uses UTC timezone (not local time)');
    console.log('2. If you checked in today in your local timezone, but UTC date is different,');
    console.log('   you may see "already checked in" message');
    console.log('3. Check-in resets at UTC midnight (00:00 UTC)');
    console.log(`4. Current UTC time: ${now.toISOString()}`);
    console.log(`5. Next UTC midnight: ${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()}`);

    process.exit(0);
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkCheckinRecords();

